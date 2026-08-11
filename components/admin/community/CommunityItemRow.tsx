'use client';

import { RefreshCw } from 'lucide-react';
import { AdminRowActions, type AdminRowAction } from '@/components/admin/AdminRowActions';
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
  contentTypeLabel,
} from '@/lib/admin/community-presentation';
import { formatAdminDateTime } from '@/lib/admin/date-time';

function statusTone(status: string | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'visible') return 'success';
  if (status === 'hidden') return 'warning';
  if (status?.startsWith('deleted')) return 'danger';
  return 'neutral';
}

function secondaryActions(
  type: Exclude<CommunityContentType, 'audit'>,
  item: AdminCommunityItem,
  disabled: boolean,
  onModerate: (action: CommunityModerationAction) => void,
) {
  const actions: AdminRowAction[] = [];
  if (type === 'posts' && item.status === 'visible') {
    const lockAction = item.locked ? 'unlock' : 'lock';
    actions.push({
      id: lockAction,
      label: communityActionLabel(lockAction),
      disabled,
      onSelect: () => onModerate(lockAction),
    });
  }
  if (item.status === 'visible' || item.status === 'hidden') {
    actions.push({
      id: 'delete',
      label: communityActionLabel('delete'),
      destructive: true,
      disabled,
      onSelect: () => onModerate('delete'),
    });
  }
  return actions;
}

export function CommunityItemRow({
  item,
  pending,
  type,
  onModerate,
}: {
  item: AdminCommunityItem;
  pending: boolean;
  type: CommunityContentType;
  onModerate: (action: CommunityModerationAction) => void;
}) {
  const isAudit = type === 'audit';
  const primaryAction = !isAudit
    ? item.status === 'visible'
      ? ('hide' as const)
      : item.status === 'hidden' || item.status === 'deleted_by_admin'
        ? ('restore' as const)
        : null
    : null;
  const actions = isAudit ? [] : secondaryActions(type, item, pending, onModerate);

  return (
    <AdminCard className="grid gap-3 p-4" data-community-item-row>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {item.status ? (
              <AdminStatusBadge tone={statusTone(item.status)}>
                {communityStatusLabel(item.status)}
              </AdminStatusBadge>
            ) : null}
            {item.targetType ? (
              <AdminStatusBadge>{communityTargetLabel(item.targetType)}</AdminStatusBadge>
            ) : null}
            {item.locked ? <AdminStatusBadge tone="warning">已关闭回复</AdminStatusBadge> : null}
          </div>
          {item.title ? <h3 className="mt-2 font-medium">{item.title}</h3> : null}
          {item.postTitle ? (
            <p className="mt-2 text-xs text-[var(--admin-muted-foreground)]">
              所属帖子：{item.postTitle}
            </p>
          ) : null}
          <p className="mt-2 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-6">
            {item.content ?? item.body ?? item.reason ?? '无文本内容'}
          </p>
        </div>
        <time className="shrink-0 text-xs text-[var(--admin-muted-foreground)]">
          {formatAdminDateTime(item.createdAt)}
        </time>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border-subtle)] pt-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--admin-muted-foreground)]">
          {item.author ? <span>作者：{item.author.displayName}</span> : null}
          {item.moderator ? <span>管理员：{item.moderator.displayName}</span> : null}
          {item.courseName ? <span>课程：{item.courseName}</span> : null}
          <span>
            类型：{item.targetType ? communityTargetLabel(item.targetType) : contentTypeLabel(type)}
          </span>
          {item.action ? <span>操作：{communityActionLabel(item.action)}</span> : null}
          {item.moderationReason ? <span>最近原因：{item.moderationReason}</span> : null}
        </div>

        {!isAudit ? (
          <AdminRowActions
            actions={actions}
            menuModal={false}
            primaryAction={
              primaryAction ? (
                <Button
                  className={adminLinkButtonClassName}
                  disabled={pending}
                  onClick={() => onModerate(primaryAction)}
                  size="sm"
                  type="button"
                  variant="link"
                >
                  {pending ? <RefreshCw aria-hidden="true" className="animate-spin" /> : null}
                  {pending ? '处理中…' : communityActionLabel(primaryAction)}
                </Button>
              ) : undefined
            }
            triggerAriaLabel={`${contentTypeLabel(type)}行操作`}
          />
        ) : null}
      </div>
    </AdminCard>
  );
}
