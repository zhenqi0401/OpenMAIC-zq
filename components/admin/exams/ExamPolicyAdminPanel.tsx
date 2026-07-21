'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import {
  AdminCard,
  AdminNotice,
  AdminSectionHeader,
  adminInputClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
import { ExamPolicyDialog } from '@/components/admin/exams/ExamPolicyDialog';
import { ExamPolicyTable } from '@/components/admin/exams/ExamPolicyTable';
import { ExamReadinessSummary } from '@/components/admin/exams/ExamReadinessSummary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createAdminClient, type AdminExamPolicy } from '@/lib/admin/client';
import {
  changeExamCategoryScope,
  filterExamScopeCourses,
  toggleExamCourseSelection,
} from '@/lib/admin/exam-policy-scope';
import {
  countDraftCandidateQuestions,
  createEmptyPolicyDraft,
  getExamReadiness,
  toPolicyDraft,
  toPolicyInput,
  type ExamCategory,
  type ExamPolicyDraft,
} from '@/lib/admin/exam-policy-presentation';
import type { AuthRole } from '@/lib/auth/service';
import type { EnterpriseCourse } from '@/lib/storage/enterprise-service';

export function ExamPolicyAdminPanel() {
  const client = useMemo(() => createAdminClient(), []);
  const [roles, setRoles] = useState<AuthRole[]>([]);
  const [categories, setCategories] = useState<ExamCategory[]>([]);
  const [courses, setCourses] = useState<EnterpriseCourse[]>([]);
  const [policies, setPolicies] = useState<AdminExamPolicy[]>([]);
  const [dialogMode, setDialogMode] = useState<'create' | 'edit'>('create');
  const [dialogPolicyId, setDialogPolicyId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDraft, setDialogDraft] = useState<ExamPolicyDraft>(createEmptyPolicyDraft());
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminExamPolicy['status']>('all');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null);

  const learnerRoles = useMemo(() => roles.filter((role) => !role.isAdmin), [roles]);
  const publishedCourses = useMemo(
    () => courses.filter((course) => course.status === 'published'),
    [courses],
  );
  const readiness = useMemo(() => getExamReadiness(courses), [courses]);
  const roleNames = useMemo(
    () => new Map(learnerRoles.map((role) => [role.id, role.name] as const)),
    [learnerRoles],
  );
  const categoryNames = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name] as const)),
    [categories],
  );
  const dialogCourses = useMemo(
    () => filterExamScopeCourses(publishedCourses, dialogDraft.categoryIds),
    [dialogDraft.categoryIds, publishedCourses],
  );
  const dialogCandidateQuestionCount = useMemo(() => {
    if (dialogMode === 'edit') {
      const policy = policies.find((item) => item.id === dialogPolicyId);
      const originalDraft = policy ? toPolicyDraft(policy) : null;
      if (
        policy &&
        originalDraft?.categoryIds.join() === dialogDraft.categoryIds.join() &&
        originalDraft.courseIds.join() === dialogDraft.courseIds.join()
      ) {
        return policy.candidateQuestionCount ?? 0;
      }
    }
    return countDraftCandidateQuestions(publishedCourses, dialogDraft);
  }, [dialogDraft, dialogMode, dialogPolicyId, policies, publishedCourses]);
  const filteredPolicies = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return policies.filter(
      (policy) =>
        (statusFilter === 'all' || policy.status === statusFilter) &&
        (!normalizedQuery ||
          policy.title.toLocaleLowerCase().includes(normalizedQuery) ||
          (roleNames.get(policy.targetRoleId) ?? '').toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [policies, query, roleNames, statusFilter]);

  const loadAll = useCallback(async () => {
    setError(null);
    try {
      const [roleData, categoriesResponse, coursesResponse, policyData] = await Promise.all([
        client.listRoles(),
        fetch('/api/admin/categories'),
        fetch('/api/admin/courses'),
        client.listExamPolicies(),
      ]);
      if (!categoriesResponse.ok || !coursesResponse.ok) throw new Error('分类或课程加载失败');
      const categoriesData = (await categoriesResponse.json()) as { categories: ExamCategory[] };
      const coursesData = (await coursesResponse.json()) as { courses: EnterpriseCourse[] };
      setRoles(roleData);
      setCategories(categoriesData.categories);
      setCourses(coursesData.courses);
      setPolicies(policyData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '考核策略加载失败');
    }
  }, [client]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function openCreateDialog() {
    setDialogMode('create');
    setDialogPolicyId(null);
    setDialogDraft(createEmptyPolicyDraft(learnerRoles[0]?.id, categories[0]?.id));
    setDialogOpen(true);
  }

  function openEditDialog(policy: AdminExamPolicy) {
    setDialogMode('edit');
    setDialogPolicyId(policy.id);
    setDialogDraft(toPolicyDraft(policy));
    setDialogOpen(true);
  }

  function updateDialogDraft(patch: Partial<ExamPolicyDraft>) {
    setDialogDraft((draft) => ({ ...draft, ...patch }));
  }

  async function saveDialogPolicy() {
    if (
      !dialogDraft.title.trim() ||
      !dialogDraft.targetRoleId ||
      dialogDraft.categoryIds.length === 0
    ) {
      setError('标题、目标角色和分类必填');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (dialogMode === 'create') {
        await client.createExamPolicy(toPolicyInput(dialogDraft));
        setMessage('考核策略已创建');
      } else if (dialogPolicyId) {
        await client.updateExamPolicy(dialogPolicyId, toPolicyInput(dialogDraft));
        setMessage('考核策略已保存');
      }
      setDialogOpen(false);
      await loadAll();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '考核策略保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function publishPolicy(policyId: string) {
    setError(null);
    try {
      await client.publishExamPolicy(policyId);
      setMessage('考核策略已发布');
      await loadAll();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '考核策略发布失败');
    }
  }

  async function archivePolicy(policyId: string) {
    setError(null);
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
    setError(null);
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

  return (
    <section className="scroll-mt-4 space-y-5" id="admin-exams">
      <AdminSectionHeader
        action={
          <AdminSessionActions
            leading={
              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]"
                  onClick={openCreateDialog}
                  type="button"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  新建考核
                </Button>
                <Button
                  className="rounded-[4px] border-[#d8c8b9]"
                  onClick={loadAll}
                  type="button"
                  variant="outline"
                >
                  刷新
                </Button>
              </div>
            }
          />
        }
        description="日常先浏览和筛选考核策略，需要调整时再进入创建或编辑窗口。"
        eyebrow="Exams"
        icon={<ClipboardList className="size-4" />}
        title="阶段考核"
      />

      {(message || error) && (
        <AdminNotice tone={error ? 'error' : 'success'}>{error ?? message}</AdminNotice>
      )}

      <ExamReadinessSummary readiness={readiness} />

      <AdminCard className="p-4" data-exam-policy-filters>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <Input
            aria-label="搜索考核"
            className={adminInputClassName}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索考核名称或目标角色"
            value={query}
          />
          <select
            aria-label="筛选考核状态"
            className={adminSelectClassName}
            onChange={(event) =>
              setStatusFilter(event.target.value as 'all' | AdminExamPolicy['status'])
            }
            value={statusFilter}
          >
            <option value="all">全部状态</option>
            <option value="draft">草稿</option>
            <option value="published">已发布</option>
            <option value="archived">已归档</option>
          </select>
        </div>
      </AdminCard>

      <AdminCard className="overflow-hidden">
        <div className="border-b border-[#d8c8b9] px-4 py-4">
          <div className="text-xl font-normal leading-tight text-[#2b211d]">考核策略列表</div>
          <p className="mt-1 text-sm text-[#75665d]">
            共 {filteredPolicies.length} 项；编辑配置后，再按状态发布、下架或删除草稿。
          </p>
        </div>
        {policies.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#75665d]">暂无阶段考核</div>
        ) : filteredPolicies.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[#75665d]">
            没有符合当前筛选条件的考核
          </div>
        ) : (
          <ExamPolicyTable
            categoryNames={categoryNames}
            deletingPolicyId={deletingPolicyId}
            onArchive={archivePolicy}
            onDelete={deletePolicy}
            onEdit={openEditDialog}
            onPublish={publishPolicy}
            policies={filteredPolicies}
            roleNames={roleNames}
          />
        )}
      </AdminCard>

      <ExamPolicyDialog
        candidateQuestionCount={dialogCandidateQuestionCount}
        categories={categories}
        courses={dialogCourses}
        draft={dialogDraft}
        mode={dialogMode}
        onCategoryToggle={(categoryId) =>
          setDialogDraft((draft) => ({
            ...draft,
            ...changeExamCategoryScope(draft.categoryIds, draft.courseIds, categoryId),
          }))
        }
        onClearCourses={() => updateDialogDraft({ courseIds: [] })}
        onCourseToggle={(courseId) =>
          setDialogDraft((draft) => ({
            ...draft,
            courseIds: toggleExamCourseSelection(draft.courseIds, courseId),
          }))
        }
        onDraftChange={updateDialogDraft}
        onOpenChange={setDialogOpen}
        onSave={saveDialogPolicy}
        open={dialogOpen}
        roles={learnerRoles}
        saving={saving}
      />
    </section>
  );
}

export { ExamPolicyActions } from '@/components/admin/exams/ExamPolicyTable';
