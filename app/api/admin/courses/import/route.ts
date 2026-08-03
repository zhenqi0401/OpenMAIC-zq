import { requireCurrentAdmin } from '@/lib/auth/current-session';
import { toTenantAccessContext } from '@/lib/auth/types';
import {
  ENTERPRISE_COURSE_IMPORT_LIMITS,
  EnterpriseCourseImportError,
} from '@/lib/import/enterprise-course-import';
import { parseEnterpriseCourseZip } from '@/lib/import/enterprise-course-zip';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import {
  enterpriseErrorResponse,
  getEnterpriseService,
} from '@/lib/storage/enterprise-route-utils';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const admin = await requireCurrentAdmin();
  if (admin instanceof Response) return admin;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Invalid multipart form data');
  }
  const file = formData.get('file');
  const categoryId = formData.get('categoryId');
  if (!(file instanceof File) || typeof categoryId !== 'string' || !categoryId.trim()) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'file and categoryId are required');
  }
  if (file.size === 0 || file.size > ENTERPRISE_COURSE_IMPORT_LIMITS.archiveBytes) {
    return apiError('INVALID_REQUEST', 413, 'Course ZIP size is invalid');
  }
  if (!file.name.toLowerCase().endsWith('.zip')) {
    return apiError('INVALID_REQUEST', 400, 'Only .maic.zip or .zip files are supported');
  }

  try {
    const prepared = await parseEnterpriseCourseZip(new Uint8Array(await file.arrayBuffer()));
    const result = await getEnterpriseService().importEnterpriseCourse(
      {
        ...prepared,
        categoryId: categoryId.trim(),
        createdBy: admin.user.id,
      },
      toTenantAccessContext(admin.identity),
    );
    return apiSuccess({ course: result.course, warnings: result.warnings }, 201);
  } catch (error) {
    if (error instanceof EnterpriseCourseImportError) {
      return apiError('INVALID_REQUEST', 400, error.message);
    }
    return enterpriseErrorResponse(error);
  }
}
