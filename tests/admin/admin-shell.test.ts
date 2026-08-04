import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminShell, adminModules } from '@/components/admin/AdminShell';
import { formatAdminIdentity } from '@/components/admin/AdminCurrentIdentity';

describe('AdminShell', () => {
  it('renders the five admin modules as accessible navigation targets', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminShell,
        { activeModuleId: 'dashboard' } as React.ComponentProps<typeof AdminShell>,
        React.createElement('div', null, 'admin content'),
      ),
    );

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
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('data-admin-theme="yuanwo-saas-admin"');
    expect(markup).toContain('--primary:');
    expect(markup).toContain('--ring:');
    expect(markup).toContain('--admin-action-primary:');
    expect(markup).toContain('--admin-interactive-accent:');
    expect(markup).toContain('用户管理');
    expect(markup).not.toContain('访问与角色');
  });

  it('formats the current session user and role for the sidebar', () => {
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

  it('lets the right-side workbench fill the available screen width', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminShell,
        { activeModuleId: 'access' } as React.ComponentProps<typeof AdminShell>,
        React.createElement('section', { id: 'admin-access' }, 'access content'),
      ),
    );

    expect(markup).toContain('管理后台');
    expect(markup).toContain('元我智脑');
    expect(markup).toContain('data-admin-brand="desktop"');
    expect(markup).toContain('data-admin-brand="mobile"');
    expect(markup).toContain('access content');
    expect(markup).toContain('data-admin-shell="yuanwo-saas-admin"');
    expect(markup).toContain('data-admin-sidebar');
    expect(markup).toContain('data-admin-top-bar');
    expect(markup).toContain('打开后台导航');
    expect(markup).toContain('md:grid-cols-[var(--admin-sidebar-compact-width)_minmax(0,1fr)]');
    expect(markup).toContain('xl:grid-cols-[var(--admin-sidebar-width)_minmax(0,1fr)]');
    expect(markup).toContain('fixed inset-y-0 left-0');
    expect(markup).toContain('w-[var(--admin-sidebar-compact-width)]');
    expect(markup).toContain('xl:w-[var(--admin-sidebar-width)]');
    expect(markup.indexOf('公司：')).toBeLessThan(markup.indexOf('角色：'));
    expect(markup.indexOf('角色：')).toBeLessThan(markup.indexOf('用户：'));
    expect(markup).toContain('md:col-start-2');
    expect(markup).not.toContain('<aside class="sticky');
    expect(markup).not.toContain('max-w-[1280px]');
    expect(markup).not.toContain('运营状态一屏处理');
  });

  it('leaves module-level actions to each admin page header', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminShell,
        { activeModuleId: 'courses' } as React.ComponentProps<typeof AdminShell>,
        React.createElement('div', null, 'course content'),
      ),
    );

    expect(markup).toContain('course content');
    expect(markup).not.toContain('返回首页');
    expect(markup).not.toContain('退出登录');
  });
});
