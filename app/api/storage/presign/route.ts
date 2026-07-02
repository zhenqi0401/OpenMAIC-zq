import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
  requiredString,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface PresignBody {
  ossKey?: string;
  mimeType?: string;
  expiresInSeconds?: number;
}

export async function POST(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<PresignBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!requiredString(body.ossKey) || !requiredString(body.mimeType)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'ossKey and mimeType are required');
  }

  try {
    const presignedUpload = await getEnterpriseService().createOssPresignedUpload({
      ossKey: body.ossKey,
      mimeType: body.mimeType,
      expiresInSeconds: body.expiresInSeconds,
    });
    return apiSuccess({ presignedUpload });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
