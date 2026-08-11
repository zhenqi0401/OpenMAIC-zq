import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminShell, adminModules, formatAdminIdentity } from '@/components/admin/AdminShell';
import { ThemeProvider } from '@/lib/hooks/use-theme';

function renderShell(activeModuleId: React.ComponentProps<typeof AdminShell>['activeModuleId']) {
  return renderToStaticMarkup(
    React.createElement(
      ThemeProvider,
      null,
      React.createElement(
        AdminShell,
        { activeModuleId } as React.ComponentProps<typeof AdminShell>,
        React.createElement('div', null, 'admin content'),
      ),
    ),
  );
}

describe('AdminShell', () => {
  it('renders the five admin modules as accessible navigation targets', () => {
    const markup = renderShell('dashboard');

    expect(adminModules.map((module) => module.id)).toEqual([
      'dashboard',
      'courses',
      'exams',
      'community',
      'access',
    ]);
    expect(markup).toContain('aria-label="后台模块导航"');
    expect(markup).toContain('href="/admin?module=dashboard"');
    expect(markup).toContain('href="/admin?module=courses"');
    expect(markup).toContain('href="/admin?module=exams"');
    expect(markup).toContain('href="/admin?module=community"');
    expect(markup).toContain('href="/admin?module=access"');
    expect(markup).toContain('data-admin-theme="yuanwo-saas-admin"');
    expect(markup).toContain('--primary:');
    expect(markup).toContain('--ring:');
    expect(markup).toContain('--admin-action-primary:');
    expect(markup).toContain('--admin-interactive-accent:');
    expect(markup).toContain('用户管理');
    expect(markup).not.toContain('访问与角色');
  });

  it('formats the current session user and role for the account trigger', () => {
    expect(
      formatAdminIdentity(
        {
          id: 'user-1',
          displayName: '张三',
          phone: '13800138000',
          role: { name: '管理员', code: 'admin' },
        },
        { name: '美视智能' },
      ),
    ).toEqual({ company: '美视智能', user: '张三', role: '管理员（admin）' });
    expect(formatAdminIdentity({ id: 'user-2', phone: '13900139000' }, null)).toEqual({
      company: '未知公司',
      user: '13900139000',
      role: '未知角色',
    });
  });

  it('keeps the side-bar workbench responsive and the unified account trigger in the header', () => {
    const markup = renderShell('access');

    expect(markup).toContain('元我智脑');
    expect(markup).toContain('admin content');
    expect(markup).toContain('data-admin-shell="yuanwo-saas-admin"');
    expect(markup).toContain('data-admin-layout="side"');
    expect(markup).toContain('data-admin-theme="yuanwo-saas-admin"');
    expect(markup).toContain('aria-label="后台模块导航"');
    expect(markup).toContain('data-admin-current-identity="trigger"');
    // 右上角不再有重复的导航入口按钮，折叠/展开交给 Sider 自带 trigger
    expect(markup).not.toContain('打开后台导航');
    expect(markup).toContain('ant-layout-sider-trigger');
    expect(markup).not.toContain('max-w-[1280px]');
    expect(markup).not.toContain('运营状态一屏处理');
    // 面包屑已从后台全局 Header 中移除
    expect(markup).not.toContain('aria-label="面包屑"');
  });

  it('leaves module-level actions to each admin page header', () => {
    const markup = renderShell('courses');

    expect(markup).toContain('admin content');
    expect(markup).not.toContain('返回首页');
    expect(markup).not.toContain('>退出登录<');
  });
});
