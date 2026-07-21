import { AdminShell } from '@/components/admin/AdminShell';
import { AdminAccessGate } from '@/components/admin/AdminAccessGate';
import type { AdminModuleId } from '@/components/admin/AdminShell';
import { DashboardAdminPanel } from '@/components/admin/dashboard/DashboardAdminPanel';
import { AccessAdminPanel } from '@/components/admin/access/AccessAdminPanel';
import { CourseAdminPanel } from '@/components/admin/courses/CourseAdminPanel';
import { ExamPolicyAdminPanel } from '@/components/admin/exams/ExamPolicyAdminPanel';
import { CommunityAdminPanel } from '@/components/admin/community/CommunityAdminPanel';
import { resolveAdminModuleId, type AdminSearchParams } from '@/lib/admin/module';
import { isDanmakuEnabled, isForumEnabled } from '@/lib/config/feature-flags';

function AdminModuleView({ activeModuleId }: { activeModuleId: AdminModuleId }) {
  if (activeModuleId === 'dashboard') return <DashboardAdminPanel />;
  if (activeModuleId === 'access') return <AccessAdminPanel />;
  if (activeModuleId === 'courses') return <CourseAdminPanel />;
  if (activeModuleId === 'exams') return <ExamPolicyAdminPanel />;
  if (activeModuleId === 'community') return <CommunityAdminPanel />;
  return <DashboardAdminPanel />;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<AdminSearchParams>;
}) {
  const requestedModuleId = resolveAdminModuleId(await searchParams);
  const activeModuleId =
    requestedModuleId === 'community' && !isDanmakuEnabled() && !isForumEnabled()
      ? 'dashboard'
      : requestedModuleId;

  return (
    <AdminShell activeModuleId={activeModuleId}>
      <AdminAccessGate>
        <AdminModuleView activeModuleId={activeModuleId} />
      </AdminAccessGate>
    </AdminShell>
  );
}
