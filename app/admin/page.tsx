import { AdminShell } from '@/components/admin/AdminShell';
import { AdminAccessGate } from '@/components/admin/AdminAccessGate';
import { AdminSlice08Panel } from '@/components/admin/AdminSlice08Panel';
import type { AdminModuleId } from '@/components/admin/AdminShell';
import { CourseAdminPanel } from '@/components/admin/courses/CourseAdminPanel';
import { ExamPolicyAdminPanel } from '@/components/admin/exams/ExamPolicyAdminPanel';
import { CommunityAdminPanel } from '@/components/admin/community/CommunityAdminPanel';
import { resolveAdminModuleId, type AdminSearchParams } from '@/lib/admin/module';
import { isDanmakuEnabled, isForumEnabled } from '@/lib/config/feature-flags';

function AdminModuleView({ activeModuleId }: { activeModuleId: AdminModuleId }) {
  if (activeModuleId === 'courses') return <CourseAdminPanel />;
  if (activeModuleId === 'exams') return <ExamPolicyAdminPanel />;
  if (activeModuleId === 'community') return <CommunityAdminPanel />;
  if (activeModuleId === 'access') return <AdminSlice08Panel view="access" />;
  return <AdminSlice08Panel view="dashboard" />;
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
