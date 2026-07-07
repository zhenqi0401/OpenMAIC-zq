'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import {
  AdminCard,
  AdminNotice,
  AdminSectionHeader,
  AdminStatusBadge,
  adminInputClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
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
  const readyCourseCount = useMemo(
    () => publishedCourses.filter((course) => course.assessmentQuestions.length > 0).length,
    [publishedCourses],
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
    <section className="scroll-mt-4 space-y-5" id="admin-exams">
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
        description="把阶段考核策略翻译成运营能理解的业务配置，并只使用已发布课程作为题源。"
        eyebrow="Exams"
        icon={<ClipboardList className="size-4" />}
        title="阶段考核"
      />

      {(message || error) && (
        <AdminNotice tone={error ? 'error' : 'success'}>{error ?? message}</AdminNotice>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_0.45fr]">
        <AdminCard className="p-4">
          <div className="mb-3 text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
            新建考核
          </div>
          <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr_auto]">
            <Input
              className={adminInputClassName}
              placeholder="考核标题"
              value={newPolicy.title}
              onChange={(event) => updateNewPolicy({ title: event.target.value })}
            />
            <select
              className={adminSelectClassName}
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
              placeholder="通过线"
            />
            <Input
              className={adminInputClassName}
              min={1}
              type="number"
              placeholder="分钟"
              value={newPolicy.timeLimitMinutes}
              onChange={(event) => updateNewPolicy({ timeLimitMinutes: event.target.value })}
            />
            <Button className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]" onClick={createPolicy}>
              新建
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
        </AdminCard>

        <AdminCard className="p-4">
          <div className="mb-3 text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
            题库准备度
          </div>
          <div className="text-3xl font-semibold tabular-nums text-[#2b211d]">
            {readyCourseCount}/{publishedCourses.length}
          </div>
          <p className="mt-2 text-sm leading-5 text-[#75665d]">
            仅统计已发布且已有课后测评题的课程；没有后端字段时不编造题库数量。
          </p>
        </AdminCard>
      </div>

      <AdminCard className="overflow-hidden">
        {policies.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#75665d]">暂无阶段考核</div>
        ) : (
          policies.map((policy) => {
            const draft = policyDrafts[policy.id] ?? toPolicyDraft(policy);
            return (
              <div
                key={policy.id}
                className="space-y-3 border-b border-[#eaded1] px-4 py-4 last:border-b-0"
              >
                <div className="grid gap-2 md:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr_0.8fr_auto_auto]">
                  <Input
                    className={adminInputClassName}
                    value={draft.title}
                    onChange={(event) =>
                      updatePolicyDraft(policy.id, { title: event.target.value })
                    }
                  />
                  <select
                    className={adminSelectClassName}
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
                    className={adminInputClassName}
                    min={1}
                    type="number"
                    value={draft.timeLimitMinutes}
                    onChange={(event) =>
                      updatePolicyDraft(policy.id, { timeLimitMinutes: event.target.value })
                    }
                  />
                  <div className="flex items-center gap-2 text-sm text-[#75665d]">
                    {policy.candidateQuestionCount ?? 0} 题
                  </div>
                  <Button
                    className="rounded-[4px]"
                    onClick={() => savePolicy(policy.id)}
                    title="保存考核策略"
                    variant="outline"
                  >
                    保存
                  </Button>
                  <Button
                    className="rounded-[4px]"
                    disabled={policy.status === 'published'}
                    onClick={() => publishPolicy(policy.id)}
                    title="发布考核策略"
                    variant="outline"
                  >
                    发布
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-[#75665d]">
                  <PolicyStatusBadge status={policy.status} />
                  {draft.categoryIds.map((categoryId) => (
                    <AdminStatusBadge key={categoryId}>
                      {categoryNameById.get(categoryId) ?? categoryId}
                    </AdminStatusBadge>
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
      </AdminCard>
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
      className={adminInputClassName}
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
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#d8c8b9] px-2 py-1 text-xs"
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
        <AdminStatusBadge>
          {courseIds.length === 0 ? '全部课程' : `${courseIds.length} 门课程`}
        </AdminStatusBadge>
        {courses.map((course) => (
          <label
            key={course.id}
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#d8c8b9] px-2 py-1 text-xs"
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

function PolicyStatusBadge({ status }: { status: AdminExamPolicy['status'] }) {
  const map = {
    draft: { label: '草稿', tone: 'warning' },
    published: { label: '已发布', tone: 'success' },
    archived: { label: '已归档', tone: 'neutral' },
  } as const;
  const view = map[status];
  return <AdminStatusBadge tone={view.tone}>{view.label}</AdminStatusBadge>;
}
