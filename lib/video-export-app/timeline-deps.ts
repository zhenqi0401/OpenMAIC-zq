'use client';

import type { PPTElement } from '@openmaic/dsl';
import type { PlayVideoAction, SpeechAction } from '@/lib/types/action';
import { collectAudioFiles } from '@/lib/export/classroom-zip-utils';
import { createProxiedFetch } from '@/lib/export/proxied-fetch';
import { isMediaPlaceholder, useMediaGenerationStore } from '@/lib/store/media-generation';
import type { Scene } from '@/lib/types/stage';
import { db, type AudioFileRecord, type MediaFileRecord } from '@/lib/utils/database';
import type { AssetMeta, AssetSource, CompilerScene, TimingProbe } from '@/lib/video-export';

const PROBE_TIMEOUT_MS = 10_000;
const PROBE_CONCURRENCY = 6;
const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

export interface ResolvedVideoMedia {
  id: string;
  type: 'image' | 'video';
  blob: Blob;
  mimeType: string;
  poster?: Blob;
}

export interface VideoTimelineRecords {
  audioById: Map<string, AudioFileRecord>;
  mediaByElementId: Map<string, ResolvedVideoMedia>;
  videoDurationMsByElementId: Map<string, number>;
}

export interface VideoTimelineDeps {
  timing: TimingProbe;
  assets: AssetSource;
  records: VideoTimelineRecords;
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

function probeDurationMs(kind: 'audio' | 'video', blob: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const media = document.createElement(kind);
    media.preload = 'metadata';
    let settled = false;
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      media.removeAttribute('src');
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), PROBE_TIMEOUT_MS);
    media.onloadedmetadata = () =>
      finish(Number.isFinite(media.duration) ? Math.round(media.duration * 1000) : null);
    media.onerror = () => finish(null);
    media.src = url;
  });
}

function strippedMediaId(record: MediaFileRecord): string {
  return record.id.includes(':') ? record.id.split(':').slice(1).join(':') : record.id;
}

function mediaReference(element: Record<string, unknown>): string | null {
  const mediaRef = typeof element.mediaRef === 'string' ? element.mediaRef : null;
  if (mediaRef) return mediaRef;
  const src = typeof element.src === 'string' ? element.src : null;
  return src && isMediaPlaceholder(src) ? src : null;
}

function toResolvedMedia(record: MediaFileRecord): ResolvedVideoMedia | null {
  if (record.error || record.blob.size === 0) return null;
  return {
    id: record.id,
    type: record.type,
    blob: record.blob.type ? record.blob : new Blob([record.blob], { type: record.mimeType }),
    mimeType: record.mimeType,
    poster: record.poster,
  };
}

async function readResponseBlob(
  response: Response,
  expected: 'image' | 'video',
): Promise<Blob | null> {
  if (!response.ok) return null;
  const contentType = (response.headers.get('content-type') || '').split(';', 1)[0].toLowerCase();
  if (!contentType.startsWith(`${expected}/`)) return null;
  const declared = Number(response.headers.get('content-length') || '');
  if (Number.isFinite(declared) && declared > MAX_MEDIA_BYTES) return null;
  const blob = await response.blob();
  return blob.size > 0 && blob.size <= MAX_MEDIA_BYTES
    ? blob.type
      ? blob
      : new Blob([blob], { type: contentType })
    : null;
}

async function resolveElementMedia(
  element: Record<string, unknown>,
  localByRef: Map<string, MediaFileRecord>,
  serverCourseId?: string,
): Promise<ResolvedVideoMedia | null> {
  const elementId = typeof element.id === 'string' ? element.id : '';
  const ref = mediaReference(element) ?? elementId;
  const local = localByRef.get(ref) ?? localByRef.get(elementId);
  const localResolved = local ? toResolvedMedia(local) : null;
  if (localResolved) return localResolved;

  const task = useMediaGenerationStore.getState().tasks[ref];
  if (task?.status === 'done' && task.objectUrl) {
    try {
      const blob = await readResponseBlob(await fetch(task.objectUrl), task.type);
      if (blob) {
        const poster = task.poster
          ? await fetch(task.poster)
              .then((response) => readResponseBlob(response, 'image'))
              .catch(() => null)
          : null;
        return {
          id: ref,
          type: task.type,
          blob,
          mimeType: blob.type,
          ...(poster ? { poster } : {}),
        };
      }
    } catch {
      // Fall through to the enterprise/safe-remote sources.
    }
  }

  const kind = element.type === 'video' ? 'video' : 'image';
  if (serverCourseId && ref) {
    try {
      const url = `/api/courses/${encodeURIComponent(serverCourseId)}/media/${encodeURIComponent(ref)}`;
      const blob = await readResponseBlob(await fetch(url, { credentials: 'same-origin' }), kind);
      if (blob) return { id: ref, type: kind, blob, mimeType: blob.type };
    } catch {
      // Missing enterprise media is represented as a compiler diagnostic.
    }
  }

  const src = typeof element.src === 'string' ? element.src : '';
  if (kind === 'image' && /^https?:\/\//i.test(src)) {
    try {
      const blob = await readResponseBlob(await createProxiedFetch()(src), 'image');
      if (blob) return { id: `remote:${elementId}`, type: 'image', blob, mimeType: blob.type };
    } catch {
      // SSRF, MIME and size failures deliberately degrade to the original frame.
    }
  }

  return null;
}

export async function createVideoTimelineDeps(input: {
  stage: { id: string; serverCourseId?: string };
  scenes: Scene[];
}): Promise<VideoTimelineDeps> {
  const audioResult = await collectAudioFiles(input.scenes);
  const audioById = new Map(audioResult.files.map((file) => [file.record.id, file.record]));

  const localRecords = await db.mediaFiles.where('stageId').equals(input.stage.id).toArray();
  const localByRef = new Map<string, MediaFileRecord>();
  for (const record of localRecords) localByRef.set(strippedMediaId(record), record);

  const elements: Array<{ sceneId: string; element: PPTElement }> = [];
  for (const scene of input.scenes) {
    if (scene.type !== 'slide' || scene.content.type !== 'slide') continue;
    for (const element of scene.content.canvas.elements) {
      if (element.type === 'image' || element.type === 'video') {
        elements.push({ sceneId: scene.id, element });
      }
    }
  }

  const mediaByElementId = new Map<string, ResolvedVideoMedia>();
  await mapWithConcurrency(elements, PROBE_CONCURRENCY, async ({ element }) => {
    const media = await resolveElementMedia(
      element as unknown as Record<string, unknown>,
      localByRef,
      input.stage.serverCourseId,
    );
    if (media) mediaByElementId.set(element.id, media);
  });

  const audioDurationMsById = new Map<string, number>();
  await mapWithConcurrency([...audioById], PROBE_CONCURRENCY, async ([id, record]) => {
    if (record.blob.size === 0) return;
    const duration = await probeDurationMs('audio', record.blob);
    if (duration != null) audioDurationMsById.set(id, duration);
  });

  const videoDurationMsByElementId = new Map<string, number>();
  await mapWithConcurrency([...mediaByElementId], PROBE_CONCURRENCY, async ([elementId, media]) => {
    if (media.type !== 'video') return;
    const duration = await probeDurationMs('video', media.blob);
    if (duration != null) videoDurationMsByElementId.set(elementId, duration);
  });

  const timing: TimingProbe = {
    audioDurationMs(action: SpeechAction): number | null {
      if (!action.audioId) return null;
      return (
        audioDurationMsById.get(action.audioId) ??
        (typeof audioById.get(action.audioId)?.duration === 'number'
          ? Math.round(audioById.get(action.audioId)!.duration! * 1000)
          : null)
      );
    },
    videoDurationMs(action: PlayVideoAction): number | null {
      return videoDurationMsByElementId.get(action.elementId) ?? null;
    },
  };

  const assets: AssetSource = {
    audio(action: SpeechAction): AssetMeta | null {
      if (!action.audioId) return null;
      const record = audioById.get(action.audioId);
      if (!record) return { id: action.audioId, present: false };
      return {
        id: action.audioId,
        mimeType: record.blob.type || undefined,
        format: record.format,
        durationMs: audioDurationMsById.get(action.audioId),
        present: record.blob.size > 0,
      };
    },
    media(elementId: string, _scene: CompilerScene): AssetMeta | null {
      const record = mediaByElementId.get(elementId);
      if (!record) return null;
      return {
        id: record.id,
        mimeType: record.mimeType,
        format: record.mimeType.split('/')[1],
        durationMs: videoDurationMsByElementId.get(elementId),
        present: record.blob.size > 0,
      };
    },
  };

  return {
    timing,
    assets,
    records: { audioById, mediaByElementId, videoDurationMsByElementId },
  };
}
