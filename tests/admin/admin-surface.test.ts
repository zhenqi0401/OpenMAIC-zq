import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BarChart3 } from 'lucide-react';
import {
  AdminCard,
  AdminNotice,
  AdminSectionHeader,
  AdminStatusBadge,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';

describe('AdminSurface', () => {
  it('renders dense warm-workbench section headers and cards', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        'section',
        null,
        React.createElement(AdminSectionHeader, {
          icon: React.createElement(BarChart3),
          eyebrow: 'Dashboard',
          title: '运营状态一眼看清',
          description: '课程完成、测评通过和阶段考核概览',
          action: React.createElement('button', null, '刷新看板'),
        }),
        React.createElement(AdminCard, null, 'card content'),
      ),
    );

    expect(markup).toContain('Dashboard');
    expect(markup).toContain('运营状态一眼看清');
    expect(markup).toContain('刷新看板');
    expect(markup).toContain('grid-cols-[minmax(0,1fr)_auto]');
    expect(markup).toContain('bg-[#fffaf2]');
    expect(markup).toContain('border-[#d8c8b9]');
    expect(markup).not.toContain('size-9');
  });

  it('standardizes notices, status badges, and select controls', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        'div',
        null,
        React.createElement(AdminNotice, { tone: 'error' }, '加载失败'),
        React.createElement(AdminStatusBadge, { tone: 'success' }, '已发布'),
      ),
    );

    expect(markup).toContain('加载失败');
    expect(markup).toContain('已发布');
    expect(adminSelectClassName).toContain('rounded-[4px]');
    expect(adminSelectClassName).toContain('border-[#d8c8b9]');
  });
});
