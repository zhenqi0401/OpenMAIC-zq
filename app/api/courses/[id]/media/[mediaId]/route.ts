import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { apiError } from '@/lib/server/api-response';
import { enterpriseErrorResponse, getEnterpriseService } from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

function idsFromRequest(request: Request, context?: { params: Promise<{ id: string; mediaId: string }> }) {
  if (context) return context.params;
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  return Promise.resolve({
    id: parts[2] ?? '',
    mediaId: parts[4] ?? '',
  });
}

export async function GET(
  request: Request,
  context?: { params: Promise<{ id: string; mediaId: string }> },
) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  try {
    const { id, mediaId } = await idsFromRequest(request, context);
    const course = current.identity.isAdmin
      ? await getEnterpriseService().getCourseContent(id)
      : await getEnterpriseService().getVisibleCourse(id, current.identity.roleId);
    if (!course) return apiError('INVALID_REQUEST', 404, 'Course not found');
    const media = await getEnterpriseService().getMediaFileBlob(id, decodeURIComponent(mediaId));
    if (!media) return apiError('INVALID_REQUEST', 404, 'Media not found');
    return new Response(new Uint8Array(media.blob), {
      headers: {
        'Content-Type': media.mimeType ?? 'application/octet-stream',
        'Content-Length': String(media.blob.byteLength),
      },
    });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
