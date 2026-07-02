import { apiSuccess } from '@/lib/server/api-response';
import { clearSessionCookie } from '@/lib/auth/session-cookie';

export const dynamic = 'force-dynamic';

export async function POST() {
  await clearSessionCookie();
  return apiSuccess({ authenticated: false });
}
