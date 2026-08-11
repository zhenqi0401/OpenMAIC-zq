'use client';

import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/antd/AntdButton';
import { AdminDrawer } from '@/components/admin/AdminOverlay';
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs';
import { AdminCurrentIdentity } from '@/components/admin/AdminCurrentIdentity';
import { AdminNavigation } from '@/components/admin/AdminSidebar';
import { adminModules, type AdminModuleId } from '@/components/admin/admin-navigation';
import { adminIconButtonClassName } from '@/components/admin/AdminSurface';
import { cn } from '@/lib/utils';

export function AdminTopBar({
  activeModuleId,
  collapsed = false,
  onToggleCollapsed,
}: {
  activeModuleId: AdminModuleId;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const adminModule = adminModules.find((item) => item.id === activeModuleId);

  return (
    <>
      {/* 桌面端顶栏（Ant Design Pro 风格：64px，含折叠按钮 + 面包屑 + 模块标题 + 用户区） */}
      <header
        className="sticky top-0 z-30 hidden h-[var(--admin-header-height)] items-center justify-between gap-4 border-b border-[var(--admin-border-subtle)] bg-[var(--admin-surface)] px-6 md:flex"
        data-admin-top-bar="desktop"
        data-admin-pro-header
      >
        <div className="flex min-w-0 items-center gap-3">
          <Button
            aria-label={collapsed ? '展开侧边导航' : '收起侧边导航'}
            className={cn(adminIconButtonClassName, 'size-9 hidden xl:inline-flex')}
            onClick={onToggleCollapsed}
            size="icon"
            type="button"
            variant="outline"
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </Button>
          <div className="flex min-w-0 flex-col">
            <AdminBreadcrumbs activeModuleId={activeModuleId} />
            <p className="truncate text-base font-semibold leading-6 text-[var(--admin-heading)]">
              {adminModule?.label ?? '管理后台'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3" data-admin-topbar-actions>
          <AdminCurrentIdentity variant="inline" />
        </div>
      </header>

      {/* 移动端顶栏（保留原抽屉导航） */}
      <header
        className="sticky top-0 z-30 flex h-[var(--admin-header-height)] items-center justify-between border-b border-[var(--admin-border-subtle)] bg-[var(--admin-surface)] px-4 md:hidden"
        data-admin-top-bar="mobile"
      >
        <div className="flex min-w-0 items-center gap-3" data-admin-brand="mobile">
          <BrandLockup priority variant="compact" />
          <span className="border-l border-[var(--admin-border)] pl-3 text-sm font-semibold">
            管理后台
          </span>
        </div>
        <AdminDrawer
          contentClassName="w-[min(88vw,320px)] p-5"
          title="管理后台导航"
          trigger={
            <Button
              aria-label="打开后台导航"
              className={adminIconButtonClassName}
              size="icon"
              type="button"
              variant="outline"
            >
              <Menu aria-hidden="true" />
            </Button>
          }
        >
          <AdminNavigation activeModuleId={activeModuleId} mobile />
        </AdminDrawer>
      </header>
    </>
  );
}
