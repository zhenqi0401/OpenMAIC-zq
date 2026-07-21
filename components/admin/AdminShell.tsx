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
import { adminThemeStyle } from '@/components/admin/AdminSurface';
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
      className="min-h-[100dvh] bg-[radial-gradient(circle_at_18%_0%,rgba(233,216,198,0.58),transparent_34%),linear-gradient(180deg,#f6efe5,#f1e2d0)] text-[#2b211d]"
      data-admin-theme="warm-workbench"
      style={adminThemeStyle}
    >
      <div className="grid min-h-[100dvh] lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden border-r border-[#d8c8b9] bg-[linear-gradient(180deg,#fffaf2,#f1e2d0)] lg:sticky lg:top-0 lg:flex lg:h-[100dvh] lg:flex-col lg:gap-5 lg:p-6">
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
        compact && 'rounded-[6px] border border-[#d8c8b9] bg-[#fffaf2] p-4',
      )}
    >
      <BrandLockup variant={compact ? 'compact' : 'full'} priority />
      <div className="grid gap-1">
        <h1 className="text-[28px] font-normal leading-[1.08] tracking-[-0.016em] text-[#2b211d]">
          管理后台
        </h1>
        <p className="text-sm leading-5 text-[#75665d]">企业培训运营台</p>
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
                'grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-[6px] border px-3 py-2 text-left transition-colors',
                active
                  ? 'border-[#c96f54]/70 bg-[#fffaf2] text-[#2b211d]'
                  : 'border-[#eaded1] bg-[#fffaf2] text-[#2b211d] hover:border-[#c96f54]/70 hover:bg-[#f1e2d0]',
              )}
              href={module.href}
              key={module.id}
            >
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Icon className="size-4" />
                {module.label}
              </span>
              <span
                className={cn('col-start-1 text-xs', active ? 'text-[#75665d]' : 'text-[#75665d]')}
              >
                {module.description}
              </span>
              {active ? (
                <span
                  aria-hidden="true"
                  className="col-start-2 row-span-2 row-start-1 size-[7px] self-center rounded-full bg-[#c96f54]"
                />
              ) : null}
            </a>
          );
        })}
    </nav>
  );
}
