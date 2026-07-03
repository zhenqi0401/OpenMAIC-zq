'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, PlayCircle, Plus, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createAdminClient, type AdminExamPolicy, type ExamPolicyInput } from '@/lib/admin/client';
import type { AuthRole } from '@/lib/auth/service';
import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

interface PolicyDraft {
  title: string;
  targetRoleId: string;
  categoryIds: string[];
  courseIds: string[];
  questionCount: number;
  passThreshold: number;
  timeLimitMinutes: string;
}

const selectClassName =
  'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';

function toPolicyDraft(policy: AdminExamPolicy): PolicyDraft {
  return {
    title: policy.title,
    targetRoleId: policy.targetRoleId,
    categoryIds: policy.categoryIds,
    courseIds: policy.courseIds,
    questionCount: policy.questionCount,
    passThreshold: policy.passThreshold,
    timeLimitMinutes: policy.timeLimitMinutes ? String(policy.timeLimitMinutes) : '',
  };
}

function toPolicyInput(draft: PolicyDraft): ExamPolicyInput {
  return {
    title: draft.title.trim(),
    targetRoleId: draft.targetRoleId,
    categoryIds: draft.categoryIds,
    courseIds: draft.courseIds,
    questionCount: draft.questionCount,
    passThreshold: draft.passThreshold,
    timeLimitMinutes: draft.timeLimitMinutes ? Number(draft.timeLimitMinutes) : null,
  };
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function ExamPolicyAdminPanel() {
  const client = useMemo(() => createAdminClient(), []);
  const [roles, setRoles] = useState<AuthRole[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [courses, setCourses] = useState<EnterpriseCourse[]>([]);
  const [policies, setPolicies] = useState<AdminExamPolicy[]>([]);
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, PolicyDraft>>({});
  const [newPolicy, setNewPolicy] = useState<PolicyDraft>({
    title: '',
    targetRoleId: '',
    categoryIds: [],
    courseIds: [],
    questionCount: 20,
    passThreshold: 80,
    timeLimitMinutes: '45',
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const learnerRoles = useMemo(() => roles.filter((role) => !role.isAdmin), [roles]);
  const publishedCourses = useMemo(
    () => courses.filter((course) => course.status === 'published'),
    [courses],
  );
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name] as const)),
    [categories],
  );

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [roleData, categoriesResponse, coursesResponse, policyData] = await Promise.all([
        client.listRoles(),
        fetch('/api/admin/categories'),
        fetch('/api/admin/courses'),
        client.listExamPolicies(),
      ]);
      if (!categoriesResponse.ok || !coursesResponse.ok) {
        throw new Error('分类或课程加载失败');
      }
      const categoriesData = (await categoriesResponse.json()) as { categories: Category[] };
      const coursesData = (await coursesResponse.json()) as { courses: EnterpriseCourse[] };
      setRoles(roleData);
      setCategories(categoriesData.categories);
      setCourses(coursesData.courses);
      setPolicies(policyData);
      setPolicyDrafts(
        Object.fromEntries(policyData.map((policy) => [policy.id, toPolicyDraft(policy)])),
      );
      setNewPolicy((draft) => ({
        ...draft,
        targetRoleId: draft.targetRoleId || roleData.find((role) => !role.isAdmin)?.id || '',
        categoryIds:
          draft.categoryIds.length > 0
            ? draft.categoryIds
            : categoriesData.categories[0]
              ? [categoriesData.categories[0].id]
              : [],
      }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '考核策略加载失败');
    }
  }, [client]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function eligibleCourses(categoryIds: string[]) {
    return publishedCourses.filter((course) => categoryIds.includes(course.categoryId));
  }

  async function createPolicy() {
    if (!newPolicy.title.trim() || !newPolicy.targetRoleId || newPolicy.categoryIds.length === 0) {
      setMessage('标题、目标角色和分类必填');
      return;
    }
    try {
      await client.createExamPolicy(toPolicyInput(newPolicy));
      setMessage('考核策略已创建');
      setNewPolicy((draft) => ({
        ...draft,
        title: '',
        courseIds: [],
      }));
      await loadAll();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '考核策略创建失败');
    }
  }

  async function savePolicy(policyId: string) {
    const draft = policyDrafts[policyId];
    if (!draft) return;
    try {
      await client.updateExamPolicy(policyId, toPolicyInput(draft));
      setMessage('考核策略已保存');
      await loadAll();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '考核策略保存失败');
    }
  }

  async function publishPolicy(policyId: string) {
    try {
      await client.publishExamPolicy(policyId);
      setMessage('考核策略已发布');
      await loadAll();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '考核策略发布失败');
    }
  }

  function updateNewPolicy(patch: Partial<PolicyDraft>) {
    setNewPolicy((draft) => ({ ...draft, ...patch }));
  }

  function updatePolicyDraft(policyId: string, patch: Partial<PolicyDraft>) {
    setPolicyDrafts((drafts) => ({
      ...drafts,
      ...(drafts[policyId] ? { [policyId]: { ...drafts[policyId], ...patch } } : {}),
    }));
  }

  return (
    <section className="mt-8 space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-950">
          <ClipboardList className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">阶段考核</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">策略、题量与发布状态</p>
        </div>
      </div>

      {(message || error) && (
        <p className={error ? 'text-sm text-red-600' : 'text-sm text-slate-600'}>
          {error ?? message}
        </p>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          <Plus className="size-4 text-slate-400" />
          新建策略
        </div>
        <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr_auto]">
          <Input
            placeholder="策略标题"
            value={newPolicy.title}
            onChange={(event) => updateNewPolicy({ title: event.target.value })}
          />
          <select
            className={selectClassName}
            value={newPolicy.targetRoleId}
            onChange={(event) => updateNewPolicy({ targetRoleId: event.target.value })}
          >
            <option value="">目标角色</option>
            {learnerRoles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name} ({role.code})
              </option>
            ))}
          </select>
          <NumberInput
            min={1}
            value={newPolicy.questionCount}
            onChange={(questionCount) => updateNewPolicy({ questionCount })}
            placeholder="题量"
          />
          <NumberInput
            min={0}
            max={100}
            value={newPolicy.passThreshold}
            onChange={(passThreshold) => updateNewPolicy({ passThreshold })}
            placeholder="阈值"
          />
          <Input
            min={1}
            type="number"
            placeholder="分钟"
            value={newPolicy.timeLimitMinutes}
            onChange={(event) => updateNewPolicy({ timeLimitMinutes: event.target.value })}
          />
          <Button onClick={createPolicy} size="icon" title="新建考核策略">
            <Plus className="size-4" />
          </Button>
        </div>
        <ScopePicker
          categories={categories}
          categoryIds={newPolicy.categoryIds}
          courses={eligibleCourses(newPolicy.categoryIds)}
          courseIds={newPolicy.courseIds}
          onCategoryToggle={(categoryId) =>
            updateNewPolicy({
              categoryIds: toggleValue(newPolicy.categoryIds, categoryId),
              courseIds: [],
            })
          }
          onCourseToggle={(courseId) =>
            updateNewPolicy({ courseIds: toggleValue(newPolicy.courseIds, courseId) })
          }
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {policies.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">暂无考核策略</div>
        ) : (
          policies.map((policy) => {
            const draft = policyDrafts[policy.id] ?? toPolicyDraft(policy);
            return (
              <div
                key={policy.id}
                className="space-y-3 border-b border-slate-100 px-4 py-4 last:border-b-0 dark:border-slate-800"
              >
                <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr_0.8fr_auto_auto]">
                  <Input
                    value={draft.title}
                    onChange={(event) =>
                      updatePolicyDraft(policy.id, { title: event.target.value })
                    }
                  />
                  <select
                    className={selectClassName}
                    value={draft.targetRoleId}
                    onChange={(event) =>
                      updatePolicyDraft(policy.id, { targetRoleId: event.target.value })
                    }
                  >
                    {learnerRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name} ({role.code})
                      </option>
                    ))}
                  </select>
                  <NumberInput
                    min={1}
                    value={draft.questionCount}
                    onChange={(questionCount) => updatePolicyDraft(policy.id, { questionCount })}
                  />
                  <NumberInput
                    min={0}
                    max={100}
                    value={draft.passThreshold}
                    onChange={(passThreshold) => updatePolicyDraft(policy.id, { passThreshold })}
                  />
                  <Input
                    min={1}
                    type="number"
                    value={draft.timeLimitMinutes}
                    onChange={(event) =>
                      updatePolicyDraft(policy.id, { timeLimitMinutes: event.target.value })
                    }
                  />
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <RefreshCw className="size-4" />
                    {policy.candidateQuestionCount ?? 0} 题
                  </div>
                  <Button
                    onClick={() => savePolicy(policy.id)}
                    size="icon"
                    title="保存考核策略"
                    variant="outline"
                  >
                    <Save className="size-4" />
                  </Button>
                  <Button
                    disabled={policy.status === 'published'}
                    onClick={() => publishPolicy(policy.id)}
                    size="icon"
                    title="发布考核策略"
                    variant="outline"
                  >
                    <PlayCircle className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-md border border-slate-200 px-2 py-1 dark:border-slate-700">
                    {policy.status}
                  </span>
                  {draft.categoryIds.map((categoryId) => (
                    <span
                      key={categoryId}
                      className="rounded-md border border-slate-200 px-2 py-1 dark:border-slate-700"
                    >
                      {categoryNameById.get(categoryId) ?? categoryId}
                    </span>
                  ))}
                </div>
                <ScopePicker
                  categories={categories}
                  categoryIds={draft.categoryIds}
                  courses={eligibleCourses(draft.categoryIds)}
                  courseIds={draft.courseIds}
                  onCategoryToggle={(categoryId) =>
                    updatePolicyDraft(policy.id, {
                      categoryIds: toggleValue(draft.categoryIds, categoryId),
                      courseIds: [],
                    })
                  }
                  onCourseToggle={(courseId) =>
                    updatePolicyDraft(policy.id, {
                      courseIds: toggleValue(draft.courseIds, courseId),
                    })
                  }
                />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  placeholder,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <Input
      max={max}
      min={min}
      placeholder={placeholder}
      type="number"
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

function ScopePicker({
  categories,
  categoryIds,
  courses,
  courseIds,
  onCategoryToggle,
  onCourseToggle,
}: {
  categories: Category[];
  categoryIds: string[];
  courses: EnterpriseCourse[];
  courseIds: string[];
  onCategoryToggle: (categoryId: string) => void;
  onCourseToggle: (courseId: string) => void;
}) {
  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <label
            key={category.id}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700"
          >
            <input
              checked={categoryIds.includes(category.id)}
              onChange={() => onCategoryToggle(category.id)}
              type="checkbox"
            />
            {category.name}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500 dark:border-slate-700">
          {courseIds.length === 0 ? '全部课程' : `${courseIds.length} 门课程`}
        </span>
        {courses.map((course) => (
          <label
            key={course.id}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs dark:border-slate-700"
          >
            <input
              checked={courseIds.includes(course.id)}
              onChange={() => onCourseToggle(course.id)}
              type="checkbox"
            />
            {course.name}
          </label>
        ))}
      </div>
    </div>
  );
}
