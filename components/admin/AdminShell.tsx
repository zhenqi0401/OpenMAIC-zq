import type { ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  ClipboardList,
  KeyRound,
  MessageSquareText,
  type LucideIcon,
} from 'lucide-react';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { AdminCurrentIdentity } from '@/components/admin/AdminCurrentIdentity';
import { ADMIN_THEME_NAME, adminThemeStyle } from '@/components/admin/admin-theme';
import { cn } from '@/lib/utils';
import { isDanmakuEnabled, isForumEnabled } from '@/lib/config/feature-flags';

export type AdminModuleId = 'dashboard' | 'courses' | 'exams' | 'community' | 'access';

interface AdminModule {
  id: AdminModuleId;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

export const adminModules: AdminModule[] = [
  {
    id: 'dashboard',
    label: '看板',
    description: '学习与考核状态',
    href: '/admin?module=dashboard',
    icon: BarChart3,
  },
  {
    id: 'courses',
    label: '课程管理',
    description: '课程发布与可见范围',
    href: '/admin?module=courses',
    icon: BookOpen,
  },
  {
    id: 'exams',
    label: '阶段考核',
    description: '考核新建与发布',
    href: '/admin?module=exams',
    icon: ClipboardList,
  },
  {
    id: 'community',
    label: '社区内容',
    description: '弹幕、帖子与回复治理',
    href: '/admin?module=community',
    icon: MessageSquareText,
  },
  {
    id: 'access',
    label: '用户管理',
    description: '用户、角色与邀请码',
    href: '/admin?module=access',
    icon: KeyRound,
  },
];

interface AdminShellProps {
  activeModuleId?: AdminModuleId;
  children: ReactNode;
}

export function AdminShell({ activeModuleId = 'dashboard', children }: AdminShellProps) {
  return (
    <div
      className="min-h-[100dvh] bg-[radial-gradient(circle_at_18%_0%,var(--admin-page-glow),transparent_34%),linear-gradient(180deg,var(--admin-surface-subtle),var(--admin-page))] text-[var(--admin-foreground)]"
      data-admin-theme={ADMIN_THEME_NAME}
      style={adminThemeStyle}
    >
      <div className="grid min-h-[100dvh] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[var(--admin-border)] bg-[linear-gradient(180deg,var(--admin-surface),var(--admin-surface-subtle))] lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col lg:gap-5 lg:p-6">
          <AdminBrand />
          <AdminNavigation activeModuleId={activeModuleId} />
          <AdminCurrentIdentity />
        </aside>

        <main data-admin-shell="prototype-workbench" className="min-w-0">
          <div className="grid w-full gap-5 px-3 py-3 sm:px-4 lg:px-6 lg:py-4">
            <div className="lg:hidden">
              <AdminBrand compact />
              <div className="mt-4 overflow-x-auto pb-1">
                <AdminNavigation activeModuleId={activeModuleId} compact />
              </div>
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function AdminBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      data-admin-brand={compact ? 'mobile' : 'desktop'}
      className={cn(
        'grid gap-3',
        compact &&
          'rounded-[var(--admin-radius-card)] border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4',
      )}
    >
      <BrandLockup variant={compact ? 'compact' : 'full'} priority />
      <div className="grid gap-1">
        <h1 className="text-[28px] font-normal leading-[1.08] tracking-[-0.016em] text-[var(--admin-heading)]">
          管理后台
        </h1>
        <p className="text-sm leading-5 text-[var(--admin-muted-foreground)]">企业培训运营台</p>
      </div>
    </div>
  );
}

function AdminNavigation({
  activeModuleId,
  compact = false,
}: {
  activeModuleId: AdminModuleId;
  compact?: boolean;
}) {
  return (
    <nav
      aria-label="后台模块导航"
      className={cn('grid gap-2', compact && 'grid-flow-col auto-cols-[minmax(150px,1fr)]')}
    >
      {adminModules
        .filter((module) => module.id !== 'community' || isDanmakuEnabled() || isForumEnabled())
        .map((module) => {
          const Icon = module.icon;
          const active = module.id === activeModuleId;
          return (
            <a
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 overflow-hidden rounded-[var(--admin-radius-card)] border px-3 py-2 text-left transition-colors',
                active
                  ? 'border-[var(--admin-selection-border)] bg-[var(--admin-selection-background)] text-[var(--admin-selection-foreground)] shadow-[inset_3px_0_0_var(--admin-selection-indicator)]'
                  : 'border-transparent bg-transparent text-[var(--admin-foreground)] hover:border-[var(--admin-border-interactive)] hover:bg-[var(--admin-surface-selected)]',
              )}
              href={module.href}
              key={module.id}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Icon className="size-4" />
                {module.label}
              </span>
              <span
                className={cn(
                  'col-start-1 text-xs',
                  active
                    ? 'text-[var(--admin-muted-foreground)]'
                    : 'text-[var(--admin-muted-foreground)]',
                )}
              >
                {module.description}
              </span>
              {active ? (
                <span
                  aria-hidden="true"
                  className="col-start-2 row-span-2 row-start-1 size-[7px] self-center rounded-full bg-[var(--admin-selection-indicator)]"
                />
              ) : null}
            </a>
          );
        })}
    </nav>
  );
}
