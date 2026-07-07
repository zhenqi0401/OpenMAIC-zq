'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BookOpen } from 'lucide-react';
import {
  AdminCard,
  AdminSectionHeader,
  AdminStatusBadge,
  adminInputClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type {
  CourseStatus,
  CourseVisibilityMode,
  EnterpriseCourse,
} from '@/lib/storage/enterprise-service';
import type { AuthRole } from '@/lib/auth/service';

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

interface CourseDraft {
  name: string;
  description: string;
  categoryId: string;
}

export interface CourseAdminFilters {
  status: CourseStatus | 'all';
  categoryId: string;
  visibilityMode: CourseVisibilityMode | 'any';
  query: string;
}

export const DEFAULT_COURSE_ADMIN_FILTERS: CourseAdminFilters = {
  status: 'all',
  categoryId: '',
  visibilityMode: 'any',
  query: '',
};

export function shouldApplyCourseAdminFilters(filters: CourseAdminFilters): boolean {
  return (
    filters.status !== DEFAULT_COURSE_ADMIN_FILTERS.status ||
    filters.categoryId !== DEFAULT_COURSE_ADMIN_FILTERS.categoryId ||
    filters.visibilityMode !== DEFAULT_COURSE_ADMIN_FILTERS.visibilityMode ||
    filters.query.trim() !== DEFAULT_COURSE_ADMIN_FILTERS.query
  );
}

export function filterAdminCourses(
  courses: readonly EnterpriseCourse[],
  filters: CourseAdminFilters,
): EnterpriseCourse[] {
  const query = filters.query.trim().toLowerCase();
  return courses.filter((course) => {
    if (filters.status !== 'all' && course.status !== filters.status) return false;
    if (filters.categoryId && course.categoryId !== filters.categoryId) return false;
    if (filters.visibilityMode !== 'any' && course.visibilityMode !== filters.visibilityMode) {
      return false;
    }
    if (!query) return true;
    return (
      course.name.toLowerCase().includes(query) ||
      (course.description ?? '').toLowerCase().includes(query) ||
      (course.categoryName ?? '').toLowerCase().includes(query)
    );
  });
}

export function courseGenerationStatusLabel(course: EnterpriseCourse): string | null {
  if (course.status !== 'draft' || course.generationComplete) return null;
  if (course.generationStatus === 'generating') return '生成中';
  return '内容未完成';
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
    <AlertDialog defaultOpen={defaultOpen}>
      <AlertDialogTrigger asChild>
        <Button
          className="rounded-[4px] border-[#c96f54] text-[#9b4d39] hover:bg-[#fff2ea]"
          disabled={deleting}
          title="删除"
          variant="outline"
        >
          {deleting ? '删除中' : '删除'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[420px] rounded-[6px] border border-[#d8c8b9] bg-[#fffaf2] p-0 text-[#2b211d] shadow-[0_18px_50px_rgba(43,33,29,0.18)]">
        <AlertDialogHeader className="place-items-start gap-2 px-5 pb-2 pt-5 text-left">
          <AlertDialogTitle className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
            删除课程
          </AlertDialogTitle>
          <AlertDialogDescription className="text-left text-sm leading-6 text-[#75665d]">
            {courseDeleteConfirmationMessage(course)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t border-[#eaded1] px-5 pb-5 pt-3 sm:justify-end">
          <AlertDialogCancel className="rounded-[4px] border-[#d8c8b9]" disabled={deleting}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            className="rounded-[4px] bg-[#c96f54] text-[#fffaf2] hover:bg-[#b9624a]"
            disabled={deleting}
            onClick={() => onDelete(course)}
          >
            确认删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CourseAdminPanel() {
  const [roles, setRoles] = useState<AuthRole[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<EnterpriseCourse[]>([]);
  const [courseDraft, setCourseDraft] = useState<CourseDraft>({
    name: '',
    description: '',
    categoryId: '',
  });
  const [categoryName, setCategoryName] = useState('');
  const [visibilityDrafts, setVisibilityDrafts] = useState<
    Record<string, { visibilityMode: CourseVisibilityMode; visibleRoleIds: string[] }>
  >({});
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CourseAdminFilters>(DEFAULT_COURSE_ADMIN_FILTERS);
  const [filterDraft, setFilterDraft] = useState<CourseAdminFilters>(DEFAULT_COURSE_ADMIN_FILTERS);

  const learnerRoles = useMemo(() => roles.filter((role) => !role.isAdmin), [roles]);
  const filteredCourses = useMemo(() => filterAdminCourses(courses, filters), [courses, filters]);
  const courseStatusSummary = useMemo(
    () => ({
      published: courses.filter((course) => course.status === 'published').length,
      draft: courses.filter((course) => course.status === 'draft').length,
      archived: courses.filter((course) => course.status === 'archived').length,
    }),
    [courses],
  );

  async function loadAll() {
    const [rolesResponse, categoriesResponse, coursesResponse] = await Promise.all([
      fetch('/api/admin/roles'),
      fetch('/api/admin/categories'),
      fetch('/api/admin/courses'),
    ]);
    if (!rolesResponse.ok || !categoriesResponse.ok || !coursesResponse.ok) {
      toast.error('课程后台加载失败');
      return;
    }
    const rolesData = (await rolesResponse.json()) as { roles: AuthRole[] };
    const categoriesData = (await categoriesResponse.json()) as { categories: Category[] };
    const coursesData = (await coursesResponse.json()) as { courses: EnterpriseCourse[] };
    setRoles(rolesData.roles);
    setCategories(categoriesData.categories);
    setCourses(coursesData.courses);
    setVisibilityDrafts(
      Object.fromEntries(
        coursesData.courses.map((course) => [
          course.id,
          {
            visibilityMode: course.visibilityMode,
            visibleRoleIds: course.visibleRoleIds,
          },
        ]),
      ),
    );
    setCourseDraft((draft) => ({
      ...draft,
      categoryId: draft.categoryId || categoriesData.categories[0]?.id || '',
    }));
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadAll();
    });
  }, []);

  async function createCategory() {
    if (!categoryName.trim()) return;
    const response = await fetch('/api/admin/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: categoryName.trim() }),
    });
    if (!response.ok) {
      toast.error('分类创建失败');
      return;
    }
    setCategoryName('');
    toast.success('分类已创建');
    await loadAll();
  }

  async function createCourse() {
    if (!courseDraft.name.trim() || !courseDraft.categoryId) {
      toast.error('课程名称和分类必填');
      return;
    }
    const response = await fetch('/api/admin/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: courseDraft.name.trim(),
        description: courseDraft.description.trim() || null,
        categoryId: courseDraft.categoryId,
      }),
    });
    if (!response.ok) {
      toast.error('课程草稿创建失败');
      return;
    }
    setCourseDraft({ name: '', description: '', categoryId: categories[0]?.id || '' });
    toast.success('课程草稿已创建');
    await loadAll();
  }

  async function saveVisibility(courseId: string) {
    const draft = visibilityDrafts[courseId];
    if (!draft) return;
    const response = await fetch(`/api/admin/courses/${courseId}/visibility`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (!response.ok) {
      toast.error('可见范围保存失败');
      return;
    }
    toast.success('可见范围已保存');
    await loadAll();
  }

  async function changeStatus(courseId: string, action: 'publish' | 'archive') {
    const response = await fetch(`/api/admin/courses/${courseId}/${action}`, { method: 'POST' });
    if (!response.ok) {
      toast.error(action === 'publish' ? '课程发布失败' : '课程下架失败');
      return;
    }
    toast.success(action === 'publish' ? '课程已发布' : '课程已下架');
    await loadAll();
  }

  async function deleteCourse(course: EnterpriseCourse) {
    setDeletingCourseId(course.id);
    try {
      const response = await fetch(`/api/admin/courses/${encodeURIComponent(course.id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        toast.error('课程删除失败');
        return;
      }
      toast.success('课程已删除');
      await loadAll();
    } finally {
      setDeletingCourseId(null);
    }
  }

  function setVisibilityMode(courseId: string, visibilityMode: CourseVisibilityMode) {
    setVisibilityDrafts((drafts) => ({
      ...drafts,
      [courseId]: {
        visibilityMode,
        visibleRoleIds: visibilityMode === 'all' ? [] : (drafts[courseId]?.visibleRoleIds ?? []),
      },
    }));
  }

  function toggleVisibleRole(courseId: string, roleId: string) {
    setVisibilityDrafts((drafts) => {
      const draft = drafts[courseId] ?? { visibilityMode: 'roles', visibleRoleIds: [] };
      const nextRoleIds = draft.visibleRoleIds.includes(roleId)
        ? draft.visibleRoleIds.filter((id) => id !== roleId)
        : [...draft.visibleRoleIds, roleId];
      return {
        ...drafts,
        [courseId]: {
          visibilityMode: 'roles',
          visibleRoleIds: nextRoleIds,
        },
      };
    });
  }

  return (
    <section className="scroll-mt-4 space-y-5" id="admin-courses">
      <AdminSectionHeader
        action={
          <AdminSessionActions
            leading={
              <Button className="rounded-[4px] border-[#d8c8b9]" onClick={loadAll} variant="outline">
                刷新
              </Button>
            }
          />
        }
        description="维护课程从草稿到发布的全流程，并把可见范围绑定到真实角色。"
        eyebrow="Courses"
        icon={<BookOpen className="size-4" />}
        title="课程管理"
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        <AdminCard className="overflow-hidden">
          <div className="border-b border-[#d8c8b9] px-4 py-4">
            <div className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
              课程分类
            </div>
            <p className="mt-1 text-sm text-[#75665d]">先按分类和条件收窄，再维护课程列表。</p>
          </div>

          <div className="grid gap-2 border-b border-[#eaded1] p-3 md:grid-cols-[minmax(180px,1fr)_140px_140px_140px_auto]">
            <Input
              className={adminInputClassName}
              placeholder="搜索课程、描述或分类"
              value={filterDraft.query}
              onChange={(event) =>
                setFilterDraft((draft) => ({ ...draft, query: event.target.value }))
              }
            />
            <select
              className={adminSelectClassName}
              value={filterDraft.status}
              onChange={(event) =>
                setFilterDraft((draft) => ({
                  ...draft,
                  status: event.target.value as CourseStatus | 'all',
                }))
              }
            >
              <option value="all">全部状态</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">已归档</option>
            </select>
            <select
              className={adminSelectClassName}
              value={filterDraft.categoryId}
              onChange={(event) =>
                setFilterDraft((draft) => ({ ...draft, categoryId: event.target.value }))
              }
            >
              <option value="">全部分类</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              className={adminSelectClassName}
              value={filterDraft.visibilityMode}
              onChange={(event) =>
                setFilterDraft((draft) => ({
                  ...draft,
                  visibilityMode: event.target.value as CourseVisibilityMode | 'any',
                }))
              }
            >
              <option value="any">全部可见范围</option>
              <option value="all">全体可见</option>
              <option value="roles">按角色可见</option>
            </select>
            <div className="flex gap-2">
              <Button
                className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]"
                onClick={() => setFilters(filterDraft)}
                type="button"
              >
                筛选
              </Button>
              {shouldApplyCourseAdminFilters(filterDraft) && (
                <Button
                  className="rounded-[4px]"
                  onClick={() => {
                    setFilterDraft(DEFAULT_COURSE_ADMIN_FILTERS);
                    setFilters(DEFAULT_COURSE_ADMIN_FILTERS);
                  }}
                  type="button"
                  variant="outline"
                >
                  重置
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-hidden">
            <div className="overflow-x-auto md:overflow-visible">
              <div className="min-w-[980px] md:min-w-0">
                <div className="grid grid-cols-[1.1fr_0.7fr_0.7fr_1.4fr_auto] gap-3 border-b border-[#d8c8b9] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#75665d]">
                  <span>课程</span>
                  <span>分类</span>
                  <span>状态</span>
                  <span>可见范围</span>
                  <span className="text-right">操作</span>
                </div>
                {filteredCourses.length === 0 ? (
                  <EmptyState text="当前筛选无课程" />
                ) : (
                  filteredCourses.map((course) => {
                    const draft = visibilityDrafts[course.id] ?? {
                      visibilityMode: course.visibilityMode,
                      visibleRoleIds: course.visibleRoleIds,
                    };
                    const generationLabel = courseGenerationStatusLabel(course);
                    return (
                      <div
                        key={course.id}
                        className="grid min-h-[54px] grid-cols-[1.1fr_0.7fr_0.7fr_1.4fr_auto] items-start gap-3 border-b border-[#eaded1] px-4 py-3 text-sm last:border-b-0"
                      >
                        <div>
                          <div className="font-medium text-[#2b211d]">{course.name}</div>
                          {course.description && (
                            <div className="mt-1 line-clamp-2 text-xs text-[#75665d]">
                              {course.description}
                            </div>
                          )}
                          {course.assessmentQuestions.length > 0 && (
                            <div className="mt-2 flex items-start gap-1.5 text-xs text-[#a66f2e]">
                              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                              <span>内容更新后请检查课后测评题</span>
                            </div>
                          )}
                        </div>
                        <span className="text-[#75665d]">{course.categoryName ?? '-'}</span>
                        <div className="flex flex-col items-start gap-1">
                          <CourseStatusBadge status={course.status} />
                          {generationLabel && (
                            <AdminStatusBadge tone="warning">{generationLabel}</AdminStatusBadge>
                          )}
                        </div>
                        <div className="space-y-2">
                          <select
                            className={adminSelectClassName}
                            value={draft.visibilityMode}
                            onChange={(event) =>
                              setVisibilityMode(
                                course.id,
                                event.target.value as CourseVisibilityMode,
                              )
                            }
                          >
                            <option value="all">全体可见</option>
                            <option value="roles">按角色可见</option>
                          </select>
                          {draft.visibilityMode === 'roles' && (
                            <div className="flex flex-wrap gap-2">
                              {learnerRoles.map((role) => (
                                <label
                                  key={role.id}
                                  className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#d8c8b9] px-2 py-1 text-xs"
                                >
                                  <input
                                    checked={draft.visibleRoleIds.includes(role.id)}
                                    onChange={() => toggleVisibleRole(course.id, role.id)}
                                    type="checkbox"
                                  />
                                  {role.name}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            className="rounded-[4px]"
                            onClick={() => saveVisibility(course.id)}
                            title="保存可见范围"
                            variant="outline"
                          >
                            保存
                          </Button>
                          <Button
                            className="rounded-[4px]"
                            onClick={() => changeStatus(course.id, 'publish')}
                            title="发布"
                            variant="outline"
                          >
                            发布
                          </Button>
                          <Button
                            className="rounded-[4px]"
                            onClick={() => changeStatus(course.id, 'archive')}
                            title="下架"
                            variant="outline"
                          >
                            下架
                          </Button>
                          <CourseDeleteDialog
                            course={course}
                            deleting={deletingCourseId === course.id}
                            onDelete={deleteCourse}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </AdminCard>

        <aside className="grid gap-4 content-start">
          <AdminCard className="p-4">
            <div className="mb-3 text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
              新建课程草稿
            </div>
            <div className="grid gap-2">
              <Input
                className={adminInputClassName}
                value={courseDraft.name}
                onChange={(event) =>
                  setCourseDraft((draft) => ({ ...draft, name: event.target.value }))
                }
                placeholder="课程名称"
              />
              <Input
                className={adminInputClassName}
                value={courseDraft.description}
                onChange={(event) =>
                  setCourseDraft((draft) => ({ ...draft, description: event.target.value }))
                }
                placeholder="描述"
              />
              <select
                className={adminSelectClassName}
                value={courseDraft.categoryId}
                onChange={(event) =>
                  setCourseDraft((draft) => ({ ...draft, categoryId: event.target.value }))
                }
              >
                <option value="">选择分类</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Button className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]" onClick={createCourse}>
                创建草稿
              </Button>
            </div>
          </AdminCard>

          <AdminCard className="p-4">
            <div className="mb-3 text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
              新建分类
            </div>
            <div className="flex gap-2">
              <Input
                className={adminInputClassName}
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                placeholder="分类名称"
              />
              <Button className="rounded-[4px]" onClick={createCategory} variant="outline">
                创建
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.map((category) => (
                <AdminStatusBadge key={category.id}>{category.name}</AdminStatusBadge>
              ))}
            </div>
          </AdminCard>

          <AdminCard className="grid gap-3 p-4">
            <div>
              <div className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
                发布结构
              </div>
              <p className="mt-1 text-sm text-[#75665d]">帮助管理员判断今日优先处理什么。</p>
            </div>
            <StatusBar label="已发布" value={courseStatusSummary.published} total={courses.length} />
            <StatusBar label="草稿" value={courseStatusSummary.draft} total={courses.length} />
            <StatusBar label="已归档" value={courseStatusSummary.archived} total={courses.length} />
          </AdminCard>
        </aside>
      </div>
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-sm text-[#75665d]">{text}</div>;
}

function CourseStatusBadge({ status }: { status: CourseStatus }) {
  const map = {
    draft: { label: '草稿', tone: 'warning' },
    published: { label: '已发布', tone: 'success' },
    archived: { label: '已归档', tone: 'neutral' },
  } as const;
  const view = map[status];
  return <AdminStatusBadge tone={view.tone}>{view.label}</AdminStatusBadge>;
}

function StatusBar({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total === 0 ? '0%' : `${Math.round((value / total) * 100)}%`;
  return (
    <div className="grid grid-cols-[72px_minmax(0,1fr)_32px] items-center gap-3 text-sm text-[#75665d]">
      <span>{label}</span>
      <div className="h-3 overflow-hidden rounded-full bg-[#eaded1]">
        <span className="block h-full rounded-full bg-[#c96f54]" style={{ width }} />
      </div>
      <strong className="text-right tabular-nums text-[#2b211d]">{value}</strong>
    </div>
  );
}
