import { apiSuccess } from '@/lib/server/api-response';
import { checkRenderServiceHealth } from '@/lib/server/render-service';
import { requireCurrentAdmin } from '@/lib/auth/current-session';

export const dynamic = 'force-dynamic';

/**
 * Report whether one-click MP4 export is available. "Available" means the
 * service is configured AND its `/health` responds — so a configured-but-absent
 * service (e.g. RENDER_SERVICE_URL set but the container not started) reports
 * disabled and the MP4 action is unavailable. Never leaks the service URL.
 */
export async function GET() {
  const current = await requireCurrentAdmin();
  if (current instanceof Response) return current;
  const enabled = await checkRenderServiceHealth();
  return apiSuccess({ enabled });
}
