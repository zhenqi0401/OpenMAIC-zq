/**
 * @openmaic/render-service — HTTP entrypoint.
 *
 * Renders exported Hyperframes projects to MP4 using `@hyperframes/producer`,
 * isolated in a Node 22 + Chromium + FFmpeg container.
 *
 * The contract is intentionally minimal and fixed for a single-container,
 * in-memory-job/local-artifact deployment:
 *
 *   POST   /render                 multipart: project(zip) + fps/quality/format → 202 { jobId }
 *   GET    /render/:jobId          → { status, progress, currentStage, done, ... }
 *   GET    /render/:jobId/download → stream MP4
 *   DELETE /render/:jobId          → cancel
 *   GET    /health                 → { ok: true }
 *
 * NOTE: this file must NOT be named `server.ts`. `@hyperframes/producer`'s main
 * module auto-starts its own bundled HTTP server (on PRODUCER_PORT, default
 * 9847) as an import side effect when the process entry path ends with
 * `/src/server.ts` or `/public-server.js`. We use the producer as a library, so
 * the entrypoint is `main.ts` to avoid spawning that phantom server.
 */
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { config } from './config.js';
import { InMemoryJobStore } from './job-store.js';
import { LocalDiskArtifactStore } from './artifact-store.js';
import {
  RenderManager,
  RenderRejectedError,
  makeProjectDir as defaultMakeProjectDir,
} from './render-manager.js';
import { InvalidProjectError, unzipProject as defaultUnzipProject } from './unzip.js';
import { capBodyStream } from './capped-stream.js';
import { Semaphore } from './semaphore.js';
import type { JobStore } from './job-store.js';
import type { ArtifactStore } from './artifact-store.js';
import { isTerminal, type RenderOptions } from './types.js';

/** Thrown inside the gated section for an oversized body (→ HTTP 413). */
class UploadTooLargeError extends Error {}
/** Thrown inside the gated section for a malformed request (→ HTTP 400). */
class BadRequestError extends Error {}

/** Collaborators the app depends on; injectable so the routes are testable. */
export interface AppDeps {
  jobs: JobStore;
  artifacts: ArtifactStore;
  manager: RenderManager;
  /** Bounds concurrent *buffering + extraction* (the whole RAM-heavy section). */
  extractionGate: Semaphore;
  /** Extract a validated archive into a dir. Overridable in tests. */
  unzipProject?: (zip: Uint8Array, destDir: string) => Promise<void>;
  /** Create a fresh per-render scratch dir. Overridable in tests. */
  makeProjectDir?: () => Promise<string>;
  /** Raw multipart byte ceiling. Defaults to the production upload limit. */
  maxUploadBytes?: number;
}

/** Parse + validate the multipart render options. Returns options or an error string. */
function parseOptions(form: FormData): RenderOptions | string {
  const fps = Number.parseInt(String(form.get('fps') ?? '30'), 10);
  if (fps !== 30) return 'Unsupported fps (only 30)';

  const quality = String(form.get('quality') ?? 'standard');
  if (quality !== 'standard') return 'Unsupported quality (only standard)';

  const format = String(form.get('format') ?? 'mp4');
  if (format !== 'mp4') return 'Unsupported format (only mp4)';

  return { fps, quality, format };
}

function ownerHeader(value: string | undefined): string | null {
  const owner = value?.trim();
  return owner && owner.length <= 256 ? owner : null;
}

/**
 * Build the render-service HTTP app over injected collaborators.
 *
 * Admission ordering is the security boundary here:
 *  1. `reserve()` (queue + per-identity) runs FIRST, before anything is read —
 *     a rejected caller never buffers a byte.
 *  2. The whole RAM-heavy section — buffering the multipart (`formData()` is
 *     what materializes the uploaded file into memory), parsing, reading the
 *     file bytes, and extracting — runs INSIDE `extractionGate`. So at most
 *     `maxConcurrentExtractions` bodies are ever buffered at once; the rest wait
 *     with their request body still unconsumed (backpressured on the socket),
 *     not held in RAM. This is what stops a near-cap burst from OOMing the box.
 */
export function createApp(deps: AppDeps): Hono {
  const { jobs, artifacts, manager, extractionGate } = deps;
  const unzipProject = deps.unzipProject ?? defaultUnzipProject;
  const makeProjectDir = deps.makeProjectDir ?? defaultMakeProjectDir;
  const maxUploadBytes = deps.maxUploadBytes ?? config.maxUploadBytes;

  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true }));

  app.post('/render', async (c) => {
    // Reject an oversized body by declared length first (courtesy 413 for honest
    // clients). The real bound is the byte-counting cap below, since
    // Content-Length is client-supplied and absent on chunked uploads.
    const declared = Number(c.req.header('content-length') ?? '0');
    if (Number.isFinite(declared) && declared > maxUploadBytes) {
      return c.json({ error: 'Upload too large' }, 413);
    }

    // Identity is derived from the authenticated Next.js session by the trusted
    // app proxy. Browser-supplied multipart identity fields are ignored.
    const identity = ownerHeader(c.req.header('x-openmaic-client'));
    if (!identity) return c.json({ error: 'Missing trusted owner identity' }, 401);

    // Reserve a queue slot BEFORE the buffering permit, so a rejected caller
    // (queue full / per-identity limit) never enters buffering or extraction.
    let reservation;
    try {
      reservation = manager.reserve(identity);
    } catch (error) {
      if (error instanceof RenderRejectedError) return c.json({ error: error.message }, 429);
      throw error;
    }

    // From here every failure MUST release the reservation.
    let projectDir: string | undefined;
    try {
      // The ENTIRE memory-heavy section runs under the extraction permit:
      // buffering the body (formData), reading the file, and unzipping. Requests
      // beyond the permit wait here with their body still unconsumed, so only
      // `maxConcurrentExtractions` bodies are buffered concurrently.
      const jobId = await extractionGate.run(async () => {
        const raw = c.req.raw;
        let form: FormData;
        let capped: ReturnType<typeof capBodyStream> | undefined;
        try {
          if (raw.body) {
            // Cap the raw body as it streams into formData(), so a chunked /
            // length-lying upload can't exceed the byte ceiling mid-parse.
            capped = capBodyStream(raw.body, maxUploadBytes);
            const bounded = new Request(raw.url, {
              method: raw.method,
              headers: raw.headers,
              body: capped.stream,
              // duplex is required for a streaming request body.
              duplex: 'half',
            } as RequestInit);
            form = await bounded.formData();
          } else {
            form = await c.req.formData();
          }
        } catch {
          if (capped?.exceeded()) throw new UploadTooLargeError('Upload too large');
          throw new BadRequestError('Expected multipart/form-data');
        }

        const options = parseOptions(form);
        if (typeof options === 'string') throw new BadRequestError(options);

        const file = form.get('project');
        if (!(file instanceof File)) {
          throw new BadRequestError('Missing "project" file field');
        }

        projectDir = await makeProjectDir();
        const bytes = new Uint8Array(await file.arrayBuffer());
        await unzipProject(bytes, projectDir);
        return manager.submit(reservation, projectDir, options);
      });
      return c.json({ jobId }, 202);
    } catch (error) {
      manager.release(reservation);
      if (projectDir) await manager.cleanupProject(projectDir);
      if (error instanceof UploadTooLargeError) return c.json({ error: error.message }, 413);
      if (error instanceof BadRequestError) return c.json({ error: error.message }, 400);
      if (error instanceof InvalidProjectError) return c.json({ error: error.message }, 400);
      if (error instanceof RenderRejectedError) return c.json({ error: error.message }, 429);
      throw error;
    }
  });

  app.get('/render/:jobId', async (c) => {
    const owner = ownerHeader(c.req.header('x-openmaic-client'));
    if (!owner) return c.json({ error: 'Job not found' }, 404);
    const job = await jobs.get(c.req.param('jobId'));
    if (!job || job.owner !== owner) return c.json({ error: 'Job not found' }, 404);
    return c.json({
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStage: job.currentStage,
      framesRendered: job.framesRendered,
      totalFrames: job.totalFrames,
      error: job.error,
      done: isTerminal(job.status),
    });
  });

  app.delete('/render/:jobId', async (c) => {
    const owner = ownerHeader(c.req.header('x-openmaic-client'));
    if (!owner) return c.json({ error: 'Job not found' }, 404);
    const ok = await manager.cancel(c.req.param('jobId'), owner);
    if (!ok) return c.json({ error: 'Job not found' }, 404);
    return c.json({ cancelled: true });
  });

  app.get('/render/:jobId/download', async (c) => {
    const owner = ownerHeader(c.req.header('x-openmaic-client'));
    if (!owner) return c.json({ error: 'Job not found' }, 404);
    const jobId = c.req.param('jobId');
    const job = await jobs.get(jobId);
    if (!job || job.owner !== owner) return c.json({ error: 'Job not found' }, 404);
    if (job.status !== 'succeeded') {
      return c.json({ error: `Job not ready (status: ${job.status})` }, 409);
    }

    const location = await artifacts.locate(jobId);
    if (!location) return c.json({ error: 'Artifact expired or missing' }, 404);

    const { size } = await stat(location.path).catch(() => ({ size: 0 }));
    if (!size) return c.json({ error: 'Artifact missing on disk' }, 404);

    const webStream = Readable.toWeb(createReadStream(location.path)) as ReadableStream;
    return new Response(webStream, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': String(size),
        'Content-Disposition': `attachment; filename="${jobId}.mp4"`,
        'Cache-Control': 'private, no-store',
      },
    });
  });

  return app;
}

/** Remove scratch directories left behind by a previous abnormal shutdown. */
export async function cleanupOrphanProjects(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  const orphanNames = await readdir(root).catch(() => []);
  await Promise.all(
    orphanNames.map((name) => rm(`${root}/${name}`, { recursive: true, force: true })),
  );
}

/** Wire the production collaborators and start the server (skipped under tests). */
async function main(): Promise<void> {
  const artifacts = new LocalDiskArtifactStore();
  let manager: RenderManager;
  const jobs = new InMemoryJobStore(config.jobTtlMs, (record) => {
    // A reaped job's artifact + project dir go with it.
    void artifacts.remove(record.id);
    void manager.cleanupProject(record.projectDir);
  });
  manager = new RenderManager(jobs, artifacts);

  const app = createApp({
    jobs,
    artifacts,
    manager,
    // Bounds concurrent buffering + extraction so the per-archive RAM ceiling
    // can't stack across a burst of admitted requests.
    extractionGate: new Semaphore(config.maxConcurrentExtractions),
  });

  // Ensure the scratch root exists before accepting work. On the documented
  // standalone path nothing creates /tmp/openmaic-renders, so without this every
  // makeProjectDir() would ENOENT. mktemp still creates a fresh subdir per job.
  await cleanupOrphanProjects(config.tmpDir);

  serve({ fetch: app.fetch, port: config.port }, (info) => {
    // eslint-disable-next-line no-console
    console.log(
      `[render-service] listening on :${info.port} (maxConcurrency=${config.maxConcurrency})`,
    );
  });
}

// Only auto-start when run as the entrypoint, not when imported by tests.
if (process.env.RENDER_SERVICE_NO_LISTEN !== 'true') {
  await main();
}
