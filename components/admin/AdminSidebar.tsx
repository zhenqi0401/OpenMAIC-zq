import { BrandLockup } from '@/components/brand/BrandLockup';
import { AdminCurrentIdentity } from '@/components/admin/AdminCurrentIdentity';
import { adminModules, type AdminModuleId } from '@/components/admin/admin-navigation';
import { cn } from '@/lib/utils';
import { isDanmakuEnabled, isForumEnabled } from '@/lib/config/feature-flags';

export function visibleAdminModules() {
  return adminModules.filter(
    (module) => module.id !== 'community' || isDanmakuEnabled() || isForumEnabled(),
  );
}

export function AdminNavigation({
  activeModuleId,
  mobile = false,
  collapsed = false,
}: {
  activeModuleId: AdminModuleId;
  mobile?: boolean;
  collapsed?: boolean;
}) {
  return (
    <nav aria-label="后台模块导航" className="grid gap-2">
      {visibleAdminModules().map((module) => {
        const Icon = module.icon;
        const active = module.id === activeModuleId;
        const labelClassName = cn(
          'min-w-0',
          !mobile &&
            'md:absolute md:left-[60px] md:z-20 md:hidden md:w-44 md:rounded-[var(--admin-radius-control)] md:border md:border-[var(--admin-border)] md:bg-[var(--admin-surface)] md:px-3 md:py-2 md:shadow-[var(--admin-shadow-popover)] md:group-hover/nav-item:block md:group-focus-visible/nav-item:block',
          !mobile && !collapsed &&
            'xl:static xl:block xl:w-auto xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none',
        );
        return (
          <a
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group/nav-item relative flex min-h-12 items-center gap-3 rounded-[var(--admin-radius-control)] px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--admin-focus-ring)]/30',
              active
                ? 'bg-[var(--admin-selection-background)] text-[var(--admin-selection-foreground)]'
                : 'text-[var(--admin-muted-foreground)] hover:bg-[var(--admin-surface-selected)] hover:text-[var(--admin-foreground)]',
            )}
            href={module.href}
            key={module.id}
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            <span className={labelClassName}>
              <span className="block truncate">{module.label}</span>
              <span className={cn('mt-0.5 block text-xs font-normal', !mobile && !collapsed && 'xl:block')}>
                {module.description}
              </span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}

export function AdminSidebar({
  activeModuleId,
  collapsed = false,
}: {
  activeModuleId: AdminModuleId;
  collapsed?: boolean;
}) {
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-20 hidden h-[100dvh] w-[var(--admin-sidebar-compact-width)] min-w-0 flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-6 md:flex',
        !collapsed && 'xl:w-[var(--admin-sidebar-width)] xl:px-6',
      )}
      data-admin-sidebar
    >
      <div className="mb-8 min-h-14" data-admin-brand="desktop">
        <div className={cn(collapsed && 'hidden', !collapsed && 'hidden xl:block')}>
          <BrandLockup priority variant="full" />
        </div>
        <div className="grid min-h-14 place-items-center xl:hidden">
          <BrandLockup priority variant="mark" />
        </div>
        <div className={cn('hidden place-items-center', collapsed && 'xl:grid')}>
          <BrandLockup priority variant="mark" />
        </div>
      </div>
      <p
        className={cn(
          'mb-3 hidden text-xs font-semibold tracking-[0.08em] text-[var(--admin-muted-foreground)]',
          !collapsed && 'xl:block',
        )}
      >
        管理后台
      </p>
      <AdminNavigation activeModuleId={activeModuleId} collapsed={collapsed} />
      <div className={cn('mt-auto hidden', !collapsed && 'xl:block')}>
        <AdminCurrentIdentity />
      </div>
    </aside>
  );
}
