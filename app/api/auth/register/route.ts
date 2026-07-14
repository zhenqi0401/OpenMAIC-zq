import { apiError, apiSuccess } from '@/lib/server/api-response';
import { getAuthRepository } from '@/lib/auth/repository';
import { createAuthService } from '@/lib/auth/service';
import { readJsonBody, authErrorResponse } from '@/lib/auth/route-utils';
import { setSessionCookie } from '@/lib/auth/session-cookie';

export const dynamic = 'force-dynamic';

interface RegisterBody {
  name?: string;
  phone?: string;
  password?: string;
  inviteCode?: string;
}

export async function POST(request: Request) {
  const body = await readJsonBody<RegisterBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!body.name || !body.phone || !body.password || !body.inviteCode) {
    return apiError(
      'MISSING_REQUIRED_FIELD',
      400,
      'name, phone, password and inviteCode are required',
    );
  }

  try {
    const auth = createAuthService(getAuthRepository());
    const result = await auth.registerWithPassword({
      name: body.name,
      phone: body.phone,
      password: body.password,
      inviteCode: body.inviteCode,
    });
    await setSessionCookie(result.identity);

    return apiSuccess(
      {
        user: {
          id: result.user.id,
          phone: result.user.phone,
          displayName: result.user.displayName,
          role: result.role,
        },
        identity: result.identity,
      },
      201,
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
