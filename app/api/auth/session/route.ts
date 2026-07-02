import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getAuthRepository } from '@/lib/auth/repository';
import { createAuthService } from '@/lib/auth/service';
import { readSessionCookie, getSessionSecret } from '@/lib/auth/session-cookie';
import { resolveSessionIdentity } from '@/lib/auth/session-guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = await readSessionCookie();
  if (!token) return apiSuccess({ authenticated: false });

  const identity = resolveSessionIdentity(token, getSessionSecret());
  if (!identity) return apiSuccess({ authenticated: false });

  try {
    const auth = createAuthService(getAuthRepository());
    const current = await auth.getSessionUser(identity.userId);
    return apiSuccess({
      authenticated: true,
      user: {
        id: current.user.id,
        phone: current.user.phone,
        hostUserId: current.user.hostUserId,
        displayName: current.user.displayName,
        role: current.role,
      },
      identity: { ...current.identity, authSource: identity.authSource },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return apiError('INVALID_REQUEST', 401, 'Invalid session', message);
  }
}
