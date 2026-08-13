'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { adminToast } from '@/lib/admin/toast';
import {
  AdminCard,
  AdminPage,
  AdminSectionHeader,
  adminSecondaryButtonClassName,
  adminPrimaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { AdminDeleteDialog } from '@/components/admin/AdminDeleteDialog';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Button } from '@/components/antd/AntdButton';
import Link from 'next/link';
import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';
import type { AuthRole } from '@/lib/auth/service';
import { createAdminClient, type AdminPagination as Pagination } from '@/lib/admin/client';
import {
  buildCourseVisibilityRequest,
  DEFAULT_COURSE_ADMIN_FILTERS,
  getCourseContentStatus,
  type CourseAdminFilters,
  type CourseAdminStatusFilter,
} from '@/lib/admin/course-presentation';
import { CategoryDialog } from './CategoryDialog';
import { CourseFilters } from './CourseFilters';
import { CourseTable } from './CourseTable';
import { CourseEditDialog } from './CourseEditDialog';
import { CourseVisibilityDialog, type CourseVisibilityDraft } from './CourseVisibilityDialog';
import { EnterpriseCourseImportDialog } from './EnterpriseCourseImportDialog';
import { CourseAnalyticsDrawer } from './CourseAnalyticsDrawer';

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  scope?: 'platform' | 'tenant';
  managementMode?: 'editable' | 'read_only';
  categoryKey?: string | null;
  isSystem?: boolean;
}

export {
  DEFAULT_COURSE_ADMIN_FILTERS,
  filterAdminCourses,
  shouldApplyCourseAdminFilters,
} from '@/lib/admin/course-presentation';
export type { CourseAdminFilters };

export function courseGenerationStatusLabel(course: EnterpriseCourse): string | null {
  if (course.generationComplete !== false) return null;
  return getCourseContentStatus(course).label;
}

export function courseDeleteConfirmationMessage(course: Pick<EnterpriseCourse, 'name'>): string {
  return `确认删除课程「${course.name}」？该操作会同时删除这门课程在数据库中的内容、学习进度和测评记录，且不可恢复。`;
}

export function CourseDeleteDialog({
  course,
  deleting,
  defaultOpen,
  onDelete,
}: {
  course: EnterpriseCourse;
  deleting: boolean;
  defaultOpen?: boolean;
  onDelete: (course: EnterpriseCourse) => void;
}) {
  return (
    <AdminDeleteDialog
      defaultOpen={defaultOpen}
      deleting={deleting}
      description={courseDeleteConfirmationMessage(course)}
      onDelete={() => onDelete(course)}
      title="删除课程"
    />
  );
}

export function CourseListEmptyState({
  hasCourses,
  onClear,
}: {
  hasCourses: boolean;
  onClear: () => void;
}) {
  if (!hasCourses) {
    return (
      <div className="p-4">
        <AdminEmptyState
          action={
            <Button asChild className={adminPrimaryButtonClassName}>
              <Link href="/">返回首页生成或导入课程</Link>
            </Button>
          }
          description="课程可从首页生成或在课程管理中导入，之后在这里配置发布与可见范围。"
          title="暂无课程"
        />
      </div>
    );
  }

  return (
    <div className="p-4">
      <AdminEmptyState
        action={
          <Button
            className={adminSecondaryButtonClassName}
            onClick={onClear}
            type="button"
            variant="outline"
          >
            清除筛选
          </Button>
        }
        kind="filtered"
        title="没有符合当前筛选条件的课程"
      />
    </div>
  );
}

export function CourseAdminPanel() {
  const client = useMemo(() => createAdminClient(), []);
  const [roles, setRoles] = useState<AuthRole[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<EnterpriseCourse[]>([]);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryBusyId, setCategoryBusyId] = useState<string | null>(null);
  const [visibilityCourse, setVisibilityCourse] = useState<EnterpriseCourse | null>(null);
  const [analyticsCourse, setAnalyticsCourse] = useState<EnterpriseCourse | null>(null);
  const [editingCourse, setEditingCourse] = useState<EnterpriseCourse | null>(null);
  const [savingCourse, setSavingCourse] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [statusChangingCourseId, setStatusChangingCourseId] = useState<string | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<EnterpriseCourse | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CourseAdminFilters>(DEFAULT_COURSE_ADMIN_FILTERS);
  const [coursePage, setCoursePage] = useState(1);
  const [coursePagination, setCoursePagination] = useState<Pagination>({
    page: 1,
    pageSize: 12,
    total: 0,
    totalPages: 1,
  });
  const [previews, setPreviews] = useState<Record<string, { canvas: unknown } | null>>({});
  const [importOpen, setImportOpen] = useState(false);

  const learnerRoles = useMemo(() => roles.filter((role) => !role.isAdmin), [roles]);
  const roleNames = useMemo(
    () => new Map(learnerRoles.map((role) => [role.id, role.name])),
    [learnerRoles],
  );
  const loadAll = useCallback(
    async (notify = false) => {
      try {
        const [rolesResult, categoriesResult, courseResult] = await Promise.allSettled([
          fetch('/api/admin/roles'),
          fetch('/api/admin/categories'),
          client.queryCourses({
            q: filters.query || undefined,
            status: filters.status,
            categoryId: filters.categoryId || undefined,
            visibilityMode: filters.visibilityMode,
            page: coursePage,
            pageSize: 12,
            sort: 'updatedAt:desc',
          }),
        ]);
        if (courseResult.status === 'rejected') throw courseResult.reason;
        setCourses(courseResult.value.items);
        setCoursePagination(courseResult.value.pagination);

        if (rolesResult.status === 'fulfilled' && rolesResult.value.ok) {
          const rolesData = (await rolesResult.value.json()) as { roles: AuthRole[] };
          setRoles(rolesData.roles);
        }
        if (categoriesResult.status === 'fulfilled' && categoriesResult.value.ok) {
          const categoriesData = (await categoriesResult.value.json()) as {
            categories: Category[];
          };
          setCategories(categoriesData.categories);
        }
        try {
          const previewResult = await client.getCoursePreviews(
            courseResult.value.items.map((course) => course.id),
          );
          setPreviews(previewResult.previews);
        } catch {
          setPreviews({});
        }
        if (notify) adminToast.success('课程列表已刷新');
      } catch {
        adminToast.error('课程后台加载失败');
      }
    },
    [client, coursePage, filters],
  );

  useEffect(() => {
    queueMicrotask(() => void loadAll());
  }, [loadAll]);

  async function createCategory(categoryName: string): Promise<boolean> {
    setCreatingCategory(true);
    try {
      const response = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: categoryName }),
      });
      if (!response.ok) {
        adminToast.error('分类创建失败');
        return false;
      }
      adminToast.success('分类已创建');
      await loadAll();
      return true;
    } finally {
      setCreatingCategory(false);
    }
  }

  async function renameCategory(id: string, name: string): Promise<boolean> {
    setCategoryBusyId(id);
    try {
      const response = await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error();
      adminToast.success('分类已重命名');
      await loadAll();
      return true;
    } catch {
      adminToast.error('分类重命名失败');
      return false;
    } finally {
      setCategoryBusyId(null);
    }
  }

  async function reorderCategories(categoryIds: string[]): Promise<boolean> {
    setCategoryBusyId('reorder');
    try {
      const response = await fetch('/api/admin/categories/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryIds }),
      });
      if (!response.ok) throw new Error();
      adminToast.success('分类顺序已保存');
      await loadAll();
      return true;
    } catch {
      adminToast.error('分类排序失败');
      return false;
    } finally {
      setCategoryBusyId(null);
    }
  }

  async function deleteCategory(id: string): Promise<boolean> {
    setCategoryBusyId(id);
    try {
      const response = await fetch(`/api/admin/categories/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || '分类删除失败');
      }
      adminToast.success('分类已删除');
      await loadAll();
      return true;
    } catch (error) {
      adminToast.error(error instanceof Error ? error.message : '分类删除失败');
      return false;
    } finally {
      setCategoryBusyId(null);
    }
  }

  async function saveVisibility(draft: CourseVisibilityDraft) {
    if (!visibilityCourse) return;
    setSavingVisibility(true);
    try {
      const request = buildCourseVisibilityRequest(
        visibilityCourse.id,
        draft.visibilityMode,
        draft.visibleRoleIds,
      );
      const response = await fetch(request.url, request.init);
      if (!response.ok) {
        adminToast.error('可见范围保存失败');
        return;
      }
      adminToast.success('可见范围已保存');
      setVisibilityCourse(null);
      await loadAll();
    } finally {
      setSavingVisibility(false);
    }
  }

  async function saveCourse(draft: { name: string; categoryId: string }) {
    if (!editingCourse) return;
    setSavingCourse(true);
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(editingCourse.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || '课程信息保存失败');
      adminToast.success('课程信息已保存');
      setEditingCourse(null);
      await loadAll();
    } catch (error) {
      adminToast.error(error instanceof Error ? error.message : '课程信息保存失败');
    } finally {
      setSavingCourse(false);
    }
  }

  async function changeStatus(course: EnterpriseCourse, action: 'publish' | 'archive') {
    setStatusChangingCourseId(course.id);
    try {
      const response = await fetch(`/api/admin/courses/${course.id}/${action}`, { method: 'POST' });
      if (!response.ok) {
        adminToast.error(action === 'publish' ? '课程发布失败' : '课程下架失败');
        return;
      }
      adminToast.success(action === 'publish' ? '课程已发布' : '课程已下架');
      await loadAll();
    } finally {
      setStatusChangingCourseId(null);
    }
  }

  async function deleteCourse(course: EnterpriseCourse) {
    setDeletingCourseId(course.id);
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(course.id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        adminToast.error(data.error || '课程删除失败');
        setCourseToDelete(null);
        return;
      }
      adminToast.success('课程已删除');
      setCourseToDelete(null);
      await loadAll();
    } catch {
      adminToast.error('课程删除失败，请检查网络后重试');
      setCourseToDelete(null);
    } finally {
      setDeletingCourseId(null);
    }
  }

  function applyCourseFilters(next: CourseAdminFilters) {
    setFilters(next);
    setCoursePage(1);
  }

  function clearFilters() {
    setFilters(DEFAULT_COURSE_ADMIN_FILTERS);
    setCoursePage(1);
  }

  function changeStatusFilter(status: CourseAdminStatusFilter) {
    setFilters((current) => ({ ...current, status }));
    setCoursePage(1);
  }

  async function handleImportedCourse() {
    if (coursePage !== 1) {
      setCoursePage(1);
      return;
    }
    await loadAll();
  }

  return (
    <AdminPage id="admin-courses">
      <AdminSectionHeader
        action={
          <div className="flex shrink-0 flex-wrap gap-2" data-course-category-action>
            <Button
              className={adminSecondaryButtonClassName}
              onClick={() => setImportOpen(true)}
              type="button"
              variant="outline"
            >
              <Upload className="size-4" />
              导入企业课程
            </Button>
            <CategoryDialog
              busyId={categoryBusyId}
              categories={categories}
              creating={creatingCategory}
              onCreate={createCategory}
              onDelete={deleteCategory}
              onRename={renameCategory}
              onReorder={reorderCategories}
            />
          </div>
        }
        title="课程管理"
      />

      <AdminCard className="overflow-hidden">
        <CourseFilters
          categories={categories}
          filters={filters}
          onChange={applyCourseFilters}
          onClear={clearFilters}
          onStatusChange={changeStatusFilter}
        />

        {coursePagination.total === 0 ? (
          <CourseListEmptyState
            hasCourses={Boolean(
              filters.query ||
              filters.categoryId ||
              filters.status !== 'all' ||
              filters.visibilityMode !== 'any',
            )}
            onClear={clearFilters}
          />
        ) : (
          <CourseTable
            courses={courses}
            onChangeStatus={changeStatus}
            onDelete={setCourseToDelete}
            onEditCourse={setEditingCourse}
            onEditVisibility={setVisibilityCourse}
            onAnalytics={setAnalyticsCourse}
            roleNames={roleNames}
            statusChangingCourseId={statusChangingCourseId}
            previews={previews}
          />
        )}

        <div className="border-t border-[var(--admin-border-subtle)] px-4 py-3">
          <AdminPagination
            onPageChange={setCoursePage}
            page={coursePagination.page}
            pageSize={coursePagination.pageSize}
            total={coursePagination.total}
          />
        </div>
      </AdminCard>

      <CourseVisibilityDialog
        course={visibilityCourse}
        onOpenChange={(open) => {
          if (!open && !savingVisibility) setVisibilityCourse(null);
        }}
        onSave={saveVisibility}
        open={visibilityCourse !== null}
        roles={learnerRoles}
        saving={savingVisibility}
      />

      <CourseEditDialog
        categories={categories}
        course={editingCourse}
        onOpenChange={(open) => {
          if (!open && !savingCourse) setEditingCourse(null);
        }}
        onSave={saveCourse}
        open={editingCourse !== null}
        saving={savingCourse}
      />

      <CourseAnalyticsDrawer
        course={analyticsCourse}
        onOpenChange={(open) => {
          if (!open) setAnalyticsCourse(null);
        }}
      />

      <EnterpriseCourseImportDialog
        categories={categories}
        onImported={handleImportedCourse}
        onOpenChange={setImportOpen}
        open={importOpen}
      />

      {courseToDelete ? (
        <div className="hidden">
          <CourseDeleteDialog
            course={courseToDelete}
            defaultOpen
            deleting={deletingCourseId === courseToDelete.id}
            onDelete={deleteCourse}
          />
        </div>
      ) : null}
    </AdminPage>
  );
}
