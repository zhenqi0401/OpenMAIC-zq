'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquareText, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import {
  AdminCard,
  AdminNotice,
  AdminSectionHeader,
  adminInputClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminSessionActions } from '@/components/admin/AdminSessionActions';
import { AdminTabs } from '@/components/admin/AdminTabs';
import { CommunityItemRow } from '@/components/admin/community/CommunityItemRow';
import { CommunityModerationDialog } from '@/components/admin/community/CommunityModerationDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/lib/utils';

interface CommunityResponse {
  items: AdminCommunityItem[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
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

export function CommunityAdminPanel() {
  const availableTabs = availableCommunityTabs(isDanmakuEnabled(), isForumEnabled());
  const [type, setType] = useState<CommunityContentType>(() =>
    isDanmakuEnabled() ? 'danmaku' : isForumEnabled() ? 'posts' : 'audit',
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
  const [moderationItem, setModerationItem] = useState<AdminCommunityItem | null>(null);
  const [moderationAction, setModerationAction] = useState<CommunityModerationAction | null>(null);
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
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

  useEffect(() => {
    void load();
  }, [load]);

  function changeType(next: CommunityContentType) {
    setType(next);
    setStatus('');
    setPage(1);
    setModerationItem(null);
    setModerationAction(null);
  }

  function resetFilters() {
    setKeyword('');
    setAuthorId('');
    setCourseId('');
    setStatus('');
    setFrom('');
    setTo('');
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
      adminToast.success(`${communityActionLabel(moderationAction)}操作成功`);
      closeModeration();
      await load();
    } catch (cause) {
      const message = adminErrorMessage(cause, '管理操作失败');
      setModerationError(message);
      adminToast.error(message);
    } finally {
      setPendingItemId(null);
    }
  }

  return (
    <div className="grid gap-5" data-community-admin-panel>
      <AdminSectionHeader
        action={<AdminSessionActions />}
        description="统一检索和处置弹幕、帖子与回复；每次管理员操作均保留操作者、原因和时间。"
        eyebrow="Community governance"
        icon={<MessageSquareText className="size-4" />}
        title="社区内容"
      />

      <AdminTabs
        ariaLabel="社区内容类型"
        items={availableTabs}
        onValueChange={changeType}
        value={type}
      />

      <AdminCard className="grid gap-3 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input
            aria-label="关键词"
            className={adminInputClassName}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder={type === 'audit' ? '操作或原因关键词' : '内容关键词'}
            value={keyword}
          />
          <Input
            aria-label={type === 'audit' ? '管理员用户 ID' : '作者用户 ID'}
            className={adminInputClassName}
            onChange={(event) => {
              setAuthorId(event.target.value);
              setPage(1);
            }}
            placeholder={type === 'audit' ? '管理员用户 ID' : '作者用户 ID'}
            value={authorId}
          />
          {type !== 'audit' ? (
            <Input
              aria-label="课程 ID"
              className={adminInputClassName}
              onChange={(event) => {
                setCourseId(event.target.value);
                setPage(1);
              }}
              placeholder="课程 ID"
              value={courseId}
            />
          ) : null}
          <select
            aria-label={type === 'audit' ? '审计目标类型' : '内容状态'}
            className={adminSelectClassName}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            value={status}
          >
            <option value="">全部{type === 'audit' ? '目标' : '状态'}</option>
            {STATUS_OPTIONS[type].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            aria-label="开始时间"
            className={adminInputClassName}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            type="datetime-local"
            value={from}
          />
          <Input
            aria-label="结束时间"
            className={adminInputClassName}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            type="datetime-local"
            value={to}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs text-[#75665d]">
            <Search className="size-3.5" /> 共 {total} 条记录
          </span>
          <div className="flex gap-2">
            <Button onClick={resetFilters} size="sm" type="button" variant="outline">
              清空筛选
            </Button>
            <Button
              disabled={loading}
              onClick={() => void load(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} /> 刷新
            </Button>
          </div>
        </div>
      </AdminCard>

      {loadError && items.length ? <AdminNotice tone="error">{loadError}</AdminNotice> : null}

      <div className="grid gap-3" aria-live="polite">
        {loading && !items.length ? (
          <AdminCard className="p-8 text-center text-sm text-[#75665d]">
            正在加载社区内容…
          </AdminCard>
        ) : loadError && !items.length ? (
          <AdminEmptyState
            action={
              <Button onClick={() => void load()} type="button" variant="outline">
                重新加载
              </Button>
            }
            description={loadError}
            kind="error"
            title="社区内容加载失败"
          />
        ) : !items.length ? (
          <AdminEmptyState
            description={
              hasActiveFilters ? '请调整筛选条件后再试。' : '这个类型下暂时没有需要展示的记录。'
            }
            kind={hasActiveFilters ? 'filtered' : 'empty'}
            title={hasActiveFilters ? '当前筛选没有结果' : '当前类型暂无记录'}
          />
        ) : (
          items.map((item) => (
            <CommunityItemRow
              item={item}
              key={item.id}
              onModerate={(action) => openModeration(item, action)}
              pending={pendingItemId === item.id}
              type={type}
            />
          ))
        )}
      </div>

      <AdminPagination
        end={Math.min(page * pageSize, total)}
        loading={loading}
        onPageChange={setPage}
        page={page}
        start={total ? (page - 1) * pageSize + 1 : 0}
        total={total}
        totalPages={pageCount}
      />

      <AdminNotice>
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4" /> 社区正文按纯文本安全输出；原始
          HTML、危险协议和控制字符会在服务端拒绝。
        </span>
      </AdminNotice>

      <CommunityModerationDialog
        action={moderationAction}
        error={moderationError}
        item={moderationItem}
        key={`${moderationItem?.id ?? 'closed'}:${moderationAction ?? 'none'}`}
        onOpenChange={(open) => !open && closeModeration()}
        onSubmit={(reason) => void moderate(reason)}
        open={Boolean(moderationItem && moderationAction)}
        submitting={pendingItemId === moderationItem?.id}
      />
    </div>
  );
}
