import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
  readJsonBody,
  requiredString,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

interface MediaBody {
  courseId?: string | null;
  sceneId?: string | null;
  sceneKey?: string | null;
  mediaId?: string;
  mediaType?: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
  prompt?: string | null;
  params?: unknown;
  base64?: string;
  posterBase64?: string | null;
}

export async function GET(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const url = new URL(request.url);
  try {
    const mediaFiles = await getEnterpriseService().listMediaFiles({
      courseId: url.searchParams.get('courseId') ?? undefined,
      sceneId: url.searchParams.get('sceneId') ?? undefined,
    });
    return apiSuccess({ mediaFiles });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  const body = await readJsonBody<MediaBody>(request);
  if (!body) return apiError('INVALID_REQUEST', 400, 'Invalid JSON body');
  if (!requiredString(body.mediaType) || !requiredString(body.mediaId) || !requiredString(body.base64)) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'mediaType, mediaId and base64 are required');
  }

  try {
    const blob = Buffer.from(body.base64, 'base64');
    const posterBlob = body.posterBase64 ? Buffer.from(body.posterBase64, 'base64') : null;
    const mediaFile = await getEnterpriseService().createMediaFile({
      courseId: body.courseId ?? null,
      sceneId: body.sceneId ?? null,
      sceneKey: body.sceneKey ?? null,
      mediaId: body.mediaId,
      mediaType: body.mediaType,
      mimeType: body.mimeType ?? null,
      sizeBytes: body.sizeBytes ?? blob.byteLength,
      prompt: body.prompt ?? null,
      params: body.params ?? null,
      blob,
      posterBlob,
    });
    return apiSuccess({ mediaFile }, 201);
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
