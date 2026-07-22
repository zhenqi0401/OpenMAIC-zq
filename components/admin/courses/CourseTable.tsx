'use client';

import { Button } from '@/components/ui/button';
import { AdminRowActions } from '@/components/admin/AdminRowActions';
import { AdminStatusBadge, adminSecondaryButtonClassName } from '@/components/admin/AdminSurface';
import type { EnterpriseCourse, CourseStatus } from '@/lib/storage/enterprise-service';
import {
  formatCourseUpdatedAt,
  getCourseContentStatus,
  getCourseStatusAction,
  getCourseVisibilitySummary,
} from '@/lib/admin/course-presentation';

function CourseStatusBadge({ status }: { status: CourseStatus }) {
  const view = {
    draft: { label: '草稿', tone: 'warning' },
    published: { label: '已发布', tone: 'success' },
    archived: { label: '已归档', tone: 'neutral' },
  }[status] as {
    label: string;
    tone: 'neutral' | 'success' | 'warning';
  };
  return <AdminStatusBadge tone={view.tone}>{view.label}</AdminStatusBadge>;
}

export function CourseTable({
  courses,
  roleNames,
  statusChangingCourseId,
  onChangeStatus,
  onDelete,
  onEditVisibility,
}: {
  courses: readonly EnterpriseCourse[];
  roleNames: ReadonlyMap<string, string>;
  statusChangingCourseId: string | null;
  onChangeStatus: (course: EnterpriseCourse, action: 'publish' | 'archive') => void;
  onDelete: (course: EnterpriseCourse) => void;
  onEditVisibility: (course: EnterpriseCourse) => void;
}) {
  return (
    <div className="w-full overflow-hidden" data-course-table>
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <caption className="sr-only">
          课程名称、分类、状态、可见范围、学员数、内容状态、最后更新时间和操作
        </caption>
        <colgroup>
          <col className="w-[22%]" />
          <col className="w-[9%]" />
          <col className="w-[9%]" />
          <col className="w-[14%]" />
          <col className="w-[7%]" />
          <col className="w-[12%]" />
          <col className="w-[12%]" />
          <col className="w-[15%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--admin-border)] text-xs font-semibold tracking-[0.04em] text-[var(--admin-muted-foreground)]">
            <th className="px-3 py-3" scope="col">
              课程
            </th>
            <th className="px-2 py-3" scope="col">
              分类
            </th>
            <th className="px-2 py-3" scope="col">
              状态
            </th>
            <th className="px-2 py-3" scope="col">
              可见范围
            </th>
            <th className="px-2 py-3 text-right" scope="col">
              学员数
            </th>
            <th className="px-2 py-3" scope="col">
              内容状态
            </th>
            <th className="px-2 py-3" scope="col">
              最后更新
            </th>
            <th className="px-3 py-3 text-right" scope="col">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => {
            const contentStatus = getCourseContentStatus(course);
            const statusAction = getCourseStatusAction(course);
            const changing = statusChangingCourseId === course.id;
            return (
              <tr
                className="border-b border-[var(--admin-border-subtle)] align-top last:border-b-0"
                key={course.id}
              >
                <td className="min-w-0 px-3 py-3">
                  <div className="break-words font-medium text-[var(--admin-foreground)]">
                    {course.name}
                  </div>
                  {course.description ? (
                    <div className="mt-1 line-clamp-2 break-words text-xs leading-5 text-[var(--admin-muted-foreground)]">
                      {course.description}
                    </div>
                  ) : null}
                </td>
                <td className="break-words px-2 py-3 text-[var(--admin-muted-foreground)]">
                  {course.categoryName ?? '—'}
                </td>
                <td className="px-2 py-3">
                  <CourseStatusBadge status={course.status} />
                </td>
                <td className="break-words px-2 py-3 text-xs leading-5 text-[var(--admin-muted-foreground)]">
                  {getCourseVisibilitySummary(course, roleNames)}
                </td>
                <td className="px-2 py-3 text-right tabular-nums text-[var(--admin-foreground)]">
                  {course.learnerCount ?? 0}
                </td>
                <td className="px-2 py-3">
                  <AdminStatusBadge tone={contentStatus.tone}>
                    {contentStatus.label}
                  </AdminStatusBadge>
                </td>
                <td className="px-2 py-3 text-xs tabular-nums text-[var(--admin-muted-foreground)]">
                  <time dateTime={new Date(course.updatedAt).toISOString()}>
                    {formatCourseUpdatedAt(course.updatedAt)}
                  </time>
                </td>
                <td className="px-3 py-3">
                  <AdminRowActions
                    actions={[
                      {
                        id: statusAction.action,
                        label: changing ? '处理中…' : statusAction.label,
                        disabled: changing,
                        onSelect: () => onChangeStatus(course, statusAction.action),
                      },
                      {
                        id: 'delete',
                        label: '删除',
                        destructive: true,
                        onSelect: () => onDelete(course),
                      },
                    ]}
                    primaryAction={
                      <Button
                        className={adminSecondaryButtonClassName}
                        onClick={() => onEditVisibility(course)}
                        type="button"
                        variant="outline"
                      >
                        修改可见范围
                      </Button>
                    }
                    triggerAriaLabel={`${course.name}的更多操作`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
