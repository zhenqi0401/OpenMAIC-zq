import { AdminShell } from '@/components/admin/AdminShell';
import { AdminAccessGate } from '@/components/admin/AdminAccessGate';
import { AdminSlice08Panel } from '@/components/admin/AdminSlice08Panel';
import type { AdminModuleId } from '@/components/admin/AdminShell';
import { CourseAdminPanel } from '@/components/admin/courses/CourseAdminPanel';
import { ExamPolicyAdminPanel } from '@/components/admin/exams/ExamPolicyAdminPanel';

type AdminSearchParams = Record<string, string | string[] | undefined>;

const adminModuleIds = new Set<AdminModuleId>(['dashboard', 'courses', 'exams', 'access']);

export function resolveAdminModuleId(searchParams: AdminSearchParams | undefined): AdminModuleId {
  const moduleIdParam = searchParams?.module;
  return typeof moduleIdParam === 'string' && adminModuleIds.has(moduleIdParam as AdminModuleId)
    ? (moduleIdParam as AdminModuleId)
    : 'dashboard';
}

function AdminModuleView({ activeModuleId }: { activeModuleId: AdminModuleId }) {
  if (activeModuleId === 'courses') return <CourseAdminPanel />;
  if (activeModuleId === 'exams') return <ExamPolicyAdminPanel />;
  if (activeModuleId === 'access') return <AdminSlice08Panel view="access" />;
  return <AdminSlice08Panel view="dashboard" />;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<AdminSearchParams>;
}) {
  const activeModuleId = resolveAdminModuleId(await searchParams);

  return (
    <AdminShell activeModuleId={activeModuleId}>
      <AdminAccessGate>
        <AdminModuleView activeModuleId={activeModuleId} />
      </AdminAccessGate>
    </AdminShell>
  );
}
