import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getAuthRepository } from '@/lib/auth/repository';
import {
  createAuthService,
  verifyHostSsoExchangeSignature,
  type HostSsoExchangeProfile,
} from '@/lib/auth/service';
import { authErrorResponse, readJsonBody } from '@/lib/auth/route-utils';
import { isSystemCourseCategoryKey } from '@/lib/courses/system-categories';
import {
  getConfiguredOpenMaicPublicUrl,
  HostSsoExchangeReplayError,
  issueHostSsoLoginCode,
} from '@/lib/auth/host-sso-exchange';

export const dynamic = 'force-dynamic';

type ExchangeBody = Partial<HostSsoExchangeProfile>;
const MAX_CLOCK_SKEW_SECONDS = 300;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = await readJsonBody<ExchangeBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (
    typeof body.hostUserId !== 'string' ||
    typeof body.displayName !== 'string' ||
    typeof body.phone !== 'string' ||
    typeof body.companyId !== 'string' ||
    typeof body.companyName !== 'string' ||
    !isSystemCourseCategoryKey(body.categoryKey) ||
    typeof body.timestamp !== 'number' ||
    typeof body.requestId !== 'string'
  ) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'Invalid or missing host SSO exchange fields');
  }
  if (!Number.isSafeInteger(body.timestamp) || !UUID_PATTERN.test(body.requestId)) {
    return apiError('INVALID_REQUEST', 400, 'timestamp or requestId is invalid');
  }
  const payload: HostSsoExchangeProfile = {
    hostUserId: body.hostUserId,
    displayName: body.displayName,
    phone: body.phone,
    companyId: body.companyId,
    companyName: body.companyName,
    categoryKey: body.categoryKey,
    timestamp: body.timestamp,
    requestId: body.requestId,
  };
  const secret = process.env.HOST_SSO_SECRET;
  if (!secret) return apiError('INTERNAL_ERROR', 500, 'HOST_SSO_SECRET is required');
  if (
    !verifyHostSsoExchangeSignature(payload, request.headers.get('x-openmaic-signature'), secret)
  ) {
    return apiError('INVALID_REQUEST', 401, 'Invalid host SSO signature');
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - payload.timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    return apiError('INVALID_REQUEST', 401, 'Expired host SSO request');
  }

  let publicUrl: URL;
  try {
    publicUrl = getConfiguredOpenMaicPublicUrl();
  } catch {
    return apiError('INTERNAL_ERROR', 500, 'YUANWO_PUBLIC_URL is invalid');
  }

  try {
    const result = await createAuthService(getAuthRepository()).loginWithHostSso(payload);
    const exchange = await issueHostSsoLoginCode({
      requestId: payload.requestId,
      userId: result.user.id,
      tenantId: result.identity.tenantId,
      categoryKey: payload.categoryKey,
    });
    const callback = new URL('/api/auth/host-sso/callback', publicUrl);
    callback.searchParams.set('code', exchange.code);
    return apiSuccess({
      loginUrl: callback.toString(),
      expiresAt: exchange.expiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof HostSsoExchangeReplayError) {
      return apiError('INVALID_REQUEST', 409, 'Host SSO exchange request was already used');
    }
    return authErrorResponse(error);
  }
}
