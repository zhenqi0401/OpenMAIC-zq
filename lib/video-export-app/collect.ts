'use client';

/**
 * Browser collection layer — resolve the binary bytes for a compiled
 * {@link VideoTimeline}'s asset plan.
 *
 * The pure compiler already produced the layout: `ir.assets.entries` names every
 * bundled asset, its `kind`, its zip-relative `path`, and whether its bytes are
 * `present`. This layer just fills those paths with real `Blob`s — narration and
 * media come straight from the Dexie records the DI factory already loaded (no
 * second read), and slide base frames are rendered here via `slideToPng`. Because
 * the plan owns paths and dedup, this is a byte-fetch loop, not a second planner.
 *
 * The slide-snapshot + generated-media-resolution logic preserves the existing
 * objectURL lifecycle: a
 * cloned slide has its generated-media placeholders swapped for objectURLs, is
 * snapshotted, and the URLs are revoked immediately so memory stays bounded on a
 * large classroom.
 *
 * App-side / impure: reaches into Dexie records, the renderer snapshot, and the
 * DOM — outside the `lib/video-export/**` purity boundary by design.
 */
import { slideToPng } from '@openmaic/renderer/snapshot';
import type { Slide } from '@openmaic/dsl';
import type { VideoTimeline } from '@/lib/video-export';
import type { Scene, SlideContent } from '@/lib/types/stage';
import type { ResolvedVideoMedia, VideoTimelineRecords } from './timeline-deps';

export interface CollectOptions {
  /** Slide-snapshot render width in px (frame height follows the slide ratio). Default 1600. */
  frameWidth?: number;
  /** Called after each asset is resolved, for progress UX. */
  onProgress?: (done: number, total: number) => void;
}

export interface CollectResult {
  /** zip-relative path → bytes, for every present asset the plan named. */
  blobs: Map<string, Blob>;
  /** Plan entries whose bytes could not be produced (missing record / render failure). */
  missing: string[];
}

type SnapshotMediaElement = { id: string; type: string; src?: string; poster?: string };

/** `frame:<sceneId>` → `<sceneId>`. */
function frameSceneId(assetId: string): string | null {
  return assetId.startsWith('frame:') ? assetId.slice('frame:'.length) : null;
}

function blobWithType(blob: Blob, mimeType: string): Blob {
  return blob.type ? blob : new Blob([blob], { type: mimeType });
}

/**
 * Clone a slide and swap each generated-media placeholder for an objectURL over
 * the resolved bytes, returning a `revoke` that releases them immediately after
 * the snapshot resolves or fails.
 */
async function resolveGeneratedMedia(
  source: Slide,
  mediaByElementId: Map<string, ResolvedVideoMedia>,
): Promise<{ slide: Slide; revoke: () => void }> {
  const slide = structuredClone(source);
  const objectUrls: string[] = [];

  for (const element of slide.elements as SnapshotMediaElement[]) {
    const record = mediaByElementId.get(element.id);
    if (!record || record.blob.size === 0) continue;
    const bytes = record.blob;
    if (element.type === 'image' && record.type === 'image') {
      const url = URL.createObjectURL(blobWithType(bytes, record.mimeType));
      objectUrls.push(url);
      element.src = url;
    } else if (element.type === 'video' && record.type === 'video') {
      const url = URL.createObjectURL(blobWithType(bytes, record.mimeType));
      objectUrls.push(url);
      element.src = url;
      const posterBytes = record.poster;
      if (posterBytes) {
        const poster = URL.createObjectURL(blobWithType(posterBytes, 'image/jpeg'));
        objectUrls.push(poster);
        element.poster = poster;
      }
    } else if (element.type === 'image') {
      element.src = '';
    }
  }

  return { slide, revoke: () => objectUrls.forEach((url) => URL.revokeObjectURL(url)) };
}

/** Render one slide scene to a PNG frame blob, releasing objectURLs immediately after. */
async function renderFrame(
  slide: Slide,
  mediaByElementId: Map<string, ResolvedVideoMedia>,
  width: number,
): Promise<Blob> {
  const { slide: resolved, revoke } = await resolveGeneratedMedia(slide, mediaByElementId);
  try {
    const output = await slideToPng(resolved, {
      width,
      pixelRatio: 1,
      backgroundColor: '#ffffff',
      format: 'blob',
    });
    return output instanceof Blob ? output : await fetch(output).then((r) => r.blob());
  } finally {
    revoke();
  }
}

/**
 * Collect the bytes for every present entry in the IR's asset plan. Frames are
 * rendered from the matching slide scene; audio/video bytes come from the loaded
 * Dexie records. Absent or unrenderable entries are reported in `missing` rather
 * than throwing, so one bad asset does not fail the whole export.
 */
export async function collectVideoAssets(
  ir: VideoTimeline,
  scenes: Scene[],
  records: VideoTimelineRecords,
  options: CollectOptions = {},
): Promise<CollectResult> {
  const width = options.frameWidth ?? 1600;
  const blobs = new Map<string, Blob>();
  const missing: string[] = [];

  const sceneById = new Map(scenes.map((s) => [s.id, s]));
  const mediaById = new Map<string, ResolvedVideoMedia>();
  for (const record of records.mediaByElementId.values()) mediaById.set(record.id, record);

  // Only the owning entries carry bytes; dedup entries reuse the owner's path.
  const owners = ir.assets.entries.filter((e) => e.present && !e.dedupOf);
  let done = 0;

  for (const entry of owners) {
    if (blobs.has(entry.path)) {
      options.onProgress?.(++done, owners.length);
      continue;
    }
    try {
      if (entry.kind === 'frame') {
        const sceneId = frameSceneId(entry.assetId);
        const scene = sceneId ? sceneById.get(sceneId) : undefined;
        if (scene && scene.content.type === 'slide') {
          const slide = (scene.content as SlideContent).canvas;
          blobs.set(entry.path, await renderFrame(slide, records.mediaByElementId, width));
        } else {
          missing.push(entry.path);
        }
      } else if (entry.kind === 'audio') {
        const record = records.audioById.get(entry.assetId);
        const bytes = record?.blob && record.blob.size > 0 ? record.blob : null;
        if (bytes) blobs.set(entry.path, bytes);
        else missing.push(entry.path);
      } else if (entry.kind === 'video' || entry.kind === 'image') {
        const record = mediaById.get(entry.assetId);
        const bytes = record?.blob && record.blob.size > 0 ? record.blob : null;
        if (bytes) blobs.set(entry.path, bytes);
        else missing.push(entry.path);
      } else if (entry.kind === 'poster') {
        const record = mediaById.get(entry.assetId);
        const bytes = record?.poster && record.poster.size > 0 ? record.poster : null;
        if (bytes) blobs.set(entry.path, bytes);
        else missing.push(entry.path);
      }
    } catch {
      missing.push(entry.path);
    }
    options.onProgress?.(++done, owners.length);
  }

  return { blobs, missing };
}
