import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getAuthRepository } from '@/lib/auth/repository';
import { createAuthService } from '@/lib/auth/service';
import { readJsonBody, authErrorResponse } from '@/lib/auth/route-utils';
import { setSessionCookie } from '@/lib/auth/session-cookie';
import { withApiErrorLogging } from '@/lib/server/api-wrapper';
import { getRequestLogger } from '@/lib/server/logger';
import type { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

interface LoginBody {
  phone?: string;
  password?: string;
}

async function login(request: NextRequest) {
  const body = await readJsonBody<LoginBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!body.phone || !body.password) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'phone and password are required');
  }

  try {
    const auth = createAuthService(getAuthRepository());
    const result = await auth.loginWithPassword({ phone: body.phone, password: body.password });
    await setSessionCookie(result.identity);
    return apiSuccess({
      user: {
        id: result.user.id,
        phone: result.user.phone,
        displayName: result.user.displayName,
        role: result.role,
      },
      identity: result.identity,
    });
  } catch (error) {
    getRequestLogger().warn({ event: 'auth_failed', tag: 'auth', operation: 'password_login', err: error, phone: body.phone }, 'Password login failed');
    return authErrorResponse(error);
  }
}

export const POST = withApiErrorLogging(login);
