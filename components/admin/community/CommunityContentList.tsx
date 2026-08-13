'use client';

import { RefreshCw } from 'lucide-react';
import {
  AdminCard,
  AdminStatusBadge,
  adminLinkButtonClassName,
} from '@/components/admin/AdminSurface';
import { Button } from '@/components/antd/AntdButton';
import {
  type AdminCommunityItem,
  type CommunityContentType,
  type CommunityModerationAction,
  communityActionLabel,
  communityStatusLabel,
  communityTargetLabel,
} from '@/lib/admin/community-presentation';
import { formatAdminDateTime } from '@/lib/admin/date-time';

function statusTone(status: string | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'visible') return 'success';
  if (status === 'hidden') return 'warning';
  if (status?.startsWith('deleted')) return 'danger';
  return 'neutral';
}

export function formatDanmakuOffset(actionOffsetMs: number | undefined): string {
  if (actionOffsetMs === undefined || !Number.isFinite(actionOffsetMs) || actionOffsetMs < 0) {
    return '—';
  }
  const seconds = Math.floor(actionOffsetMs / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function ContentStatus({
  status,
  normalLabel,
}: {
  status: string | undefined;
  normalLabel?: string;
}) {
  return (
    <AdminStatusBadge tone={statusTone(status)}>
      {status === 'visible' && normalLabel ? normalLabel : communityStatusLabel(status)}
    </AdminStatusBadge>
  );
}

function ModerationButtons({
  item,
  pending,
  type,
  onModerate,
}: {
  item: AdminCommunityItem;
  pending: boolean;
  type: 'danmaku' | 'posts' | 'replies';
  onModerate: (action: CommunityModerationAction) => void;
}) {
  const visibilityAction =
    item.status === 'visible'
      ? ('hide' as const)
      : item.status === 'hidden' || item.status === 'deleted_by_admin'
        ? ('restore' as const)
        : null;
  return (
    <div className="flex flex-wrap items-center gap-2" data-community-moderation-buttons>
      {visibilityAction ? (
        <Button
          className={adminLinkButtonClassName}
          disabled={pending}
          onClick={() => onModerate(visibilityAction)}
          size="sm"
          type="button"
          variant="link"
        >
          {pending ? <RefreshCw aria-hidden="true" className="animate-spin" /> : null}
          {visibilityAction === 'restore' ? '恢复' : type === 'danmaku' ? '下架' : '隐藏'}
        </Button>
      ) : null}
      {(item.status === 'visible' || item.status === 'hidden') && type === 'posts' ? (
        <Button
          className={adminLinkButtonClassName}
          disabled={pending}
          onClick={() => onModerate(item.locked ? 'unlock' : 'lock')}
          size="sm"
          type="button"
          variant="link"
        >
          {item.locked ? '开放回复' : '关闭回复'}
        </Button>
      ) : null}
      {item.status === 'visible' || item.status === 'hidden' ? (
        <Button
          danger
          disabled={pending}
          onClick={() => onModerate('delete')}
          size="sm"
          type="button"
          variant="link"
        >
          删除
        </Button>
      ) : null}
    </div>
  );
}

function PostCard({
  item,
  pending,
  onModerate,
}: {
  item: AdminCommunityItem;
  pending: boolean;
  onModerate: (action: CommunityModerationAction) => void;
}) {
  const authorName = item.author?.displayName ?? '未知作者';
  const initial = authorName.trim().slice(0, 1).toUpperCase() || '用';
  const hasModeration = Boolean(item.action && item.moderator);
  return (
    <AdminCard className="p-4 sm:p-5" data-community-post-card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--admin-selection-background)] font-semibold text-[var(--admin-selection-foreground)]"
          >
            {initial}
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium text-[var(--admin-foreground)]">{authorName}</div>
            <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-[var(--admin-muted-foreground)]">
              <span>{item.author?.roleName ?? '未知角色'}</span>
              <time dateTime={item.createdAt}>{formatAdminDateTime(item.createdAt)}</time>
            </div>
          </div>
        </div>
        <ContentStatus status={item.status} />
      </div>

      <div className="mt-4">
        <h3 className="break-words text-lg font-semibold text-[var(--admin-foreground)]">
          {item.title ?? '无标题帖子'}
        </h3>
        <p className="mt-2 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--admin-muted-foreground)]">
          {item.body ?? '无正文内容'}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--admin-muted-foreground)]">
        <span>所属课程：{item.courseName ?? '全局社区'}</span>
        <span>回复数：{item.replyCount ?? 0}</span>
        {item.locked ? <span>回复状态：已关闭</span> : <span>回复状态：开放</span>}
      </div>

      {hasModeration ? (
        <div
          className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-l-2 border-[var(--admin-danger)] bg-[var(--admin-danger-background)] px-3 py-2 text-xs text-[var(--admin-danger-strong)]"
          data-community-post-moderation
        >
          <span>操作类型：{communityActionLabel(item.action)}</span>
          <span>操作原因：{item.reason?.trim() || '未填写'}</span>
          <span>操作人：{item.moderator?.displayName}</span>
        </div>
      ) : null}

      <div className="mt-4 border-t border-[var(--admin-border-subtle)] pt-3">
        <ModerationButtons item={item} onModerate={onModerate} pending={pending} type="posts" />
      </div>
    </AdminCard>
  );
}

function DanmakuList({
  items,
  pendingItemId,
  onModerate,
}: {
  items: readonly AdminCommunityItem[];
  pendingItemId: string | null;
  onModerate: (item: AdminCommunityItem, action: CommunityModerationAction) => void;
}) {
  return (
    <div className="overflow-hidden" data-community-danmaku-list>
      <div className="hidden lg:block" data-community-danmaku-table>
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">
            弹幕发送者、文本、播放时间点、所属课程、状态和管理操作
          </caption>
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[27%]" />
            <col className="w-[12%]" />
            <col className="w-[18%]" />
            <col className="w-[11%]" />
            <col className="w-[17%]" />
          </colgroup>
          <thead className="bg-[var(--admin-surface-subtle)]">
            <tr className="border-b border-[var(--admin-border)] text-xs font-semibold text-[var(--admin-muted-foreground)]">
              <th className="px-4 py-3">发送者</th>
              <th className="px-3 py-3">弹幕文本</th>
              <th className="px-3 py-3">播放时间点</th>
              <th className="px-3 py-3">所属课程</th>
              <th className="px-3 py-3">状态</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                className="border-b border-[var(--admin-border-subtle)] align-top last:border-b-0"
                key={item.id}
              >
                <td className="break-words px-4 py-4">
                  <div className="font-medium">{item.author?.displayName ?? '未知作者'}</div>
                  <div className="mt-1 text-xs text-[var(--admin-muted-foreground)]">
                    {item.author?.roleName ?? '未知角色'}
                  </div>
                </td>
                <td className="break-words px-3 py-4 leading-6">{item.content ?? '无文本内容'}</td>
                <td className="px-3 py-4 font-mono tabular-nums">
                  {formatDanmakuOffset(item.actionOffsetMs)}
                </td>
                <td className="break-words px-3 py-4 text-[var(--admin-muted-foreground)]">
                  {item.courseName ?? '—'}
                </td>
                <td className="px-3 py-4">
                  <ContentStatus normalLabel="正常" status={item.status} />
                </td>
                <td className="px-4 py-4">
                  <ModerationButtons
                    item={item}
                    onModerate={(action) => onModerate(item, action)}
                    pending={pendingItemId === item.id}
                    type="danmaku"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 lg:hidden" data-community-danmaku-cards>
        {items.map((item) => (
          <article
            className="grid gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-subtle)] p-3"
            key={item.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{item.author?.displayName ?? '未知作者'}</div>
                <div className="text-xs text-[var(--admin-muted-foreground)]">
                  {item.author?.roleName ?? '未知角色'}
                </div>
              </div>
              <ContentStatus normalLabel="正常" status={item.status} />
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--admin-muted-foreground)]">弹幕文本</dt>
                <dd className="mt-1 break-words leading-6">{item.content ?? '无文本内容'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-muted-foreground)]">播放时间点</dt>
                <dd className="mt-1 font-mono tabular-nums">
                  {formatDanmakuOffset(item.actionOffsetMs)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-muted-foreground)]">所属课程</dt>
                <dd className="mt-1 break-words">{item.courseName ?? '—'}</dd>
              </div>
            </dl>
            <ModerationButtons
              item={item}
              onModerate={(action) => onModerate(item, action)}
              pending={pendingItemId === item.id}
              type="danmaku"
            />
          </article>
        ))}
      </div>
    </div>
  );
}

function ReplyList({
  items,
  pendingItemId,
  onModerate,
}: {
  items: readonly AdminCommunityItem[];
  pendingItemId: string | null;
  onModerate: (item: AdminCommunityItem, action: CommunityModerationAction) => void;
}) {
  return (
    <div className="overflow-hidden" data-community-reply-list>
      <div className="hidden lg:block" data-community-reply-table>
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">
            回复者、回复内容、所属帖子、所属课程、回复时间、状态和操作
          </caption>
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[22%]" />
            <col className="w-[15%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[9%]" />
            <col className="w-[13%]" />
          </colgroup>
          <thead className="bg-[var(--admin-surface-subtle)]">
            <tr className="border-b border-[var(--admin-border)] text-xs font-semibold text-[var(--admin-muted-foreground)]">
              <th className="px-4 py-3">回复者</th>
              <th className="px-3 py-3">回复内容</th>
              <th className="px-3 py-3">所属帖子</th>
              <th className="px-3 py-3">所属课程</th>
              <th className="px-3 py-3">回复时间</th>
              <th className="px-3 py-3">状态</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                className="border-b border-[var(--admin-border-subtle)] align-top last:border-b-0"
                key={item.id}
              >
                <td className="break-words px-4 py-4">
                  <div className="font-medium">{item.author?.displayName ?? '未知作者'}</div>
                  <div className="mt-1 text-xs text-[var(--admin-muted-foreground)]">
                    {item.author?.roleName ?? '未知角色'}
                  </div>
                </td>
                <td className="break-words px-3 py-4 leading-6">{item.body ?? '无回复内容'}</td>
                <td className="break-words px-3 py-4 text-[var(--admin-muted-foreground)]">
                  {item.postTitle ?? '—'}
                </td>
                <td className="break-words px-3 py-4 text-[var(--admin-muted-foreground)]">
                  {item.courseName ?? '全局社区'}
                </td>
                <td className="px-3 py-4 text-xs text-[var(--admin-muted-foreground)]">
                  <time dateTime={item.createdAt}>{formatAdminDateTime(item.createdAt)}</time>
                </td>
                <td className="px-3 py-4">
                  <ContentStatus status={item.status} />
                </td>
                <td className="px-4 py-4">
                  <ModerationButtons
                    item={item}
                    onModerate={(action) => onModerate(item, action)}
                    pending={pendingItemId === item.id}
                    type="replies"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 lg:hidden" data-community-reply-cards>
        {items.map((item) => (
          <article
            className="grid gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-subtle)] p-3"
            key={item.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{item.author?.displayName ?? '未知作者'}</div>
                <div className="text-xs text-[var(--admin-muted-foreground)]">
                  {item.author?.roleName ?? '未知角色'}
                </div>
              </div>
              <ContentStatus status={item.status} />
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--admin-muted-foreground)]">回复内容</dt>
                <dd className="mt-1 break-words leading-6">{item.body ?? '无回复内容'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-muted-foreground)]">所属帖子</dt>
                <dd className="mt-1 break-words">{item.postTitle ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-muted-foreground)]">所属课程</dt>
                <dd className="mt-1 break-words">{item.courseName ?? '全局社区'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--admin-muted-foreground)]">回复时间</dt>
                <dd className="mt-1">
                  <time dateTime={item.createdAt}>{formatAdminDateTime(item.createdAt)}</time>
                </dd>
              </div>
            </dl>
            <ModerationButtons
              item={item}
              onModerate={(action) => onModerate(item, action)}
              pending={pendingItemId === item.id}
              type="replies"
            />
          </article>
        ))}
      </div>
    </div>
  );
}

function AuditList({ items }: { items: readonly AdminCommunityItem[] }) {
  return (
    <div className="overflow-hidden" data-community-audit-list>
      <div className="hidden lg:block" data-community-audit-table>
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">操作人、操作对象、操作类型、操作原因和操作时间</caption>
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[16%]" />
            <col className="w-[18%]" />
            <col className="w-[28%]" />
            <col className="w-[20%]" />
          </colgroup>
          <thead className="bg-[var(--admin-surface-subtle)]">
            <tr className="border-b border-[var(--admin-border)] text-xs font-semibold text-[var(--admin-muted-foreground)]">
              <th className="px-4 py-3">操作人</th>
              <th className="px-3 py-3">操作对象</th>
              <th className="px-3 py-3">操作类型</th>
              <th className="px-3 py-3">操作原因</th>
              <th className="px-4 py-3">操作时间</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                className="border-b border-[var(--admin-border-subtle)] align-top last:border-b-0"
                key={item.id}
              >
                <td className="break-words px-4 py-4 font-medium">
                  {item.moderator?.displayName ?? '未知管理员'}
                </td>
                <td className="px-3 py-4">
                  <AdminStatusBadge>{communityTargetLabel(item.targetType)}</AdminStatusBadge>
                </td>
                <td className="break-words px-3 py-4">{communityActionLabel(item.action)}</td>
                <td className="break-words px-3 py-4 leading-6">
                  {item.reason?.trim() || '未填写'}
                </td>
                <td className="px-4 py-4 text-xs text-[var(--admin-muted-foreground)]">
                  <time dateTime={item.createdAt}>{formatAdminDateTime(item.createdAt)}</time>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 p-3 lg:hidden" data-community-audit-cards>
        {items.map((item) => (
          <article
            className="grid gap-3 rounded-[var(--admin-radius-control)] border border-[var(--admin-border-subtle)] p-3"
            key={item.id}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium">{item.moderator?.displayName ?? '未知管理员'}</div>
              <AdminStatusBadge>{communityTargetLabel(item.targetType)}</AdminStatusBadge>
            </div>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-[var(--admin-muted-foreground)]">操作类型</dt>
                <dd className="mt-1">{communityActionLabel(item.action)}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--admin-muted-foreground)]">操作时间</dt>
                <dd className="mt-1">
                  <time dateTime={item.createdAt}>{formatAdminDateTime(item.createdAt)}</time>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-[var(--admin-muted-foreground)]">操作原因</dt>
                <dd className="mt-1 break-words leading-6">{item.reason?.trim() || '未填写'}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  );
}

export function CommunityContentList({
  items,
  onModerate,
  pendingItemId,
  type,
}: {
  items: readonly AdminCommunityItem[];
  onModerate: (item: AdminCommunityItem, action: CommunityModerationAction) => void;
  pendingItemId: string | null;
  type: CommunityContentType;
}) {
  if (type === 'danmaku') {
    return <DanmakuList items={items} onModerate={onModerate} pendingItemId={pendingItemId} />;
  }
  if (type === 'posts') {
    return (
      <div className="grid gap-3 p-4" data-community-post-flow>
        {items.map((item) => (
          <PostCard
            item={item}
            key={item.id}
            onModerate={(action) => onModerate(item, action)}
            pending={pendingItemId === item.id}
          />
        ))}
      </div>
    );
  }
  if (type === 'replies') {
    return <ReplyList items={items} onModerate={onModerate} pendingItemId={pendingItemId} />;
  }
  return <AuditList items={items} />;
}
