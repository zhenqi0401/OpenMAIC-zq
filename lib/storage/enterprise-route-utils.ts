import { apiError } from '@/lib/server/api-response';
import { EnterpriseStorageServiceError } from './enterprise-service';
import { getEnterpriseRepository } from './enterprise-repository';
import { createEnterpriseStorageService } from './enterprise-service';
import { extractBearerToken } from '@/lib/host-api/access';
import { normalizeHostQueryFilters, type HostQueryFilters } from '@/lib/host-api/types';

export function getEnterpriseService() {
  return createEnterpriseStorageService(getEnterpriseRepository());
}

export async function readJsonBody<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function enterpriseErrorResponse(error: unknown) {
  if (error instanceof EnterpriseStorageServiceError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'FORBIDDEN'
          ? 403
          : error.code === 'CONFLICT'
            ? 409
            : error.code === 'HOST_API_UNAUTHORIZED'
              ? 401
              : error.code === 'STORAGE_UNAVAILABLE'
                ? 503
                : 400;
    return apiError('INVALID_REQUEST', status, error.message);
  }
  const message = error instanceof Error ? error.message : String(error);
  return apiError('INTERNAL_ERROR', 500, 'Enterprise storage operation failed', message);
}

export function requiredString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function getHostToken(request: Request): string | null {
  return extractBearerToken({
    authorization: request.headers.get('authorization') ?? undefined,
    xOpenmaicKey: request.headers.get('x-openmaic-key') ?? undefined,
  });
}

export function getHostFilters(request: Request): HostQueryFilters {
  const url = new URL(request.url);
  const input: HostQueryFilters = {
    courseId: url.searchParams.get('courseId') ?? undefined,
    roleId: url.searchParams.get('roleId') ?? undefined,
    userId: url.searchParams.get('userId') ?? undefined,
    from: url.searchParams.get('from') ?? undefined,
    to: url.searchParams.get('to') ?? undefined,
    page: url.searchParams.has('page') ? Number(url.searchParams.get('page')) : undefined,
    pageSize: url.searchParams.has('pageSize')
      ? Number(url.searchParams.get('pageSize'))
      : undefined,
  };
  return normalizeHostQueryFilters(input);
}

export async function getRouteId(
  request: Request,
  context?: { params: Promise<{ id: string }> },
): Promise<string> {
  if (context) {
    const params = await context.params;
    return params.id;
  }
  const url = new URL(request.url);
  const parts = url.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}
