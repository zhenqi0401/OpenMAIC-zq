'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { Collapse, DatePicker, Input, Select } from 'antd';
import { CalendarRange, Search } from 'lucide-react';
import {
  AdminCard,
  AdminNotice,
  AdminPage,
  AdminSectionHeader,
  adminInputClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { CommunityContentList } from '@/components/admin/community/CommunityContentList';
import { CommunityModerationDialog } from '@/components/admin/community/CommunityModerationDialog';
import { Button } from '@/components/antd/AntdButton';
import {
  COMMUNITY_STATUS_LABELS,
  COMMUNITY_TARGET_LABELS,
  type AdminCommunityItem,
  type CommunityContentType,
  type CommunityModerationAction,
  availableCommunityTabs,
  communityActionLabel,
  moderationEndpoint,
} from '@/lib/admin/community-presentation';
import { adminErrorMessage, adminToast } from '@/lib/admin/toast';
import { isDanmakuEnabled, isForumEnabled } from '@/lib/config/feature-flags';
import { AdminMetricCard } from '@/components/admin/AdminPatterns';

interface CommunityResponse {
  items: AdminCommunityItem[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

interface CommunitySummary {
  posts: { count: number; changeRate: number | null };
  replies: { count: number; changeRate: number | null };
  moderationActions: { count: number; changeRate: number | null };
}

function trendLabel(rate: number | null) {
  if (rate === null) return '暂无可比数据';
  return `${rate >= 0 ? '+' : ''}${rate}% 较上一周期`;
}

const STATUS_OPTIONS: Record<CommunityContentType, Array<{ value: string; label: string }>> = {
  danmaku: Object.entries(COMMUNITY_STATUS_LABELS)
    .filter(([value]) => value !== 'archived')
    .map(([value, label]) => ({ value, label })),
  posts: Object.entries(COMMUNITY_STATUS_LABELS).map(([value, label]) => ({ value, label })),
  replies: Object.entries(COMMUNITY_STATUS_LABELS)
    .filter(([value]) => value !== 'archived')
    .map(([value, label]) => ({ value, label })),
  audit: Object.entries(COMMUNITY_TARGET_LABELS).map(([value, label]) => ({ value, label })),
};

function parseDateFilter(value: string) {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

export function CommunityAdminPanel() {
  const availableTabs = availableCommunityTabs(isDanmakuEnabled(), isForumEnabled());
  const [type, setType] = useState<CommunityContentType>(() =>
    isForumEnabled() ? 'posts' : isDanmakuEnabled() ? 'danmaku' : 'audit',
  );
  const [items, setItems] = useState<AdminCommunityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [keywordDraft, setKeywordDraft] = useState('');
  // 高级筛选：可搜索的用户/课程名称选项（选中后仍以 id 过滤，保持后端契约）
  const [authorOptions, setAuthorOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [courseOptions, setCourseOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [authorSearching, setAuthorSearching] = useState(false);
  const [courseSearching, setCourseSearching] = useState(false);
  const [moderationItem, setModerationItem] = useState<AdminCommunityItem | null>(null);
  const [moderationAction, setModerationAction] = useState<CommunityModerationAction | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [summary, setSummary] = useState<CommunitySummary | null>(null);
  const pageSize = 20;
  const hasActiveFilters = Boolean(keyword || authorId || courseId || status || from || to);

  const query = useMemo(() => {
    const search = new URLSearchParams({ type, page: String(page), pageSize: String(pageSize) });
    if (keyword.trim()) search.set('keyword', keyword.trim());
    if (authorId.trim()) search.set('authorId', authorId.trim());
    if (courseId.trim() && type !== 'audit') search.set('courseId', courseId.trim());
    if (status) search.set('status', status);
    if (from) search.set('from', new Date(from).toISOString());
    if (to) search.set('to', new Date(to).toISOString());
    return search.toString();
  }, [authorId, courseId, from, keyword, page, status, to, type]);

  const load = useCallback(
    async (notify = false) => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await fetch(`/api/admin/community?${query}`);
        const data = (await response.json()) as CommunityResponse;
        if (!response.ok) throw new Error(data.error || '社区内容加载失败');
        setItems(data.items);
        setTotal(data.total);
        if (notify) adminToast.success('社区内容已刷新');
      } catch (cause) {
        const message = adminErrorMessage(cause, '社区内容加载失败');
        setLoadError(message);
        if (notify) adminToast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  const loadSummary = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/community/summary?range=today');
      if (!response.ok) throw new Error();
      const data = (await response.json()) as { summary: CommunitySummary };
      setSummary(data.summary);
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // 关键词输入 debounce 400ms 后生效，Select/日期即时生效。
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeyword(keywordDraft.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [keywordDraft]);

  function changeType(next: CommunityContentType) {
    setType(next);
    setStatus('');
    setPage(1);
    setModerationItem(null);
    setModerationAction(null);
  }

  async function searchUsers(queryText: string) {
    setAuthorSearching(true);
    try {
      const response = await fetch(`/api/admin/users?q=${encodeURIComponent(queryText)}&pageSize=50`);
      if (!response.ok) return;
      const data = (await response.json()) as { users?: Array<{ id: string; displayName: string; phone: string | null }> };
      setAuthorOptions(
        (data.users ?? []).map((user) => ({
          id: user.id,
          label: user.displayName || user.phone || user.id,
        })),
      );
    } finally {
      setAuthorSearching(false);
    }
  }

  async function searchCourses(queryText: string) {
    setCourseSearching(true);
    try {
      const response = await fetch(`/api/admin/courses?q=${encodeURIComponent(queryText)}&pageSize=50`);
      if (!response.ok) return;
      const data = (await response.json()) as { courses?: Array<{ id: string; name: string }> };
      setCourseOptions(
        (data.courses ?? []).map((course) => ({ id: course.id, label: course.name })),
      );
    } finally {
      setCourseSearching(false);
    }
  }

  function resetFilters() {
    setKeyword('');
    setAuthorId('');
    setCourseId('');
    setStatus('');
    setFrom('');
    setTo('');
    setKeywordDraft('');
    setAuthorOptions([]);
    setCourseOptions([]);
    setPage(1);
  }

  function openModeration(item: AdminCommunityItem, action: CommunityModerationAction) {
    setModerationItem(item);
    setModerationAction(action);
    setModerationError(null);
  }

  function closeModeration() {
    setModerationItem(null);
    setModerationAction(null);
    setModerationError(null);
  }

  async function moderate(reason: string) {
    if (!moderationItem || !moderationAction || type === 'audit') return;
    const itemId = moderationItem.id;
    const path = moderationEndpoint(type, itemId);
    setPendingItemId(itemId);
    setModerationError(null);
    try {
      const response = await fetch(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: moderationAction, reason }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || '管理操作失败');
      const actionLabel =
        type === 'danmaku' && moderationAction === 'hide'
          ? '下架'
          : communityActionLabel(moderationAction);
      adminToast.success(`${actionLabel}操作成功`);
      closeModeration();
      await load();
      await loadSummary();
    } catch (cause) {
      const message = adminErrorMessage(cause, '管理操作失败');
      setModerationError(message);
      adminToast.error(message);
    } finally {
      setPendingItemId(null);
    }
  }

  return (
    <AdminPage data-community-admin-panel>
      <AdminSectionHeader title="社区内容" />

      <div className="grid gap-3 sm:grid-cols-3">
        <AdminMetricCard
          label="今日新帖"
          value={summary?.posts.count ?? '—'}
          detail={summary ? trendLabel(summary.posts.changeRate) : '统计加载失败'}
        />
        <AdminMetricCard
          label="今日回复"
          value={summary?.replies.count ?? '—'}
          detail={summary ? trendLabel(summary.replies.changeRate) : '统计加载失败'}
        />
        <AdminMetricCard
          label="管理操作"
          value={summary?.moderationActions.count ?? '—'}
          detail={summary ? trendLabel(summary.moderationActions.changeRate) : '统计加载失败'}
        />
      </div>

      <AdminCard className="overflow-hidden" data-community-workbench>
        <div className="border-b border-[var(--admin-border-subtle)] px-4">
          <AdminTabs
            ariaLabel="社区内容类型"
            items={availableTabs}
            onValueChange={changeType}
            value={type}
          />
        </div>

        <div className="border-b border-[var(--admin-border-subtle)] px-4 pt-3">
          <div
            className="grid gap-3 xl:grid-cols-[minmax(180px,1fr)_minmax(160px,0.8fr)_minmax(220px,1.2fr)_auto] xl:items-center"
            data-community-filters
          >
            <Input
              allowClear
              aria-label="关键词"
              className={adminInputClassName}
              onChange={(event) => setKeywordDraft(event.target.value)}
              placeholder={type === 'audit' ? '操作或原因关键词' : '内容关键词'}
              value={keywordDraft}
            />
            <Select
              aria-label={type === 'audit' ? '审计目标类型' : '内容状态'}
              className="w-full"
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              value={status}
              options={[
                { value: '', label: `全部${type === 'audit' ? '目标' : '状态'}` },
                ...STATUS_OPTIONS[type].map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
              ]}
            />
            <DatePicker.RangePicker
              aria-label="日期范围"
              className="w-full"
              format="YYYY-MM-DD HH:mm"
              placeholder={['开始时间', '结束时间']}
              showTime={{ format: 'HH:mm' }}
              value={[parseDateFilter(from), parseDateFilter(to)]}
              onChange={(dates) => {
                setFrom(dates?.[0]?.format('YYYY-MM-DDTHH:mm') ?? '');
                setTo(dates?.[1]?.format('YYYY-MM-DDTHH:mm') ?? '');
                setPage(1);
              }}
              separator={<CalendarRange aria-hidden="true" className="size-4" />}
            />
            <div className="flex gap-2">
              <Button
                className={adminSecondaryButtonClassName}
                onClick={resetFilters}
                type="button"
                variant="outline"
              >
                清空
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 py-3">
            <span className="inline-flex items-center gap-2 text-xs text-[var(--admin-muted-foreground)]">
              <Search className="size-3.5" /> 共 {total} 条记录
            </span>
            {from || to ? (
              <span className="text-xs text-[var(--admin-muted-foreground)]">
                日期：{from ? from.replace('T', ' ') : '不限'} 至{' '}
                {to ? to.replace('T', ' ') : '不限'}
              </span>
            ) : null}
          </div>
        </div>

        <div className="border-b border-[var(--admin-border-subtle)] px-4 pb-3">
          <Collapse
            ghost
            items={[
              {
                key: 'advanced',
                label: '高级筛选',
                children: (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select
                      allowClear
                      aria-label={type === 'audit' ? '按管理员名称筛选' : '按作者名称筛选'}
                      filterOption={false}
                      loading={authorSearching}
                      notFoundContent={authorSearching ? '搜索中…' : '输入名称搜索用户'}
                      onChange={(value) => {
                        setAuthorId(value ?? '');
                        setPage(1);
                      }}
                      onSearch={searchUsers}
                      placeholder={type === 'audit' ? '按管理员名称筛选' : '按作者名称筛选'}
                      showSearch
                      value={authorId || undefined}
                      options={authorOptions.map((option) => ({
                        value: option.id,
                        label: option.label,
                      }))}
                    />
                    {type !== 'audit' ? (
                      <Select
                        allowClear
                        aria-label="按课程名称筛选"
                        filterOption={false}
                        loading={courseSearching}
                        notFoundContent={courseSearching ? '搜索中…' : '输入名称搜索课程'}
                        onChange={(value) => {
                          setCourseId(value ?? '');
                          setPage(1);
                        }}
                        onSearch={searchCourses}
                        placeholder="按课程名称筛选"
                        showSearch
                        value={courseId || undefined}
                        options={courseOptions.map((option) => ({
                          value: option.id,
                          label: option.label,
                        }))}
                      />
                    ) : null}
                  </div>
                ),
              },
            ]}
          />
        </div>

        {loadError && items.length ? (
          <div className="border-b border-[var(--admin-border-subtle)] p-4">
            <AdminNotice tone="error">{loadError}</AdminNotice>
          </div>
        ) : null}

        <div aria-live="polite" data-community-content>
          {loading && !items.length ? (
            <div className="p-8 text-center text-sm text-[var(--admin-muted-foreground)]">
              正在加载社区内容…
            </div>
          ) : loadError && !items.length ? (
            <div className="p-4">
              <AdminEmptyState
                action={
                  <Button onClick={() => void load()} type="button" variant="outline">
                    重新加载
                  </Button>
                }
                compact
                description={loadError}
                kind="error"
                title="社区内容加载失败"
              />
            </div>
          ) : !items.length ? (
            <div className="p-4">
              <AdminEmptyState
                compact
                description={
                  hasActiveFilters ? '请调整筛选条件后再试。' : '这个类型下暂时没有需要展示的记录。'
                }
                kind={hasActiveFilters ? 'filtered' : 'empty'}
                title={hasActiveFilters ? '当前筛选没有结果' : '当前类型暂无记录'}
              />
            </div>
          ) : (
            <CommunityContentList
              items={items}
              onModerate={openModeration}
              pendingItemId={pendingItemId}
              type={type}
            />
          )}
        </div>

        <div className="border-t border-[var(--admin-border-subtle)] p-4">
          <AdminPagination
            loading={loading}
            onPageChange={setPage}
            page={page}
            pageSize={pageSize}
            total={total}
          />
        </div>
      </AdminCard>

      <CommunityModerationDialog
        action={moderationAction}
        actionDisplayLabel={type === 'danmaku' && moderationAction === 'hide' ? '下架' : undefined}
        error={moderationError}
        item={moderationItem}
        key={`${moderationItem?.id ?? 'closed'}:${moderationAction ?? 'none'}`}
        onOpenChange={(open) => !open && closeModeration()}
        onSubmit={(reason) => void moderate(reason)}
        open={Boolean(moderationItem && moderationAction)}
        submitting={pendingItemId === moderationItem?.id}
      />
    </AdminPage>
  );
}
