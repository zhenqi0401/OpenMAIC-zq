import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminShell, adminModules } from '@/components/admin/AdminShell';

describe('AdminShell', () => {
  it('renders the four admin modules as accessible navigation targets', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminShell,
        { activeModuleId: 'dashboard' },
        React.createElement('div', null, 'admin content'),
      ),
    );

    expect(adminModules.map((module) => module.id)).toEqual([
      'dashboard',
      'courses',
      'exams',
      'access',
    ]);
    expect(markup).toContain('aria-label="后台模块导航"');
    expect(markup).toContain('href="/admin?module=dashboard"');
    expect(markup).toContain('href="/admin?module=courses"');
    expect(markup).toContain('href="/admin?module=exams"');
    expect(markup).toContain('href="/admin?module=access"');
    expect(markup).toContain('aria-current="page"');
  });

  it('lets the right-side workbench fill the available screen width', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminShell,
        { activeModuleId: 'access' },
        React.createElement('section', { id: 'admin-access' }, 'access content'),
      ),
    );

    expect(markup).toContain('管理后台');
    expect(markup).toContain('企业培训运营台');
    expect(markup).toContain('access content');
    expect(markup).toContain('data-admin-shell="prototype-workbench"');
    expect(markup).not.toContain('max-w-[1280px]');
    expect(markup).not.toContain('运营状态一屏处理');
  });
});
