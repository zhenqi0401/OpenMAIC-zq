'use client';

import { useState, type ReactNode } from 'react';
import { ProLayout, PageContainer } from '@ant-design/pro-components';
import { Button } from 'antd';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { BrandLockup } from '@/components/brand/BrandLockup';
import { AdminBreadcrumbs } from '@/components/admin/AdminBreadcrumbs';
import { AdminCurrentIdentity } from '@/components/admin/AdminCurrentIdentity';
import { AdminAccountMenu } from '@/components/admin/AdminSessionActions';
import { visibleAdminModules } from '@/components/admin/AdminSidebar';
import { ADMIN_THEME_NAME, adminThemeStyle } from '@/components/admin/admin-theme';
import type { AdminModuleId } from '@/components/admin/admin-navigation';

export { adminModules } from '@/components/admin/admin-navigation';
export type { AdminModuleId } from '@/components/admin/admin-navigation';

interface AdminShellProps {
  activeModuleId?: AdminModuleId;
  children: ReactNode;
}

/**
 * Pro 工作台骨架。模块 query、权限门禁和业务面板仍由调用方负责，
 * ProLayout 只承载导航、响应式侧栏、折叠和页面容器。
 */
export function AdminShell({ activeModuleId = 'dashboard', children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const routes = visibleAdminModules().map((module) => ({
    key: module.id,
    path: module.href,
    name: module.label,
    icon: <module.icon aria-hidden="true" />,
  }));

  return (
    <div
      className="min-h-[100dvh] overflow-x-clip font-[family-name:var(--admin-font-sans)] text-[var(--admin-foreground)]"
      data-admin-layout="pro"
      data-admin-theme={ADMIN_THEME_NAME}
      style={adminThemeStyle}
    >
      <ProLayout
        contentStyle={{ background: 'var(--admin-page)', minHeight: '100dvh' }}
        fixSiderbar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        route={{ routes }}
        menu={{ selectedKeys: [activeModuleId], defaultOpenAll: true }}
        menuRender={(_, dom) => <nav aria-label="后台模块导航">{dom}</nav>}
        siderWidth={260}
        collapsedWidth={72}
        logo={false}
        title={false}
        menuHeaderRender={() => <BrandLockup priority variant={collapsed ? 'mark' : 'full'} />}
        menuItemRender={(item, dom) => <a href={item.path ?? '#'}>{dom}</a>}
        headerContentRender={() => (
          <div className="flex min-w-0 flex-1 items-center justify-between gap-4 px-2 sm:px-4">
            <AdminBreadcrumbs activeModuleId={activeModuleId} />
            <div className="flex shrink-0 items-center gap-2">
              <AdminCurrentIdentity variant="inline" />
              <AdminAccountMenu />
            </div>
          </div>
        )}
        collapsedButtonRender={(collapsedValue) => (
          <Button
            type="text"
            aria-label={collapsedValue ? '展开侧边导航' : '收起侧边导航'}
            icon={collapsedValue ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          />
        )}
      >
        <main
          className="mx-auto w-full max-w-[var(--admin-content-max-width)] px-4 py-5 sm:px-5 md:px-6 md:py-6"
          data-admin-shell="yuanwo-saas-admin"
        >
          <PageContainer ghost header={{ title: false, breadcrumb: undefined }}>
            {children}
          </PageContainer>
        </main>
      </ProLayout>
    </div>
  );
}
