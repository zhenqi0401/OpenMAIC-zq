'use client';

import { Menu } from 'lucide-react';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { Button } from '@/components/ui/button';
import { AdminDrawer } from '@/components/admin/AdminOverlay';
import { AdminNavigation } from '@/components/admin/AdminSidebar';
import type { AdminModuleId } from '@/components/admin/admin-navigation';
import { adminIconButtonClassName } from '@/components/admin/AdminSurface';

export function AdminTopBar({ activeModuleId }: { activeModuleId: AdminModuleId }) {
  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--admin-border-subtle)] bg-[var(--admin-surface)] px-4 md:hidden"
      data-admin-top-bar
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
  );
}
