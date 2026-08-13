'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Input, Segmented, Select } from 'antd';
import { adminToast } from '@/lib/admin/toast';
import {
  AdminCard,
  AdminPage,
  AdminSectionHeader,
  adminInputClassName,
  adminPrimaryButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { ExamPolicyDialog } from '@/components/admin/exams/ExamPolicyDialog';
import { ExamPolicyTable } from '@/components/admin/exams/ExamPolicyTable';
import { ExamReadinessSummary } from '@/components/admin/exams/ExamReadinessSummary';
import { ExamResultsDrawer } from '@/components/admin/exams/ExamResultsDrawer';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
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
  const [dialogCoursesLoaded, setDialogCoursesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null);
  const [resultPolicy, setResultPolicy] = useState<AdminExamPolicy | null>(null);
  const [targetRoleId, setTargetRoleId] = useState('');
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
      try {
        const [roleResult, categoriesResult, policyResult] = await Promise.allSettled([
          client.listRoles(),
          fetch('/api/admin/categories'),
          client.queryExamPolicies({
            q: query || undefined,
            status: statusFilter,
            targetRoleId: targetRoleId || undefined,
            page,
            pageSize: 20,
          }),
        ]);
        if (policyResult.status === 'rejected') throw policyResult.reason;
        setPolicies(policyResult.value.items);
        setSummary(policyResult.value.summary);
        setPagination(policyResult.value.pagination);
        if (roleResult.status === 'fulfilled') setRoles(roleResult.value);
        if (categoriesResult.status === 'fulfilled' && categoriesResult.value.ok) {
          const categoriesData = (await categoriesResult.value.json()) as {
            categories: ExamCategory[];
          };
          setCategories(categoriesData.categories);
        }
        if (notify) notifySuccess('考核列表已刷新');
      } catch (loadError) {
        notifyError(loadError, '考核策略加载失败');
      }
    },
    [client, page, query, statusFilter, targetRoleId],
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // 搜索输入 debounce 400ms 后提交，避免每次击键触发服务端请求。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(queryDraft.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [queryDraft]);

  const loadDialogCourses = useCallback(async () => {
    if (dialogCoursesLoaded) return;
    const response = await fetch('/api/admin/courses?status=published&pageSize=100');
    if (!response.ok) throw new Error('考核课程加载失败');
    const data = (await response.json()) as { courses: EnterpriseCourse[] };
    setCourses(data.courses);
    setDialogCoursesLoaded(true);
  }, [dialogCoursesLoaded]);

  function openCreateDialog() {
    setDialogMode('create');
    setDialogPolicyId(null);
    setDialogDraft(createEmptyPolicyDraft(learnerRoles[0]?.id, categories[0]?.id));
    setDialogOpen(true);
    void loadDialogCourses().catch((error) => notifyError(error, '考核课程加载失败'));
  }

  function openEditDialog(policy: AdminExamPolicy) {
    setDialogMode('edit');
    setDialogPolicyId(policy.id);
    setDialogDraft(toPolicyDraft(policy));
    setDialogOpen(true);
    void loadDialogCourses().catch((error) => notifyError(error, '考核课程加载失败'));
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

  function clearFilters() {
    setQueryDraft('');
    setQuery('');
    setStatusFilter('all');
    setTargetRoleId('');
    setPage(1);
  }

  return (
    <AdminPage id="admin-exams">
      <AdminSectionHeader title="阶段考核" />

      <ExamReadinessSummary readiness={readiness} summary={summary} />

      <AdminCard className="overflow-hidden" data-exam-policy-list>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-4">
          <div className="text-xl font-normal leading-tight text-[var(--admin-foreground)]">
            考核策略列表
          </div>
          <Button className={adminPrimaryButtonClassName} onClick={openCreateDialog} type="button">
            <Plus aria-hidden="true" className="size-4" />
            新建考核
          </Button>
        </div>
        <div
          className="px-4 pt-3"
          data-exam-policy-status-bar
        >
          <Segmented
            aria-label="考核策略状态"
            onChange={(value) => {
              setStatusFilter(value as typeof statusFilter);
              setPage(1);
            }}
            options={[
              { value: 'all', label: '全部' },
              { value: 'published', label: '已发布' },
              { value: 'draft', label: '草稿' },
              { value: 'archived', label: '已归档' },
            ]}
            value={statusFilter}
          />
        </div>
        <div className="border-b border-[var(--admin-border-subtle)] p-4" data-exam-policy-filters>
          <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_220px_auto] lg:items-center">
            <Input
              allowClear
              aria-label="搜索考核"
              className={adminInputClassName}
              onChange={(event) => setQueryDraft(event.target.value)}
              placeholder="搜索考核名称或目标角色"
              value={queryDraft}
            />
            <Select
              aria-label="筛选目标角色"
              className="w-full"
              onChange={(value) => {
                setTargetRoleId(value);
                setPage(1);
              }}
              value={targetRoleId}
              options={[
                { value: '', label: '全部目标角色' },
                ...learnerRoles.map((role) => ({ value: role.id, label: role.name })),
              ]}
            />
            <div className="flex flex-wrap gap-2 lg:justify-end">
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
          // 新建考核入口在页面头部工具栏已提供，空态不再重复放置按钮
          <AdminEmptyState title="暂无阶段考核" />
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
            onPageChange={setPage}
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
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
  adminToast.success(message);
}

function notifyError(error: unknown, fallback: string) {
  adminToast.error(error instanceof Error ? error.message : fallback);
}
