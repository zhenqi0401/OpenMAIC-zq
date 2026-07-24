import { AdminCard } from '@/components/admin/AdminSurface';
import type { ExamReadiness } from '@/lib/admin/exam-policy-presentation';
import type { AdminExamSummary } from '@/lib/admin/client';

export function ExamReadinessSummary({
  readiness,
  summary,
}: {
  readiness: ExamReadiness;
  summary: AdminExamSummary;
}) {
  const passRate = summary.passRate;
  return (
    <div className="grid gap-4 lg:grid-cols-2" data-exam-readiness-summary>
      <AdminCard className="p-5 sm:p-6">
        <div className="text-lg font-semibold leading-tight text-[var(--admin-foreground)]">
          题库准备度
        </div>
        <p className="mt-1 text-sm text-[var(--admin-muted-foreground)]">
          仅按已发布课程及其现有课后题统计。
        </p>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-[var(--admin-radius-control)] bg-[var(--admin-surface-subtle)] p-4">
            <dt className="text-sm text-[var(--admin-muted-foreground)]">已发布课程</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums">
              {readiness.publishedCourseCount}
            </dd>
          </div>
          <div className="rounded-[var(--admin-radius-control)] bg-[var(--admin-success-background)] p-4">
            <dt className="text-sm text-[var(--admin-success-strong)]">题库已就绪</dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-[var(--admin-success-strong)]">
              {readiness.readyCourseCount}
            </dd>
          </div>
          <div className="rounded-[var(--admin-radius-control)] bg-[var(--admin-warning-background)] p-4">
            <dt className="text-sm text-[var(--admin-warning-strong)]">待补充题目</dt>
            <dd
              className={
                readiness.missingQuestionCourseCount > 0
                  ? 'mt-2 text-2xl font-semibold tabular-nums text-[var(--admin-warning-strong)]'
                  : 'mt-2 text-2xl font-semibold tabular-nums text-[var(--admin-foreground)]'
              }
            >
              {readiness.missingQuestionCourseCount}
            </dd>
          </div>
        </dl>
      </AdminCard>

      <AdminCard className="p-5 sm:p-6" data-exam-global-metrics>
        <div className="text-lg font-semibold leading-tight text-[var(--admin-foreground)]">
          全局考核平均指标
        </div>
        <p className="mt-1 text-sm text-[var(--admin-muted-foreground)]">
          汇总当前真实考核作答记录。
        </p>
        <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row sm:justify-around">
          <div
            className="relative size-28 shrink-0"
            aria-label={`通过率 ${passRate ?? '暂无记录'}`}
          >
            <svg aria-hidden="true" className="size-full -rotate-90" viewBox="0 0 42 42">
              <circle
                cx="21"
                cy="21"
                fill="none"
                pathLength="100"
                r="16"
                stroke="var(--admin-border-subtle)"
                strokeWidth="4"
              />
              {passRate === null ? null : (
                <circle
                  cx="21"
                  cy="21"
                  fill="none"
                  pathLength="100"
                  r="16"
                  stroke="var(--admin-action-primary)"
                  strokeDasharray="100"
                  strokeDashoffset={100 - passRate}
                  strokeLinecap="round"
                  strokeWidth="4"
                />
              )}
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-2xl font-semibold tabular-nums">
                  {passRate === null ? '—' : `${passRate}%`}
                </div>
                <div className="text-xs text-[var(--admin-muted-foreground)]">通过率</div>
              </div>
            </div>
          </div>
          <dl className="grid w-full grid-cols-2 gap-4 sm:max-w-64">
            <div>
              <dt className="text-sm text-[var(--admin-muted-foreground)]">总考核人次</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.examAttemptCount}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-[var(--admin-muted-foreground)]">平均得分</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.averageScore ?? '—'}
              </dd>
            </div>
          </dl>
        </div>
      </AdminCard>
    </div>
  );
}
