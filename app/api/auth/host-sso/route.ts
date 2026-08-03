import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getAuthRepository } from '@/lib/auth/repository';
import { createAuthService, verifyHostSsoSignature, type HostSsoProfile } from '@/lib/auth/service';
import { readJsonBody, authErrorResponse } from '@/lib/auth/route-utils';
import { setSessionCookie } from '@/lib/auth/session-cookie';

export const dynamic = 'force-dynamic';

type HostSsoBody = Partial<HostSsoProfile>;

const HOST_SSO_MAX_CLOCK_SKEW_SECONDS = 5 * 60;

export async function POST(request: Request) {
  const body = await readJsonBody<HostSsoBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (
    typeof body.hostUserId !== 'string' ||
    typeof body.displayName !== 'string' ||
    typeof body.phone !== 'string' ||
    typeof body.companyId !== 'string' ||
    typeof body.companyName !== 'string' ||
    typeof body.timestamp !== 'number'
  ) {
    return apiError(
      'MISSING_REQUIRED_FIELD',
      400,
      'hostUserId, displayName, phone, companyId, companyName and timestamp are required',
    );
  }
  if (!Number.isSafeInteger(body.timestamp)) {
    return apiError('INVALID_REQUEST', 400, 'timestamp must be a Unix timestamp in seconds');
  }

  const payload: HostSsoProfile = {
    hostUserId: body.hostUserId,
    displayName: body.displayName,
    phone: body.phone,
    companyId: body.companyId,
    companyName: body.companyName,
    timestamp: body.timestamp,
  };

  const secret = process.env.HOST_SSO_SECRET;
  if (!secret) return apiError('INTERNAL_ERROR', 500, 'HOST_SSO_SECRET is required');

  const signature = request.headers.get('x-openmaic-signature');
  if (!verifyHostSsoSignature(payload, signature, secret)) {
    return apiError('INVALID_REQUEST', 401, 'Invalid host SSO signature');
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - body.timestamp) > HOST_SSO_MAX_CLOCK_SKEW_SECONDS) {
    return apiError('INVALID_REQUEST', 401, 'Expired host SSO request');
  }

  try {
    const auth = createAuthService(getAuthRepository());
    const result = await auth.loginWithHostSso(payload);
    await setSessionCookie(result.identity);
    return apiSuccess({
      user: {
        id: result.user.id,
        hostUserId: result.user.hostUserId,
        displayName: result.user.displayName,
        phone: result.user.phone,
        role: result.role,
      },
      identity: result.identity,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
