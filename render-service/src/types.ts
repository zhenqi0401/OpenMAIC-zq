/**
 * Shared types for the render service.
 *
 * The public shape a client sees when polling a job. Deliberately decoupled
 * from `@hyperframes/producer`'s internal `RenderJob` so the HTTP contract
 * (and therefore the app) stays stable if the producer's internals change.
 */

/** Lifecycle of a render job as the app observes it. */
export type RenderJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

/** User-facing render options accepted by `POST /render`. */
export interface RenderOptions {
  /** Integer frames per second. */
  fps: number;
  quality: 'standard';
  /** Only mp4 is supported in this phase; kept explicit for forward-compat. */
  format: 'mp4';
}

/**
 * A render job's observable state. `progress` is 0..1 (producer's native
 * range); the HTTP layer surfaces it as-is and the client scales to a percent.
 */
export interface RenderJobRecord {
  id: string;
  /** Authenticated app user that exclusively owns status, cancel and download access. */
  owner: string;
  status: RenderJobStatus;
  progress: number;
  currentStage: string;
  framesRendered?: number;
  totalFrames?: number;
  error?: string;
  createdAtMs: number;
  updatedAtMs: number;
  /** Absolute path to the unzipped project dir (for cleanup). */
  projectDir: string;
  /** Absolute path to the rendered MP4 once `succeeded`. */
  outputPath?: string;
}

export function isTerminal(status: RenderJobStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled';
}
