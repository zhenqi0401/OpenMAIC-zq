import type { ReactNode } from 'react';
import { Empty } from 'antd';
import { CircleAlert, Inbox, SearchX, ShieldAlert } from 'lucide-react';
import { AdminCard, AdminNotice } from '@/components/admin/AdminSurface';
import { cn } from '@/lib/utils';

export type AdminEmptyStateKind = 'empty' | 'filtered' | 'error' | 'forbidden';

export interface AdminEmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  kind?: AdminEmptyStateKind;
  /**
   * 是否显示顶部图标。默认仅错误/无权限态显示图标；
   * 空数据/筛选无结果统一为纯文字居中，不传即可。
   */
  icon?: boolean;
}

const stateIcons = {
  empty: Inbox,
  filtered: SearchX,
  error: CircleAlert,
  forbidden: ShieldAlert,
} as const;

function StateContent({
  title,
  description,
  action,
  compact,
  kind,
  icon,
}: Required<Pick<AdminEmptyStateProps, 'title' | 'compact' | 'kind'>> &
  Pick<AdminEmptyStateProps, 'description' | 'action' | 'icon'>) {
  const Icon = stateIcons[kind];

  return (
    <Empty
      className={cn(compact ? 'p-4' : 'p-8')}
      image={
        icon ? (
          <span
            aria-hidden="true"
            className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-[var(--admin-selection-background)] text-[var(--admin-link)]"
          >
            <Icon className="size-5" />
          </span>
        ) : (
          // antd v6 用 ?? 合并 image，传 null 会回退到内置"暂无数据"占位图；
          // 空 span 让纯文字态不渲染任何图标。
          <span aria-hidden="true" />
        )
      }
      styles={{ image: { height: icon ? 40 : 0 } }}
      description={
        // span 用 grid 布局后为 block 级，不再受父级 text-align 影响：
        // mx-auto 使其水平居中，justify-items-center + text-center 保证内部文本居中
        <span className="mx-auto grid max-w-[52ch] justify-items-center gap-1 text-center">
          <strong className="text-sm font-semibold text-[var(--admin-foreground)]">{title}</strong>
          {description ? (
            <span className="text-sm leading-6 text-[var(--admin-muted-foreground)]">
              {description}
            </span>
          ) : null}
        </span>
      }
    >
      {action ? <div className="flex flex-wrap justify-center gap-2">{action}</div> : null}
    </Empty>
  );
}

export function AdminEmptyState({
  title,
  description,
  action,
  compact = false,
  kind = 'empty',
  icon,
}: AdminEmptyStateProps) {
  // 空数据 / 筛选无结果统一为纯文字居中（无图标）；错误与无权限态保留图标以示强调。
  const showIcon = icon ?? (kind === 'error' || kind === 'forbidden');
  const content = (
    <StateContent
      action={action}
      compact={compact}
      description={description}
      icon={showIcon}
      kind={kind}
      title={title}
    />
  );

  // A load failure is announced as an error notice, not mislabeled as an
  // empty result. The shared facade still lets list modules render it in the
  // same reserved state area and attach a retry action.
  if (kind === 'error') {
    return (
      <AdminNotice data-admin-state="error" role="alert" tone="error">
        {content}
      </AdminNotice>
    );
  }

  return (
    <AdminCard data-admin-state={kind} role="status">
      {content}
    </AdminCard>
  );
}
