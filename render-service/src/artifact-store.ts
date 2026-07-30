/**
 * ArtifactStore — the seam for where rendered MP4s live and how they're served.
 *
 * The first deployment uses local scratch storage only. The MP4 stays on the
 * service disk and the download route streams it through the Next.js proxy.
 */

export type ArtifactLocation = { kind: 'file'; path: string };

export interface ArtifactStore {
  /** Register the rendered output for a job. */
  put(jobId: string, sourcePath: string): Promise<void>;
  /** Where to fetch the job's artifact, or null if none/expired. */
  locate(jobId: string): Promise<ArtifactLocation | null>;
  /** Drop the artifact (best-effort). */
  remove(jobId: string): Promise<void>;
}

/**
 * Keeps the MP4 where the producer wrote it (the job's own output dir) and
 * hands back its path. No copying — the render already targets a per-job path.
 */
export class LocalDiskArtifactStore implements ArtifactStore {
  private readonly paths = new Map<string, string>();

  async put(jobId: string, sourcePath: string): Promise<void> {
    this.paths.set(jobId, sourcePath);
  }

  async locate(jobId: string): Promise<ArtifactLocation | null> {
    const path = this.paths.get(jobId);
    return path ? { kind: 'file', path } : null;
  }

  async remove(jobId: string): Promise<void> {
    this.paths.delete(jobId);
  }
}
