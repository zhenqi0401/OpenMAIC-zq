'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { adminThemeAttributes } from '@/components/admin/admin-theme';
import { AdminMetricCard } from '@/components/admin/AdminPatterns';
import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';

type Analytics = {
  summary: Record<string, number | null>;
  learners: Array<{
    learner?: { displayName?: string; roleCode?: string };
    status: string;
    latestScore: number | null;
    attemptCount: number;
    passed: boolean;
  }>;
  pagination: { total: number };
};

export function CourseAnalyticsDrawer({
  course,
  onOpenChange,
}: {
  course: EnterpriseCourse | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!course) return;
    let active = true;
    const task = window.setTimeout(() => {
      if (!active) return;
      setLoading(true);
      fetch(`/api/admin/courses/${encodeURIComponent(course.id)}/analytics`)
        .then((response) => response.json())
        .then((payload) => active && setData(payload as Analytics))
        .finally(() => active && setLoading(false));
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(task);
    };
  }, [course]);
  const summary = data?.summary;
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(course)}>
      <DialogContent
        {...adminThemeAttributes}
        className="inset-y-0 left-auto right-0 top-0 h-[100dvh] max-h-none w-[min(96vw,760px)] max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none rounded-l-[var(--admin-radius-dialog)] border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-foreground)]"
      >
        <DialogHeader>
          <DialogTitle>课程学习数据 · {course?.name ?? ''}</DialogTitle>
          <DialogDescription>独立开始人数只统计当前租户的非管理员学员。</DialogDescription>
        </DialogHeader>
        {loading && !data ? (
          <p className="py-10 text-sm text-[var(--admin-muted-foreground)]">正在加载学习数据…</p>
        ) : summary ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <AdminMetricCard
                label="独立开始人数"
                value={summary.independentStarted ?? '暂无数据'}
              />
              <AdminMetricCard label="到达课末人数" value={summary.reachedEnd ?? '暂无数据'} />
              <AdminMetricCard
                label="课程完成率"
                value={summary.completionRate === null ? '暂无数据' : `${summary.completionRate}%`}
              />
              <AdminMetricCard
                label="参与测评人数"
                value={summary.assessmentParticipants ?? '暂无数据'}
              />
              <AdminMetricCard
                label="通过测评人数"
                value={summary.assessmentPassed ?? '暂无数据'}
              />
              <AdminMetricCard
                label="测评通过率"
                value={
                  summary.assessmentPassRate === null
                    ? '暂无数据'
                    : `${summary.assessmentPassRate}%`
                }
              />
            </div>
            <h3 className="mt-6 text-base font-medium">学员明细（{data.pagination.total}）</h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--admin-border)]">
                    <th className="p-2">学员</th>
                    <th className="p-2">状态</th>
                    <th className="p-2">最新得分</th>
                    <th className="p-2">测评次数</th>
                  </tr>
                </thead>
                <tbody>
                  {data.learners.map((learner, index) => (
                    <tr
                      className="border-b border-[var(--admin-border-subtle)]"
                      key={`${learner.learner?.displayName ?? 'learner'}-${index}`}
                    >
                      <td className="p-2">{learner.learner?.displayName ?? '—'}</td>
                      <td className="p-2">{learner.status}</td>
                      <td className="p-2">{learner.latestScore ?? '—'}</td>
                      <td className="p-2">{learner.attemptCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="py-10 text-sm text-[var(--admin-muted-foreground)]">暂无学习数据</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
