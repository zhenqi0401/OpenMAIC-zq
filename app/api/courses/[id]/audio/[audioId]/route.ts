import { getCurrentAuthResult } from '@/lib/auth/current-session';
import { apiError } from '@/lib/server/api-response';
import { enterpriseErrorResponse, getEnterpriseService } from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

function idsFromRequest(request: Request, context?: { params: Promise<{ id: string; audioId: string }> }) {
  if (context) return context.params;
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  return Promise.resolve({
    id: parts[2] ?? '',
    audioId: parts[4] ?? '',
  });
}

export async function GET(
  request: Request,
  context?: { params: Promise<{ id: string; audioId: string }> },
) {
  const current = await getCurrentAuthResult();
  if (!current) return apiError('INVALID_REQUEST', 401, 'OpenMAIC session required');

  try {
    const { id, audioId } = await idsFromRequest(request, context);
    const course = current.identity.isAdmin
      ? await getEnterpriseService().getCourseContent(id)
      : await getEnterpriseService().getVisibleCourse(id, current.identity.roleId);
    if (!course) return apiError('INVALID_REQUEST', 404, 'Course not found');
    const audio = await getEnterpriseService().getCourseAudioBlob(id, decodeURIComponent(audioId));
    if (!audio) return apiError('INVALID_REQUEST', 404, 'Audio not found');
    return new Response(new Uint8Array(audio.blob), {
      headers: {
        'Content-Type': audio.mimeType ?? 'application/octet-stream',
        'Content-Length': String(audio.blob.byteLength),
      },
    });
  } catch (error) {
    return enterpriseErrorResponse(error);
  }
}
