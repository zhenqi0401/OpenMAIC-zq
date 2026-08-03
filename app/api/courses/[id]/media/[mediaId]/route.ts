import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import { apiError } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; mediaId: string }> },
) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  try {
    const { id, mediaId } = await context.params;
    const access = toTenantAccessContext(current.identity);
    const course = current.identity.isAdmin
      ? await getEnterpriseService().getCourseContent(id, access)
      : await getEnterpriseService().getVisibleCourse(id, access);
    if (!course) return apiError('INVALID_REQUEST', 404, 'Course not found');
    const variant = new URL(request.url).searchParams.get('poster') === '1' ? 'poster' : 'media';
    const media = await getEnterpriseService().getMediaFileBlob(
      id,
      decodeURIComponent(mediaId),
      variant,
    );
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
