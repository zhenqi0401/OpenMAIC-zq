import type { AdminModuleId } from '@/components/admin/AdminShell';

export type AdminSearchParams = Record<string, string | string[] | undefined>;

const adminModuleIds = new Set<AdminModuleId>([
  'dashboard',
  'courses',
  'exams',
  'community',
  'access',
]);

export function resolveAdminModuleId(searchParams: AdminSearchParams | undefined): AdminModuleId {
  const moduleIdParam = searchParams?.module;
  return typeof moduleIdParam === 'string' && adminModuleIds.has(moduleIdParam as AdminModuleId)
    ? (moduleIdParam as AdminModuleId)
    : 'dashboard';
}
