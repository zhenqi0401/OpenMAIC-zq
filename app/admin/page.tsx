import { Shield } from 'lucide-react';
import { AdminSlice08Panel } from '@/components/admin/AdminSlice08Panel';
import { CourseAdminPanel } from '@/components/admin/courses/CourseAdminPanel';
import { ExamPolicyAdminPanel } from '@/components/admin/exams/ExamPolicyAdminPanel';

export default function AdminPage() {
  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-950">
            <Shield className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950 dark:text-slate-50">管理后台</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              看板、角色、邀请码、用户、课程与考核
            </p>
          </div>
        </div>
        <AdminSlice08Panel />
        <CourseAdminPanel />
        <ExamPolicyAdminPanel />
      </div>
    </main>
  );
}
