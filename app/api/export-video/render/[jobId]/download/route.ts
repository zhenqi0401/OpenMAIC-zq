import { NextResponse, type NextRequest } from 'next/server';
import { apiError } from '@/lib/server/api-response';
import { proxyFetch } from '@/lib/server/proxy-fetch';
import { resolveRenderServiceUrl } from '@/lib/server/render-service';
import { createLogger } from '@/lib/logger';
import { requireCurrentAdmin } from '@/lib/auth/current-session';

const log = createLogger('ExportVideo Download API');

export const dynamic = 'force-dynamic';

/**
 * Stream the rendered MP4 back to the browser.
 *
 * The render service uses local scratch storage. This route passes its response
 * body through without buffering the entire MP4 in Next.js memory.
 */
export async function GET(req: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const current = await requireCurrentAdmin();
  if (current instanceof Response) return current;
  const { jobId } = await context.params;
  const resolved = resolveRenderServiceUrl();
  if ('error' in resolved) {
    return apiError('PROVIDER_DISABLED', 501, 'Render service is not configured');
  }

  // Bound only the time to obtain the response headers — NOT the body stream.
  // A total-duration timeout would truncate a large MP4 over a slow connection,
  // so we abort just the initial fetch and clear the timer once headers arrive.
  const controller = new AbortController();
  const headerTimeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const upstream = await proxyFetch(
      `${resolved.url}/render/${encodeURIComponent(jobId)}/download`,
      {
        method: 'GET',
        redirect: 'error',
        headers: { 'x-openmaic-client': current.identity.userId },
        signal: controller.signal,
      },
    );
    clearTimeout(headerTimeout);

    if (!upstream.ok || !upstream.body) {
      const status = upstream.status === 404 || upstream.status === 409 ? upstream.status : 502;
      return apiError('UPSTREAM_ERROR', status, 'Render output not available');
    }

    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        ...(upstream.headers.get('content-length')
          ? { 'Content-Length': upstream.headers.get('content-length')! }
          : {}),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    clearTimeout(headerTimeout);
    log.error(`Failed to download render output ${jobId}:`, error);
    return apiError('UPSTREAM_ERROR', 502, 'Failed to reach render service');
  }
}
