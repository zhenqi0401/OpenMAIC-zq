'use client';

import { Button } from '@/components/ui/button';
import type { Slide } from '@openmaic/dsl';
import { SlideThumbnail } from '@/components/slide-renderer/SlideThumbnail';
import { BrandLockup } from '@/components/brand/BrandLockup';
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
  previews,
}: {
  courses: readonly EnterpriseCourse[];
  roleNames: ReadonlyMap<string, string>;
  statusChangingCourseId: string | null;
  onChangeStatus: (course: EnterpriseCourse, action: 'publish' | 'archive') => void;
  onDelete: (course: EnterpriseCourse) => void;
  onEditVisibility: (course: EnterpriseCourse) => void;
  previews?: Record<string, { canvas: unknown } | null>;
}) {
  return (
    <div className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3" data-course-card-grid>
      {courses.map((course) => {
        const contentStatus = getCourseContentStatus(course);
        const statusAction = getCourseStatusAction(course);
        const changing = statusChangingCourseId === course.id;
        const slide = previews?.[course.id]?.canvas as Slide | undefined;
        return (
          <article
            className="flex min-w-0 flex-col overflow-hidden rounded-[var(--admin-radius-card)] border border-[var(--admin-border-subtle)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-card)]"
            key={course.id}
          >
            <div className="aspect-video overflow-hidden bg-[var(--admin-surface-subtle)]">
              {slide ? (
                <SlideThumbnail slide={slide} viewportRatio={slide.viewportRatio ?? 0.5625} />
              ) : (
                <div className="grid h-full place-items-center">
                  <BrandLockup variant="compact" />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="break-words font-medium text-[var(--admin-foreground)]">
                    {course.name}
                  </div>
                  {course.description ? (
                    <div className="mt-1 line-clamp-2 break-words text-xs leading-5 text-[var(--admin-muted-foreground)]">
                      {course.description}
                    </div>
                  ) : null}
                </div>
                <CourseStatusBadge status={course.status} />
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs text-[var(--admin-muted-foreground)]">
                <div>
                  <dt>分类</dt>
                  <dd className="mt-1 text-[var(--admin-foreground)]">
                    {course.categoryName ?? '—'}
                  </dd>
                </div>
                <div>
                  <dt>学员数</dt>
                  <dd className="mt-1 tabular-nums text-[var(--admin-foreground)]">
                    {course.learnerCount ?? 0}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt>可见范围</dt>
                  <dd className="mt-1 text-[var(--admin-foreground)]">
                    {getCourseVisibilitySummary(course, roleNames)}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <AdminStatusBadge tone={contentStatus.tone}>{contentStatus.label}</AdminStatusBadge>
                <span className="text-xs tabular-nums text-[var(--admin-muted-foreground)]">
                  <time dateTime={new Date(course.updatedAt).toISOString()}>
                    {formatCourseUpdatedAt(course.updatedAt)}
                  </time>
                </span>
              </div>
              <div className="mt-auto">
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
                  menuModal={false}
                  triggerAriaLabel={`${course.name}的更多操作`}
                />
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
