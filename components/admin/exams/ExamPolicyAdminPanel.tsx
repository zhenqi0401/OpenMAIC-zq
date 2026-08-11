'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { Input, Select } from 'antd';
import { toast } from 'sonner';
import {
  adminErrorToastStyle as errorToastStyle,
  adminSuccessToastStyle as successToastStyle,
} from '@/lib/admin/toast';
import {
  AdminCard,
  AdminPage,
  AdminSectionHeader,
  adminInputClassName,
  adminPrimaryButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
import { AdminRefreshButton } from '@/components/admin/AdminRefreshButton';
import { ExamPolicyDialog } from '@/components/admin/exams/ExamPolicyDialog';
import { ExamPolicyTable } from '@/components/admin/exams/ExamPolicyTable';
import { ExamReadinessSummary } from '@/components/admin/exams/ExamReadinessSummary';
import { ExamResultsDrawer } from '@/components/admin/exams/ExamResultsDrawer';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { Button } from '@/components/antd/AntdButton';
import {
  createAdminClient,
  type AdminExamPolicy,
  type AdminExamSummary,
  type AdminPagination as Pagination,
} from '@/lib/admin/client';
import {
  changeExamCategoryScope,
  filterExamScopeCourses,
  toggleExamCourseSelection,
} from '@/lib/admin/exam-policy-scope';
import {
  countDraftCandidateQuestions,
  createEmptyPolicyDraft,
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
  const [queryDraft, setQueryDraft] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AdminExamPolicy['status']>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null);
  const [resultPolicy, setResultPolicy] = useState<AdminExamPolicy | null>(null);
  const [targetRoleId, setTargetRoleId] = useState('');
  const [targetRoleIdDraft, setTargetRoleIdDraft] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [summary, setSummary] = useState<AdminExamSummary>({
    publishedCourseCount: 0,
    readyCourseCount: 0,
    missingQuestionCourseCount: 0,
    examAttemptCount: 0,
    passRate: null,
    averageScore: null,
  });

  const learnerRoles = useMemo(() => roles.filter((role) => !role.isAdmin), [roles]);
  const publishedCourses = useMemo(
    () => courses.filter((course) => course.status === 'published'),
    [courses],
  );
  const readiness = {
    publishedCourseCount: summary.publishedCourseCount,
    readyCourseCount: summary.readyCourseCount,
    missingQuestionCourseCount: summary.missingQuestionCourseCount,
  };
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
  const loadAll = useCallback(
    async (notify = false) => {
      setLoading(true);
      try {
        const [roleData, categoriesResponse, coursesResponse, policyData] = await Promise.all([
          client.listRoles(),
          fetch('/api/admin/categories'),
          fetch('/api/admin/courses?pageSize=100'),
          client.queryExamPolicies({
            q: query || undefined,
            status: statusFilter,
            targetRoleId: targetRoleId || undefined,
            page,
            pageSize: 20,
          }),
        ]);
        if (!categoriesResponse.ok || !coursesResponse.ok) throw new Error('分类或课程加载失败');
        const categoriesData = (await categoriesResponse.json()) as { categories: ExamCategory[] };
        const coursesData = (await coursesResponse.json()) as { courses: EnterpriseCourse[] };
        setRoles(roleData);
        setCategories(categoriesData.categories);
        setCourses(coursesData.courses);
        setPolicies(policyData.items);
        setSummary(policyData.summary);
        setPagination(policyData.pagination);
        if (notify) notifySuccess('考核列表已刷新');
      } catch (loadError) {
        notifyError(loadError, '考核策略加载失败');
      } finally {
        setLoading(false);
      }
    },
    [client, page, query, statusFilter, targetRoleId],
  );

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
      notifyError(null, '标题、目标角色和分类必填');
      return;
    }
    setSaving(true);
    try {
      if (dialogMode === 'create') {
        await client.createExamPolicy(toPolicyInput(dialogDraft));
        notifySuccess('考核策略已创建');
      } else if (dialogPolicyId) {
        await client.updateExamPolicy(dialogPolicyId, toPolicyInput(dialogDraft));
        notifySuccess('考核策略已保存');
      }
      setDialogOpen(false);
      await loadAll();
    } catch (saveError) {
      notifyError(saveError, '考核策略保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function publishPolicy(policyId: string) {
    try {
      await client.publishExamPolicy(policyId);
      notifySuccess('考核策略已发布');
      await loadAll();
    } catch (saveError) {
      notifyError(saveError, '考核策略发布失败');
    }
  }

  async function archivePolicy(policyId: string) {
    try {
      await client.updateExamPolicy(policyId, { status: 'archived' });
      notifySuccess('考核策略已下架');
      await loadAll();
    } catch (saveError) {
      notifyError(saveError, '考核策略下架失败');
    }
  }

  async function deletePolicy(policyId: string) {
    setDeletingPolicyId(policyId);
    try {
      await client.deleteExamPolicy(policyId);
      notifySuccess('考核策略已删除');
      await loadAll();
    } catch (deleteError) {
      notifyError(deleteError, '考核策略删除失败');
    } finally {
      setDeletingPolicyId(null);
    }
  }

  function applyFilters() {
    setQuery(queryDraft.trim());
    setTargetRoleId(targetRoleIdDraft);
    setPage(1);
  }

  function clearFilters() {
    setQueryDraft('');
    setTargetRoleIdDraft('');
    setQuery('');
    setTargetRoleId('');
    setStatusFilter('all');
    setPage(1);
  }

  return (
    <AdminPage id="admin-exams">
      <AdminSectionHeader
        action={
          <AdminSessionActions
            leading={<AdminRefreshButton loading={loading} onRefresh={() => void loadAll(true)} />}
          />
        }
        description="日常先浏览和筛选考核策略，需要调整时再进入创建或编辑窗口。"
        eyebrow="Exams"
        icon={<ClipboardList className="size-4" />}
        title="阶段考核"
      />

      <ExamReadinessSummary readiness={readiness} summary={summary} />

      <AdminCard className="overflow-hidden" data-exam-policy-list>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-4">
          <div>
            <div className="text-xl font-normal leading-tight text-[var(--admin-foreground)]">
              考核策略列表
            </div>
            <p className="mt-1 text-sm text-[var(--admin-muted-foreground)]">
              编辑配置后，再按状态发布、下架、重新发布或删除草稿。
            </p>
          </div>
          <Button className={adminPrimaryButtonClassName} onClick={openCreateDialog} type="button">
            <Plus aria-hidden="true" className="size-4" />
            新建考核
          </Button>
        </div>
        <div
          aria-label="考核策略状态"
          className="flex flex-wrap gap-2 border-b border-[var(--admin-border-subtle)] px-4 py-3"
          data-exam-policy-status-bar
          role="group"
        >
          {(
            [
              ['all', '全部'],
              ['published', '已发布'],
              ['draft', '草稿'],
              ['archived', '已归档'],
            ] as const
          ).map(([value, label]) => (
            <Button
              aria-pressed={statusFilter === value}
              className={
                statusFilter === value
                  ? 'rounded-[var(--admin-radius-control)] bg-[var(--admin-selection-background)] text-[var(--admin-selection-foreground)] shadow-none'
                  : 'rounded-[var(--admin-radius-control)] text-[var(--admin-muted-foreground)]'
              }
              key={value}
              onClick={() => {
                setStatusFilter(value);
                setPage(1);
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="border-b border-[var(--admin-border-subtle)] p-4" data-exam-policy-filters>
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_auto] lg:items-center">
            <Input
              aria-label="搜索考核"
              className={adminInputClassName}
              onChange={(event) => setQueryDraft(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && applyFilters()}
              placeholder="搜索考核名称或目标角色"
              value={queryDraft}
            />
            <Select
              aria-label="筛选目标角色"
              className="w-full"
              onChange={(value) => setTargetRoleIdDraft(value)}
              value={targetRoleIdDraft}
              options={[
                { value: '', label: '全部目标角色' },
                ...learnerRoles.map((role) => ({ value: role.id, label: role.name })),
              ]}
            />
            <div className="flex flex-wrap gap-2 lg:justify-end">
              <Button className={adminPrimaryButtonClassName} onClick={applyFilters} type="button">
                筛选
              </Button>
              <Button
                className={adminSecondaryButtonClassName}
                onClick={clearFilters}
                type="button"
                variant="outline"
              >
                清除筛选
              </Button>
            </div>
          </div>
        </div>
        {policies.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--admin-muted-foreground)]">
            暂无阶段考核
          </div>
        ) : (
          <ExamPolicyTable
            categoryNames={categoryNames}
            deletingPolicyId={deletingPolicyId}
            onArchive={archivePolicy}
            onDelete={deletePolicy}
            onEdit={openEditDialog}
            onPublish={publishPolicy}
            onView={setResultPolicy}
            policies={policies}
            roleNames={roleNames}
          />
        )}
        <div className="border-t border-[var(--admin-border-subtle)] p-4">
          <AdminPagination
            end={Math.min(pagination.page * pagination.pageSize, pagination.total)}
            onPageChange={setPage}
            page={pagination.page}
            start={pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
            total={pagination.total}
            totalPages={pagination.totalPages}
          />
        </div>
      </AdminCard>

      <ExamResultsDrawer
        policy={resultPolicy}
        onOpenChange={(open) => !open && setResultPolicy(null)}
      />

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
    </AdminPage>
  );
}

export { ExamPolicyActions } from '@/components/admin/exams/ExamPolicyTable';

function notifySuccess(message: string) {
  toast.success(message, { style: successToastStyle });
}

function notifyError(error: unknown, fallback: string) {
  toast.error(error instanceof Error ? error.message : fallback, { style: errorToastStyle });
}
