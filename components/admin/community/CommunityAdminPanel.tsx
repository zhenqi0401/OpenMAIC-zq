'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquareText, RefreshCw, Search, ShieldCheck } from 'lucide-react';
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
import { cn } from '@/lib/utils';

type ContentType = 'danmaku' | 'posts' | 'replies' | 'audit';

interface AdminCommunityItem {
  id: string;
  status?: string;
  content?: string;
  title?: string;
  body?: string;
  postId?: string;
  postTitle?: string;
  courseId?: string | null;
  courseName?: string | null;
  sceneKey?: string;
  actionId?: string;
  pinned?: boolean;
  locked?: boolean;
  replyCount?: number;
  targetType?: string;
  targetId?: string;
  action?: string;
  reason?: string | null;
  moderationReason?: string | null;
  createdAt: string;
  author?: { id: string; displayName: string; roleName: string; roleCode: string };
  moderator?: { id: string; displayName: string };
}

interface CommunityResponse {
  items: AdminCommunityItem[];
  total: number;
  page: number;
  pageSize: number;
  error?: string;
}

const TABS: Array<{ id: ContentType; label: string }> = [
  { id: 'danmaku', label: '弹幕' },
  { id: 'posts', label: '帖子' },
  { id: 'replies', label: '回复' },
  { id: 'audit', label: '操作审计' },
];

const STATUS_OPTIONS: Record<ContentType, Array<{ value: string; label: string }>> = {
  danmaku: [
    { value: 'visible', label: '正常' },
    { value: 'hidden', label: '已隐藏' },
    { value: 'deleted_by_author', label: '作者删除' },
    { value: 'deleted_by_admin', label: '管理员删除' },
  ],
  posts: [
    { value: 'visible', label: '正常' },
    { value: 'hidden', label: '已隐藏' },
    { value: 'deleted_by_author', label: '作者删除' },
    { value: 'deleted_by_admin', label: '管理员删除' },
    { value: 'archived', label: '已归档' },
  ],
  replies: [
    { value: 'visible', label: '正常' },
    { value: 'hidden', label: '已隐藏' },
    { value: 'deleted_by_author', label: '作者删除' },
    { value: 'deleted_by_admin', label: '管理员删除' },
  ],
  audit: [
    { value: 'danmaku', label: '弹幕操作' },
    { value: 'forum_post', label: '帖子操作' },
    { value: 'forum_reply', label: '回复操作' },
  ],
};

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN');
}

function statusTone(status: string | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'visible') return 'success';
  if (status === 'hidden') return 'warning';
  if (status?.startsWith('deleted')) return 'danger';
  return 'neutral';
}

export function CommunityAdminPanel() {
  const [type, setType] = useState<ContentType>('danmaku');
  const [items, setItems] = useState<AdminCommunityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/community?${query}`);
      const data = (await response.json()) as CommunityResponse;
      if (!response.ok) throw new Error(data.error || '社区内容加载失败');
      setItems(data.items);
      setTotal(data.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '社区内容加载失败');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  function changeType(next: ContentType) {
    setType(next);
    setStatus('');
    setPage(1);
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

  async function moderate(item: AdminCommunityItem, action: string) {
    const reason = window.prompt('请输入本次管理操作原因（可留空）：', '') ?? null;
    if (reason === null) return;
    const path =
      type === 'danmaku'
        ? `/api/admin/danmaku/${encodeURIComponent(item.id)}`
        : type === 'posts'
          ? `/api/admin/forum/posts/${encodeURIComponent(item.id)}`
          : `/api/admin/forum/replies/${encodeURIComponent(item.id)}`;
    setPendingAction(`${item.id}:${action}`);
    setError(null);
    try {
      const response = await fetch(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || '管理操作失败');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '管理操作失败');
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="grid gap-5">
      <AdminSectionHeader
        icon={<MessageSquareText className="size-4" />}
        eyebrow="Community governance"
        title="社区内容"
        description="统一检索和处置弹幕、帖子与回复；每次管理员操作均保留操作者、原因和时间。"
        action={<AdminSessionActions />}
      />

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="社区内容类型">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            role="tab"
            aria-selected={type === tab.id}
            variant={type === tab.id ? 'default' : 'outline'}
            onClick={() => changeType(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <AdminCard className="grid gap-3 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input
            className={adminInputClassName}
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
            placeholder={type === 'audit' ? '操作或原因关键词' : '内容关键词'}
            aria-label="关键词"
          />
          <Input
            className={adminInputClassName}
            value={authorId}
            onChange={(event) => {
              setAuthorId(event.target.value);
              setPage(1);
            }}
            placeholder={type === 'audit' ? '管理员用户 ID' : '作者用户 ID'}
            aria-label={type === 'audit' ? '管理员用户 ID' : '作者用户 ID'}
          />
          {type !== 'audit' && (
            <Input
              className={adminInputClassName}
              value={courseId}
              onChange={(event) => {
                setCourseId(event.target.value);
                setPage(1);
              }}
              placeholder="课程 ID"
              aria-label="课程 ID"
            />
          )}
          <select
            className={adminSelectClassName}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label={type === 'audit' ? '审计目标类型' : '内容状态'}
          >
            <option value="">全部{type === 'audit' ? '目标' : '状态'}</option>
            {STATUS_OPTIONS[type].map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Input
            className={adminInputClassName}
            type="datetime-local"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPage(1);
            }}
            aria-label="开始时间"
          />
          <Input
            className={adminInputClassName}
            type="datetime-local"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPage(1);
            }}
            aria-label="结束时间"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-xs text-[#75665d]">
            <Search className="size-3.5" /> 共 {total} 条记录
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={resetFilters}>
              清空筛选
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} /> 刷新
            </Button>
          </div>
        </div>
      </AdminCard>

      {error && <AdminNotice tone="error">{error}</AdminNotice>}

      <div className="grid gap-3" aria-live="polite">
        {loading && !items.length ? (
          <AdminCard className="p-8 text-center text-sm text-[#75665d]">
            正在加载社区内容…
          </AdminCard>
        ) : !items.length ? (
          <AdminCard className="p-8 text-center text-sm text-[#75665d]">
            当前筛选下没有记录
          </AdminCard>
        ) : (
          items.map((item) => (
            <AdminCard key={item.id} className="grid gap-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.status && (
                      <AdminStatusBadge tone={statusTone(item.status)}>
                        {item.status}
                      </AdminStatusBadge>
                    )}
                    {item.targetType && <AdminStatusBadge>{item.targetType}</AdminStatusBadge>}
                    {item.pinned && <AdminStatusBadge tone="warning">置顶</AdminStatusBadge>}
                    {item.locked && <AdminStatusBadge tone="warning">已关闭回复</AdminStatusBadge>}
                  </div>
                  {item.title && <h3 className="mt-2 font-medium">{item.title}</h3>}
                  {item.postTitle && (
                    <p className="mt-2 text-xs text-[#75665d]">所属帖子：{item.postTitle}</p>
                  )}
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">
                    {item.content ?? item.body ?? item.reason ?? '无文本内容'}
                  </p>
                </div>
                <time className="shrink-0 text-xs text-[#75665d]">
                  {formatTime(item.createdAt)}
                </time>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#eaded1] pt-3 text-xs text-[#75665d]">
                {item.author && (
                  <span>
                    作者：{item.author.displayName}（{item.author.roleName}）
                  </span>
                )}
                {item.moderator && <span>管理员：{item.moderator.displayName}</span>}
                {item.courseName && <span>课程：{item.courseName}</span>}
                {item.sceneKey && <span>场景：{item.sceneKey}</span>}
                {item.actionId && <span>动作：{item.actionId}</span>}
                {item.action && <span>操作：{item.action}</span>}
                {item.targetId && <span>目标：{item.targetId}</span>}
                {item.moderationReason && <span>最近原因：{item.moderationReason}</span>}
              </div>

              {type !== 'audit' && (
                <div className="flex flex-wrap justify-end gap-2">
                  {item.status === 'visible' && (
                    <Button size="sm" variant="outline" onClick={() => void moderate(item, 'hide')}>
                      隐藏
                    </Button>
                  )}
                  {(item.status === 'hidden' || item.status === 'deleted_by_admin') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void moderate(item, 'restore')}
                    >
                      恢复
                    </Button>
                  )}
                  {type === 'danmaku' && ['visible', 'hidden'].includes(item.status ?? '') && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => void moderate(item, 'delete')}
                    >
                      删除
                    </Button>
                  )}
                  {(type === 'posts' || type === 'replies') &&
                    ['visible', 'hidden'].includes(item.status ?? '') && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => void moderate(item, 'delete')}
                      >
                        删除
                      </Button>
                    )}
                  {type === 'posts' && item.status === 'visible' && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void moderate(item, item.pinned ? 'unpin' : 'pin')}
                      >
                        {item.pinned ? '取消置顶' : '置顶'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void moderate(item, item.locked ? 'unlock' : 'lock')}
                      >
                        {item.locked ? '重新开放' : '关闭回复'}
                      </Button>
                    </>
                  )}
                  {pendingAction?.startsWith(`${item.id}:`) && (
                    <span className="inline-flex items-center text-xs text-[#75665d]">
                      <RefreshCw className="mr-1 size-3 animate-spin" />
                      处理中
                    </span>
                  )}
                </div>
              )}
            </AdminCard>
          ))
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-[#75665d]">
          第 {page} / {pageCount} 页
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
          >
            上一页
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pageCount || loading}
            onClick={() => setPage((value) => value + 1)}
          >
            下一页
          </Button>
        </div>
      </div>

      <AdminNotice>
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="size-4" /> 社区正文按纯文本安全输出；原始
          HTML、危险协议和控制字符会在服务端拒绝。
        </span>
      </AdminNotice>
    </div>
  );
}
