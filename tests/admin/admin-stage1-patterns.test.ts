import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminDesignPreview } from '@/components/admin/examples/AdminDesignPreview';
import {
  AdminFilteredEmptyState,
  AdminLoadingState,
  AdminMetricCard,
  AdminNoPermissionState,
  AdminSkeleton,
} from '@/components/admin/AdminPatterns';

describe('admin stage 1 patterns', () => {
  it('renders all five API-independent visual samples', () => {
    const cases = [
      ['dashboard', '数据看板'],
      ['courses', '课程管理'],
      ['exams', '考核管理'],
      ['community', '社区管理'],
      ['access', '用户管理'],
    ] as const;

    for (const [module, title] of cases) {
      const markup = renderToStaticMarkup(React.createElement(AdminDesignPreview, { module }));
      expect(markup).toContain(`data-admin-design-preview="${module}"`);
      expect(markup).toContain(title);
      expect(markup).toContain('阶段 1 静态布局样例');
      expect(markup).not.toMatch(/SaaS Admin|Management Portal|hbc/);
      expect(markup).not.toMatch(/新建课程|添加用户/);
    }
  });

  it('provides metric, loading, skeleton, filtered, and forbidden states', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        'div',
        null,
        React.createElement(AdminMetricCard, { label: '学员数', value: '12' }),
        React.createElement(AdminLoadingState),
        React.createElement(AdminSkeleton),
        React.createElement(AdminFilteredEmptyState),
        React.createElement(AdminNoPermissionState),
      ),
    );

    expect(markup).toContain('data-admin-metric-card');
    expect(markup).toContain('data-admin-state="loading"');
    expect(markup).toContain('data-admin-state="skeleton"');
    expect(markup).toContain('data-admin-state="filtered"');
    expect(markup).toContain('data-admin-state="forbidden"');
    expect(markup).toContain('motion-reduce:animate-none');
  });
});
