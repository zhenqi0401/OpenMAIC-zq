import { apiSuccess } from '@/lib/server/api-response';
import { getAuthRepository } from '@/lib/auth/repository';
import { createAuthService } from '@/lib/auth/service';
import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { authErrorResponse } from '@/lib/auth/route-utils';

export const dynamic = 'force-dynamic';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await context.params;
  try {
    const auth = createAuthService(getAuthRepository());
    const user = await auth.deleteUser(id, admin.identity.tenantId);
    return apiSuccess({ user });
  } catch (error) {
    return authErrorResponse(error);
  }
}
