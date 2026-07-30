/**
 * Integration test for the admission/buffering boundary of `POST /render`.
 *
 * The security property under test (round-3 review P1#1): only
 * `maxConcurrentExtractions` requests may be inside the RAM-heavy section
 * (multipart buffering → file read → extraction) at once. Everything else waits
 * with its body unconsumed, so a burst of near-cap uploads can't stack in memory.
 *
 * We drive the real Hono app (`createApp`) with a fake manager/stores and a
 * `unzipProject` stub that parks — recording how many calls are simultaneously
 * "inside" — so we can assert the peak never exceeds the gate's permit count.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Semaphore } from '../src/semaphore.js';
import type { JobStore } from '../src/job-store.js';
import type { ArtifactStore, ArtifactLocation } from '../src/artifact-store.js';
import type { RenderJobRecord } from '../src/types.js';

vi.mock('@hyperframes/producer', () => ({
  createRenderJob: (options: unknown) => ({ ...((options as object) ?? {}), progress: 0 }),
  executeRenderJob: async () => {},
}));

// Prevent main.ts from binding a port when we import it.
process.env.RENDER_SERVICE_NO_LISTEN = 'true';

// Loaded in beforeAll after the env guard above is set.
let createApp: typeof import('../src/main.js').createApp;
let cleanupOrphanProjects: typeof import('../src/main.js').cleanupOrphanProjects;
let RenderManager: typeof import('../src/render-manager.js').RenderManager;

beforeAll(async () => {
  ({ createApp, cleanupOrphanProjects } = await import('../src/main.js'));
  ({ RenderManager } = await import('../src/render-manager.js'));
});

function fakeJobStore(): JobStore {
  const jobs = new Map<string, RenderJobRecord>();
  return {
    async create(r) {
      jobs.set(r.id, r);
    },
    async get(id) {
      return jobs.get(id) ?? null;
    },
    async update(id, patch) {
      const e = jobs.get(id);
      if (e) jobs.set(id, { ...e, ...patch });
    },
    async remove(id) {
      jobs.delete(id);
    },
    async list() {
      return [...jobs.values()];
    },
    async countActiveForUser() {
      return 0;
    },
  };
}

const fakeArtifacts: ArtifactStore = {
  async put() {},
  async locate(): Promise<ArtifactLocation | null> {
    return null;
  },
  async remove() {},
};

/** Build a valid-looking multipart body for `POST /render`. */
function renderRequest(
  sizeBytes = 4096,
  identity = 'anon',
  options: { fps?: string; quality?: string; format?: string } = {},
): Request {
  const form = new FormData();
  form.append('project', new Blob([new Uint8Array(sizeBytes)]), 'project.zip');
  form.append('fps', options.fps ?? '30');
  form.append('quality', options.quality ?? 'standard');
  form.append('format', options.format ?? 'mp4');
  return new Request('http://test/render', {
    method: 'POST',
    body: form,
    headers: { 'x-openmaic-client': identity },
  });
}

describe('POST /render buffering/extraction bound', () => {
  it('never lets more than the permit count into the buffering+extraction section', async () => {
    const PERMITS = 2;
    const REQUESTS = 5;

    let inside = 0;
    let peak = 0;
    const release: Array<() => void> = [];

    // Each extraction parks until we release it, so all admitted requests pile
    // up at the gate simultaneously — exposing any over-admission.
    const unzipProject = () =>
      new Promise<void>((resolve) => {
        inside++;
        peak = Math.max(peak, inside);
        release.push(() => {
          inside--;
          resolve();
        });
      });

    let n = 0;
    const makeProjectDir = async () => `/tmp/fake-${n++}`;

    const jobs = fakeJobStore();
    // A big per-user cap so all REQUESTS are admitted (we're testing the gate,
    // not the per-identity guard); unique identities would also work.
    const manager = new RenderManager(jobs, fakeArtifacts);
    const app = createApp({
      jobs,
      artifacts: fakeArtifacts,
      manager,
      extractionGate: new Semaphore(PERMITS),
      unzipProject,
      makeProjectDir,
    });

    // Fire all requests with distinct identities so admission never rejects them.
    const inFlight = Array.from({ length: REQUESTS }, (_, i) =>
      app.fetch(renderRequest(4096, `user-${i}`)),
    );

    // Let the event loop settle so every request that CAN enter the gate has.
    await new Promise((r) => setTimeout(r, 50));

    // The invariant: at most PERMITS extractions are parked inside right now.
    expect(inside).toBeLessThanOrEqual(PERMITS);
    expect(peak).toBeLessThanOrEqual(PERMITS);

    // Drain: release parked calls; each release frees a permit for a waiter.
    while (release.length > 0) {
      release.shift()!();
      await new Promise((r) => setTimeout(r, 5));
    }

    const responses = await Promise.all(inFlight);
    // Every request ultimately succeeds (202) once it passes through the gate.
    for (const res of responses) expect(res.status).toBe(202);
    // Peak concurrency never exceeded the permit count across the whole run.
    expect(peak).toBe(PERMITS);
  });
});

describe('render route security contract', () => {
  it('rejects all non-fixed output options', async () => {
    const jobs = fakeJobStore();
    const app = createApp({
      jobs,
      artifacts: fakeArtifacts,
      manager: new RenderManager(jobs, fakeArtifacts),
      extractionGate: new Semaphore(1),
      unzipProject: async () => {},
      makeProjectDir: async () => '/tmp/fixed-options-test',
    });

    expect((await app.fetch(renderRequest(16, 'fps-owner', { fps: '24' }))).status).toBe(400);
    expect((await app.fetch(renderRequest(16, 'quality-owner', { quality: 'high' }))).status).toBe(
      400,
    );
    expect((await app.fetch(renderRequest(16, 'format-owner', { format: 'webm' }))).status).toBe(
      400,
    );
  });

  it('caps actual streamed multipart bytes even without a trusted Content-Length', async () => {
    const jobs = fakeJobStore();
    const app = createApp({
      jobs,
      artifacts: fakeArtifacts,
      manager: new RenderManager(jobs, fakeArtifacts),
      extractionGate: new Semaphore(1),
      unzipProject: async () => {},
      makeProjectDir: async () => '/tmp/body-cap-test',
      maxUploadBytes: 256,
    });
    const request = new Request('http://test/render', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=test-boundary',
        'x-openmaic-client': 'stream-owner',
      },
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(4096));
          controller.close();
        },
      }),
      duplex: 'half',
    } as RequestInit);

    expect((await app.fetch(request)).status).toBe(413);
  });

  it('hides job existence from a different owner for poll, cancel and download', async () => {
    const jobs = fakeJobStore();
    await jobs.create({
      id: 'job-secret',
      owner: 'alice',
      status: 'succeeded',
      progress: 1,
      currentStage: 'complete',
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
      projectDir: '/tmp/job-secret',
      outputPath: '/tmp/job-secret/output.mp4',
    });
    const app = createApp({
      jobs,
      artifacts: fakeArtifacts,
      manager: new RenderManager(jobs, fakeArtifacts),
      extractionGate: new Semaphore(1),
    });
    const headers = { 'x-openmaic-client': 'bob' };

    expect(
      (await app.fetch(new Request('http://test/render/job-secret', { headers }))).status,
    ).toBe(404);
    expect(
      (await app.fetch(new Request('http://test/render/job-secret', { method: 'DELETE', headers })))
        .status,
    ).toBe(404);
    expect(
      (await app.fetch(new Request('http://test/render/job-secret/download', { headers }))).status,
    ).toBe(404);
  });
});

describe('render-service startup cleanup', () => {
  it('removes orphan project directories before listening', async () => {
    const root = await mkdtemp(join(tmpdir(), 'render-startup-'));
    try {
      await mkdir(join(root, 'orphan'));
      await writeFile(join(root, 'orphan', 'partial.mp4'), 'partial');
      await cleanupOrphanProjects(root);
      expect(await readdir(root)).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
