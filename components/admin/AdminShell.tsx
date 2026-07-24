import type { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { ADMIN_THEME_NAME, adminThemeStyle } from '@/components/admin/admin-theme';
import type { AdminModuleId } from '@/components/admin/admin-navigation';

export { adminModules } from '@/components/admin/admin-navigation';
export type { AdminModuleId } from '@/components/admin/admin-navigation';

interface AdminShellProps {
  activeModuleId?: AdminModuleId;
  children: ReactNode;
}

export function AdminShell({ activeModuleId = 'dashboard', children }: AdminShellProps) {
  return (
    <div
      className="min-h-[100dvh] overflow-x-clip bg-[var(--admin-page)] font-[family-name:var(--admin-font-sans)] text-[var(--admin-foreground)]"
      data-admin-theme={ADMIN_THEME_NAME}
      style={adminThemeStyle}
    >
      <div className="min-h-[100dvh] md:grid md:grid-cols-[var(--admin-sidebar-compact-width)_minmax(0,1fr)] xl:grid-cols-[var(--admin-sidebar-width)_minmax(0,1fr)]">
        <AdminSidebar activeModuleId={activeModuleId} />
        <div className="min-w-0 md:col-start-2">
          <AdminTopBar activeModuleId={activeModuleId} />
          <main className="min-w-0" data-admin-shell="yuanwo-saas-admin">
            <div className="mx-auto grid w-full max-w-[1680px] gap-6 px-4 py-5 sm:px-5 md:px-6 md:py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
