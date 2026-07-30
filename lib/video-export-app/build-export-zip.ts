'use client';

/**
 * `buildExportZip` — the shared prefix of both video-export paths.
 *
 * Runs the whole browser-side pipeline up to (and including) the self-contained
 * ZIP: load DI deps (Dexie durations + asset presence) → pure-compile to the
 * `VideoTimeline` IR → emit the Hyperframes project text → collect asset bytes
 * (slide snapshots + narration/media) → package the ZIP.
 *
 * The result is an internal transport artifact uploaded directly to the render
 * service; it is not exposed as a user-facing ZIP download.
 *
 * App-side / impure: reads the store + Dexie and does IO.
 */
import {
  compileVideoTimeline,
  emitHyperframes,
  prepareVideoExportScenes,
} from '@/lib/video-export';
import { useStageStore } from '@/lib/store';
import { db } from '@/lib/utils/database';
import { createVideoTimelineDeps } from './timeline-deps';
import { collectVideoAssets } from './collect';
import { packageVideoZip } from './package-zip';

export const VIDEO_EXPORT_SETTINGS = {
  width: 1920,
  height: 1080,
  fps: 30,
  quality: 'standard',
  format: 'mp4',
} as const;

export interface BuildExportZipResult {
  zipBlob: Blob;
  stageName: string;
  /** Number of asset-plan entries whose bytes couldn't be produced. */
  missingCount: number;
  /** Non-info diagnostics from the compiler. */
  errorCount: number;
}

export class NoScenesError extends Error {}

/**
 * Build the export ZIP for the current stage at the given resolution. Throws
 * {@link NoScenesError} when there's nothing to export.
 */
export async function buildExportZip(): Promise<BuildExportZipResult> {
  const { stage, scenes } = useStageStore.getState();
  if (!stage?.id) {
    throw new NoScenesError('No scenes to export');
  }

  const prepared = prepareVideoExportScenes(scenes);
  if (prepared.scenes.length === 0) {
    throw new NoScenesError('No slide scenes to export');
  }
  const { width, height } = VIDEO_EXPORT_SETTINGS;

  const latest = await db.stages.get(stage.id).catch(() => undefined);
  const stageName = latest?.name || stage.name || 'classroom';

  // 1. DI deps (Dexie durations + asset presence) → 2. pure compile to IR.
  const deps = await createVideoTimelineDeps({
    stage: {
      id: stage.id,
      serverCourseId: (stage as { serverCourseId?: string }).serverCourseId,
    },
    scenes: prepared.scenes,
  });
  const ir = compileVideoTimeline(
    {
      stage: { id: stage.id, name: stageName },
      scenes: prepared.scenes,
      diagnostics: prepared.report.diagnostics,
    },
    deps,
  );

  // 3. emit the Hyperframes project text.
  const project = emitHyperframes(ir, { width, height });

  // 4. collect asset bytes (slide snapshots + narration/media).
  const { blobs, missing } = await collectVideoAssets(ir, prepared.scenes, deps.records, {
    frameWidth: width,
  });

  // 5. package the self-contained ZIP.
  const zipBlob = await packageVideoZip(project, blobs);

  const errorCount = ir.diagnostics.filter((d) => d.severity !== 'info').length;
  return { zipBlob, stageName, missingCount: missing.length, errorCount };
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_') || 'classroom';
}
