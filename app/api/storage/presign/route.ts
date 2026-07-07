import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError } from '@/lib/server/api-response';

export const dynamic = 'force-dynamic';

export async function POST() {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  return apiError('INVALID_REQUEST', 410, 'OSS presigned uploads are disabled for course storage');
}
