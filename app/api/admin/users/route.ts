import { apiSuccess } from '@/lib/server/api-response';
import { getAuthRepository } from '@/lib/auth/repository';
import { createAuthService } from '@/lib/auth/service';
import { requireCurrentAdmin } from '@/lib/auth/current-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const auth = createAuthService(getAuthRepository());
  const users = await auth.listUsers();
  return apiSuccess({ users });
}
