import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getAuthRepository } from '@/lib/auth/repository';
import { createAuthService, verifyHostSsoSignature } from '@/lib/auth/service';
import { readJsonBody, authErrorResponse } from '@/lib/auth/route-utils';
import { setSessionCookie } from '@/lib/auth/session-cookie';

export const dynamic = 'force-dynamic';

interface HostSsoBody {
  hostUserId?: string;
}

export async function POST(request: Request) {
  const body = await readJsonBody<HostSsoBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!body.hostUserId) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'hostUserId is required');
  }

  const secret = process.env.HOST_SSO_SECRET;
  if (!secret) return apiError('INTERNAL_ERROR', 500, 'HOST_SSO_SECRET is required');

  const signature = request.headers.get('x-openmaic-signature');
  if (!verifyHostSsoSignature(body.hostUserId, signature, secret)) {
    return apiError('INVALID_REQUEST', 401, 'Invalid host SSO signature');
  }

  try {
    const auth = createAuthService(getAuthRepository());
    const result = await auth.loginWithHostSso({ hostUserId: body.hostUserId });
    await setSessionCookie(result.identity);
    return apiSuccess({
      user: {
        id: result.user.id,
        hostUserId: result.user.hostUserId,
        displayName: result.user.displayName,
        role: result.role,
      },
      identity: result.identity,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
