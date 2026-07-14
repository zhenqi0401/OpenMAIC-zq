'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronsUpDown, ClipboardList } from 'lucide-react';
import {
  AdminCard,
  AdminNotice,
  AdminSectionHeader,
  AdminStatusBadge,
  adminInputClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
import { AdminDeleteDialog } from '@/components/admin/AdminDeleteDialog';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createAdminClient, type AdminExamPolicy, type ExamPolicyInput } from '@/lib/admin/client';
import {
  changeExamCategoryScope,
  examCourseScopeLabel,
  filterExamScopeCourses,
  toggleExamCourseSelection,
} from '@/lib/admin/exam-policy-scope';
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
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null);

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
    return filterExamScopeCourses(publishedCourses, categoryIds);
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

  async function archivePolicy(policyId: string) {
    try {
      await client.updateExamPolicy(policyId, { status: 'archived' });
      setMessage('考核策略已下架');
      await loadAll();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '考核策略下架失败');
    }
  }

  async function deletePolicy(policyId: string) {
    setDeletingPolicyId(policyId);
    try {
      await client.deleteExamPolicy(policyId);
      setMessage('考核策略已删除');
      await loadAll();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '考核策略删除失败');
    } finally {
      setDeletingPolicyId(null);
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
              <Button
                className="rounded-[4px] border-[#d8c8b9]"
                onClick={loadAll}
                variant="outline"
              >
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.32fr)]">
        <AdminCard className="p-4">
          <div className="mb-3 text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
            新建考核
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.2fr_1fr_0.65fr_0.65fr_0.65fr_auto] xl:items-end">
            <Field label="考核名称">
              <Input
                aria-label="考核名称"
                className={adminInputClassName}
                placeholder="例如：销售入职阶段考核"
                value={newPolicy.title}
                onChange={(event) => updateNewPolicy({ title: event.target.value })}
              />
            </Field>
            <Field label="目标角色">
              <select
                aria-label="目标角色"
                className={adminSelectClassName}
                value={newPolicy.targetRoleId}
                onChange={(event) => updateNewPolicy({ targetRoleId: event.target.value })}
              >
                <option value="">请选择角色</option>
                {learnerRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="题量">
              <NumberInput
                ariaLabel="题量"
                min={1}
                value={newPolicy.questionCount}
                onChange={(questionCount) => updateNewPolicy({ questionCount })}
              />
            </Field>
            <Field label="通过线">
              <NumberInput
                ariaLabel="通过线"
                min={0}
                max={100}
                value={newPolicy.passThreshold}
                onChange={(passThreshold) => updateNewPolicy({ passThreshold })}
              />
            </Field>
            <Field label="限时">
              <Input
                aria-label="限时"
                className={adminInputClassName}
                min={1}
                type="number"
                placeholder="分钟"
                value={newPolicy.timeLimitMinutes}
                onChange={(event) => updateNewPolicy({ timeLimitMinutes: event.target.value })}
              />
            </Field>
            <Button className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]" onClick={createPolicy}>
              新建
            </Button>
          </div>
          <Field className="mt-4" label="题源范围">
            <ScopePicker
              categories={categories}
              categoryIds={newPolicy.categoryIds}
              courses={eligibleCourses(newPolicy.categoryIds)}
              courseIds={newPolicy.courseIds}
              onCategoryToggle={(categoryId) =>
                updateNewPolicy(
                  changeExamCategoryScope(newPolicy.categoryIds, newPolicy.courseIds, categoryId),
                )
              }
              onClearCourses={() => updateNewPolicy({ courseIds: [] })}
              onCourseToggle={(courseId) =>
                updateNewPolicy({
                  courseIds: toggleExamCourseSelection(newPolicy.courseIds, courseId),
                })
              }
            />
          </Field>
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
        <div className="border-b border-[#d8c8b9] px-4 py-4">
          <div className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
            考核策略列表
          </div>
          <p className="mt-1 text-sm text-[#75665d]">保存配置后，再按状态发布、下架或删除草稿。</p>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[1180px]">
            <div className="grid grid-cols-[1.2fr_1fr_0.55fr_0.6fr_0.6fr_0.65fr_0.7fr_minmax(230px,auto)] gap-3 border-b border-[#d8c8b9] px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#75665d]">
              <span>考核名称</span>
              <span>目标角色</span>
              <span>题量</span>
              <span>通过线</span>
              <span>限时</span>
              <span>候选题</span>
              <span>状态</span>
              <span className="text-right">操作</span>
            </div>
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
                    <div className="grid grid-cols-[1.2fr_1fr_0.55fr_0.6fr_0.6fr_0.65fr_0.7fr_minmax(230px,auto)] items-center gap-3">
                      <Input
                        aria-label="考核名称"
                        className={adminInputClassName}
                        value={draft.title}
                        onChange={(event) =>
                          updatePolicyDraft(policy.id, { title: event.target.value })
                        }
                      />
                      <select
                        aria-label="目标角色"
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
                        ariaLabel="题量"
                        min={1}
                        value={draft.questionCount}
                        onChange={(questionCount) =>
                          updatePolicyDraft(policy.id, { questionCount })
                        }
                      />
                      <NumberInput
                        ariaLabel="通过线"
                        min={0}
                        max={100}
                        value={draft.passThreshold}
                        onChange={(passThreshold) =>
                          updatePolicyDraft(policy.id, { passThreshold })
                        }
                      />
                      <Input
                        aria-label="限时"
                        className={adminInputClassName}
                        min={1}
                        type="number"
                        value={draft.timeLimitMinutes}
                        onChange={(event) =>
                          updatePolicyDraft(policy.id, { timeLimitMinutes: event.target.value })
                        }
                      />
                      <span className="text-sm tabular-nums text-[#75665d]">
                        {policy.candidateQuestionCount ?? 0} 题
                      </span>
                      <PolicyStatusBadge status={policy.status} />
                      <ExamPolicyActions
                        deleting={deletingPolicyId === policy.id}
                        onArchive={archivePolicy}
                        onDelete={deletePolicy}
                        onPublish={publishPolicy}
                        onSave={savePolicy}
                        policy={policy}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-[#75665d]">
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
                        updatePolicyDraft(
                          policy.id,
                          changeExamCategoryScope(draft.categoryIds, draft.courseIds, categoryId),
                        )
                      }
                      onClearCourses={() =>
                        updatePolicyDraft(policy.id, {
                          courseIds: [],
                        })
                      }
                      onCourseToggle={(courseId) =>
                        updatePolicyDraft(policy.id, {
                          courseIds: toggleExamCourseSelection(draft.courseIds, courseId),
                        })
                      }
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>
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
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <Input
      aria-label={ariaLabel ?? placeholder}
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
  onClearCourses,
  onCourseToggle,
}: {
  categories: Category[];
  categoryIds: string[];
  courses: EnterpriseCourse[];
  courseIds: string[];
  onCategoryToggle: (categoryId: string) => void;
  onClearCourses: () => void;
  onCourseToggle: (courseId: string) => void;
}) {
  const emptyText =
    categoryIds.length === 0 ? '请先选择课程分类' : '所选分类下暂无可选的已发布课程';

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div>
        <div className="mb-2 text-xs font-medium text-[#75665d]">课程分类</div>
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 ? (
            <span className="text-sm text-[#75665d]">暂无课程分类</span>
          ) : (
            categories.map((category) => (
              <label
                key={category.id}
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[#d8c8b9] bg-[#fffaf2] px-2 py-1.5 text-xs"
              >
                <input
                  checked={categoryIds.includes(category.id)}
                  onChange={() => onCategoryToggle(category.id)}
                  type="checkbox"
                />
                {category.name}
              </label>
            ))
          )}
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-medium text-[#75665d]">课程范围</div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                aria-label="搜索并选择课程"
                className="min-w-[230px] justify-between rounded-[4px] border-[#d8c8b9] bg-[#fffaf2] font-normal"
                variant="outline"
              >
                <span className="truncate">{examCourseScopeLabel(courseIds)}</span>
                <ChevronsUpDown className="size-4 text-[#75665d]" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[min(360px,calc(100vw-2rem))] rounded-[6px] border-[#d8c8b9] bg-[#fffaf2] p-0 text-[#2b211d]"
            >
              <Command className="rounded-[6px]! bg-[#fffaf2] text-[#2b211d]">
                <CommandInput placeholder="搜索课程名称" />
                <CommandList>
                  <CommandEmpty className="text-[#75665d]">{emptyText}</CommandEmpty>
                  {courses.length > 0 ? (
                    <CommandGroup heading="已发布课程">
                      {courses.map((course) => (
                        <CommandItem
                          data-checked={courseIds.includes(course.id)}
                          key={course.id}
                          onSelect={() => onCourseToggle(course.id)}
                          value={course.name}
                        >
                          <span className="truncate">{course.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}
                </CommandList>
                <div className="border-t border-[#eaded1] p-2">
                  <Button
                    className="w-full justify-center rounded-[4px]"
                    disabled={courseIds.length === 0}
                    onClick={onClearCourses}
                    type="button"
                    variant="outline"
                  >
                    恢复全部课程
                  </Button>
                </div>
              </Command>
            </PopoverContent>
          </Popover>
          <AdminStatusBadge>{examCourseScopeLabel(courseIds)}</AdminStatusBadge>
        </div>
        <p className="mt-2 text-xs leading-5 text-[#75665d]">
          空选择表示使用所选分类下全部已发布课程。
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div aria-label={label} className={`grid gap-1.5 ${className}`} role="group">
      <span className="text-xs font-medium text-[#75665d]">{label}</span>
      {children}
    </div>
  );
}

export function ExamPolicyActions({
  policy,
  deleting,
  onSave,
  onPublish,
  onArchive,
  onDelete,
}: {
  policy: AdminExamPolicy;
  deleting: boolean;
  onSave: (policyId: string) => void;
  onPublish: (policyId: string) => void;
  onArchive: (policyId: string) => void;
  onDelete: (policyId: string) => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button
        className="rounded-[4px]"
        onClick={() => onSave(policy.id)}
        title="保存考核策略"
        variant="outline"
      >
        保存
      </Button>
      {policy.status === 'published' ? (
        <Button
          className="rounded-[4px]"
          onClick={() => onArchive(policy.id)}
          title="下架考核策略"
          variant="outline"
        >
          下架
        </Button>
      ) : (
        <Button
          className="rounded-[4px]"
          onClick={() => onPublish(policy.id)}
          title={policy.status === 'archived' ? '重新发布考核策略' : '发布考核策略'}
          variant="outline"
        >
          {policy.status === 'archived' ? '重新发布' : '发布'}
        </Button>
      )}
      {policy.status === 'draft' ? (
        <AdminDeleteDialog
          deleting={deleting}
          description={`确认删除考核策略「${policy.title}」？仅草稿可以删除，删除后不可恢复。`}
          onDelete={() => onDelete(policy.id)}
          title="删除考核策略"
        />
      ) : null}
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
