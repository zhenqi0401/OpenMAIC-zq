'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Archive, BookOpen, Plus, Save, Tags, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CourseVisibilityMode, EnterpriseCourse } from '@/lib/storage/enterprise-service';
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
  const [message, setMessage] = useState<string | null>(null);

  const learnerRoles = useMemo(() => roles.filter((role) => !role.isAdmin), [roles]);

  async function loadAll() {
    const [rolesResponse, categoriesResponse, coursesResponse] = await Promise.all([
      fetch('/api/admin/roles'),
      fetch('/api/admin/categories'),
      fetch('/api/admin/courses'),
    ]);
    if (!rolesResponse.ok || !categoriesResponse.ok || !coursesResponse.ok) {
      setMessage('课程后台加载失败');
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
      setMessage('分类创建失败');
      return;
    }
    setCategoryName('');
    setMessage('分类已创建');
    await loadAll();
  }

  async function createCourse() {
    if (!courseDraft.name.trim() || !courseDraft.categoryId) {
      setMessage('课程名称和分类必填');
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
      setMessage('课程草稿创建失败');
      return;
    }
    setCourseDraft({ name: '', description: '', categoryId: categories[0]?.id || '' });
    setMessage('课程草稿已创建');
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
      setMessage('可见范围保存失败');
      return;
    }
    setMessage('可见范围已保存');
    await loadAll();
  }

  async function changeStatus(courseId: string, action: 'publish' | 'archive') {
    const response = await fetch(`/api/admin/courses/${courseId}/${action}`, { method: 'POST' });
    if (!response.ok) {
      setMessage(action === 'publish' ? '课程发布失败' : '课程下架失败');
      return;
    }
    setMessage(action === 'publish' ? '课程已发布' : '课程已下架');
    await loadAll();
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
    <section className="mt-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-950">
          <BookOpen className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">课程管理</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">分类、发布状态与可见范围</p>
        </div>
      </div>

      {message && <p className="text-sm text-slate-600 dark:text-slate-300">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <Tags className="size-4 text-slate-400" />
            分类
          </div>
          <div className="flex gap-2">
            <Input
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="分类名称"
            />
            <Button onClick={createCategory} size="icon" title="新建分类" variant="outline">
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((category) => (
              <span
                key={category.id}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
              >
                {category.name}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <BookOpen className="size-4 text-slate-400" />
            新建课程草稿
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_180px_auto]">
            <Input
              value={courseDraft.name}
              onChange={(event) =>
                setCourseDraft((draft) => ({ ...draft, name: event.target.value }))
              }
              placeholder="课程名称"
            />
            <Input
              value={courseDraft.description}
              onChange={(event) =>
                setCourseDraft((draft) => ({ ...draft, description: event.target.value }))
              }
              placeholder="描述"
            />
            <select
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
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
            <Button onClick={createCourse} size="icon" title="创建草稿">
              <Plus className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-[1.1fr_0.7fr_0.8fr_1.4fr_auto] gap-3 border-b border-slate-200 px-4 py-3 text-xs font-medium uppercase text-slate-500 dark:border-slate-800">
          <span>课程</span>
          <span>分类</span>
          <span>状态</span>
          <span>可见范围</span>
          <span />
        </div>
        {courses.map((course) => {
          const draft = visibilityDrafts[course.id] ?? {
            visibilityMode: course.visibilityMode,
            visibleRoleIds: course.visibleRoleIds,
          };
          return (
            <div
              key={course.id}
              className="grid grid-cols-[1.1fr_0.7fr_0.8fr_1.4fr_auto] items-start gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 dark:border-slate-800"
            >
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">{course.name}</div>
                {course.assessmentQuestions.length > 0 && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                    <span>内容更新后请检查课后测评题</span>
                  </div>
                )}
              </div>
              <span className="text-slate-500">{course.categoryName ?? '-'}</span>
              <span className="text-slate-500">{course.status}</span>
              <div className="space-y-2">
                <select
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={draft.visibilityMode}
                  onChange={(event) =>
                    setVisibilityMode(course.id, event.target.value as CourseVisibilityMode)
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
                        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700"
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
                  onClick={() => saveVisibility(course.id)}
                  size="icon"
                  title="保存可见范围"
                  variant="outline"
                >
                  <Save className="size-4" />
                </Button>
                <Button
                  onClick={() => changeStatus(course.id, 'publish')}
                  size="icon"
                  title="发布"
                  variant="outline"
                >
                  <Upload className="size-4" />
                </Button>
                <Button
                  onClick={() => changeStatus(course.id, 'archive')}
                  size="icon"
                  title="下架"
                  variant="outline"
                >
                  <Archive className="size-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
