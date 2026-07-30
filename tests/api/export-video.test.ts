import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  current: null as null | Response | { identity: { userId: string } },
  health: vi.fn(),
  resolveUrl: vi.fn(),
  proxyFetch: vi.fn(),
}));

vi.mock('@/lib/auth/current-session', () => ({
  requireCurrentAdmin: async () => mocks.current,
}));

vi.mock('@/lib/server/render-service', () => ({
  checkRenderServiceHealth: mocks.health,
  resolveRenderServiceUrl: mocks.resolveUrl,
}));

vi.mock('@/lib/server/proxy-fetch', () => ({
  proxyFetch: mocks.proxyFetch,
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

function admin(userId = 'admin-1') {
  return { identity: { userId } };
}

describe('export-video API authorization and owner forwarding', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.current = admin();
    mocks.health.mockReset().mockResolvedValue(true);
    mocks.resolveUrl.mockReset().mockReturnValue({ url: 'http://render.internal:9000' });
    mocks.proxyFetch.mockReset();
  });

  it('requires an administrator before probing capability and never exposes the service URL', async () => {
    for (const status of [401, 403]) {
      vi.resetModules();
      mocks.current = new Response(status === 401 ? 'unauthorized' : 'forbidden', { status });
      const { GET } = await import('@/app/api/export-video/capability/route');
      const unauthorized = await GET();
      expect(unauthorized.status).toBe(status);
      expect(mocks.health).not.toHaveBeenCalled();
    }

    vi.resetModules();
    mocks.current = admin();
    mocks.health.mockResolvedValue(false);
    const capability = await (await import('@/app/api/export-video/capability/route')).GET();
    const json = await capability.json();
    expect(json).toMatchObject({ enabled: false });
    expect(JSON.stringify(json)).not.toContain('render.internal');
  });

  it('streams multipart upload and derives x-openmaic-client from the verified session', async () => {
    mocks.current = admin('owner-admin');
    mocks.proxyFetch.mockResolvedValue(
      new Response(JSON.stringify({ jobId: 'job-1' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const form = new FormData();
    form.append('project', new Blob(['zip']), 'project.zip');
    form.append('fps', '30');
    form.append('quality', 'standard');
    form.append('format', 'mp4');
    const request = new Request('http://localhost/api/export-video/render', {
      method: 'POST',
      body: form,
    });
    const { POST } = await import('@/app/api/export-video/render/route');
    const response = await POST(request as NextRequest);

    expect(response.status).toBe(202);
    const init = mocks.proxyFetch.mock.calls[0][1] as RequestInit;
    expect(init.body).toBeInstanceOf(ReadableStream);
    expect(new Headers(init.headers).get('x-openmaic-client')).toBe('owner-admin');
    expect(mocks.proxyFetch.mock.calls[0][0]).toBe('http://render.internal:9000/render');
  });

  it('rejects a declared upload over 300 MiB before contacting render-service', async () => {
    const request = new Request('http://localhost/api/export-video/render', {
      method: 'POST',
      headers: {
        'content-type': 'multipart/form-data; boundary=x',
        'content-length': String(300 * 1024 * 1024 + 1),
      },
      body: '--x--',
    });
    const response = await (
      await import('@/app/api/export-video/render/route')
    ).POST(request as NextRequest);
    expect(response.status).toBe(413);
    expect(mocks.proxyFetch).not.toHaveBeenCalled();
  });

  it('forwards the current admin owner for poll, cancel and streaming download', async () => {
    mocks.current = admin('admin-owner-2');
    mocks.proxyFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobId: 'job-2', status: 'running', progress: 0.5 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ cancelled: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'video/mp4', 'content-length': '3' },
        }),
      );

    const context = { params: Promise.resolve({ jobId: 'job-2' }) };
    const request = new Request('http://localhost/api/export-video/render/job-2') as NextRequest;
    const jobRoute = await import('@/app/api/export-video/render/[jobId]/route');
    expect((await jobRoute.GET(request, context)).status).toBe(200);
    expect((await jobRoute.DELETE(request, context)).status).toBe(200);
    const download = await (
      await import('@/app/api/export-video/render/[jobId]/download/route')
    ).GET(request, context);

    expect(download.status).toBe(200);
    expect(download.headers.get('cache-control')).toBe('private, no-store');
    expect(download.headers.get('content-type')).toBe('video/mp4');
    for (const [, init] of mocks.proxyFetch.mock.calls) {
      expect(new Headers((init as RequestInit).headers).get('x-openmaic-client')).toBe(
        'admin-owner-2',
      );
    }
  });
});
