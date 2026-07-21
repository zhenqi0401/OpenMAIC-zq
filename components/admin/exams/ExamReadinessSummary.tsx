import { AdminCard, AdminStatusBadge } from '@/components/admin/AdminSurface';
import type { ExamReadiness } from '@/lib/admin/exam-policy-presentation';

export function ExamReadinessSummary({ readiness }: { readiness: ExamReadiness }) {
  return (
    <AdminCard className="p-4" data-exam-readiness-summary>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-lg font-normal leading-tight text-[#2b211d]">题库准备摘要</div>
          <p className="mt-1 text-sm text-[#75665d]">仅按已发布课程及其现有课后题统计。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminStatusBadge>已发布课程 {readiness.publishedCourseCount}</AdminStatusBadge>
          <AdminStatusBadge tone="success">有课后题 {readiness.readyCourseCount}</AdminStatusBadge>
          <AdminStatusBadge tone={readiness.missingQuestionCourseCount > 0 ? 'warning' : 'neutral'}>
            缺少课后题 {readiness.missingQuestionCourseCount}
          </AdminStatusBadge>
        </div>
      </div>
    </AdminCard>
  );
}
