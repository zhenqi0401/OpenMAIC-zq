import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
  requiredString,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface AudioBody {
  courseId?: string;
  sceneKey?: string | null;
  audioId?: string;
  mimeType?: string | null;
  format?: string | null;
  sizeBytes?: number | null;
  base64?: string;
}

export async function POST(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<AudioBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (
    !requiredString(body.courseId) ||
    !requiredString(body.audioId) ||
    !requiredString(body.base64)
  ) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'courseId, audioId and base64 are required');
  }

  try {
    const blob = Buffer.from(body.base64, 'base64');
    const audio = await getEnterpriseService().createCourseAudioBlob(
      {
        courseId: body.courseId,
        sceneKey: body.sceneKey ?? null,
        audioId: body.audioId,
        mimeType: body.mimeType ?? (body.format ? `audio/${body.format}` : null),
        sizeBytes: body.sizeBytes ?? blob.byteLength,
        blob,
      },
      toTenantAccessContext(admin.identity),
    );
    return apiSuccess({ audio }, 201);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
