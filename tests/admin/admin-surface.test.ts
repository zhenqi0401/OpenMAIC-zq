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
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import { AdminPagination } from '@/components/admin/AdminPagination';
import { AdminRowActions, partitionAdminRowActions } from '@/components/admin/AdminRowActions';
import { AdminTabs } from '@/components/admin/AdminTabs';

describe('AdminSurface', () => {
  it('renders a responsive section header with optional breadcrumb and actions', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        'section',
        null,
        React.createElement(AdminSectionHeader, {
          icon: React.createElement(BarChart3),
          breadcrumb: [
            { label: '管理后台', href: '/admin?module=dashboard' },
            { label: '运营看板' },
          ],
          title: '运营状态一眼看清',
          description: '课程完成、测评通过和阶段考核概览',
          action: React.createElement('button', null, '刷新看板'),
        }),
        React.createElement(AdminCard, null, 'card content'),
      ),
    );

    expect(markup).toContain('aria-label="面包屑"');
    expect(markup).toContain('href="/admin?module=dashboard"');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('运营状态一眼看清');
    expect(markup).toContain('刷新看板');
    expect(markup).toContain('data-admin-header-actions');
    expect(markup).toContain('role="group"');
    expect(markup).toContain('lg:text-[36px]');
    expect(markup).not.toContain('46px');
  });

  it('standardizes notices, status badges, and select controls', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        'div',
        null,
        React.createElement(AdminNotice, { tone: 'error' }, '加载失败'),
        React.createElement(
          AdminStatusBadge,
          { tone: 'success' } as React.ComponentProps<typeof AdminStatusBadge>,
          '已发布',
        ),
      ),
    );

    expect(markup).toContain('加载失败');
    expect(markup).toContain('已发布');
    expect(markup).toContain('role="alert"');
    expect(adminSelectClassName).toContain('focus-visible:ring');
    expect(adminSelectClassName).toContain('rounded-[var(--admin-radius-control)]');
  });

  it('renders accessible keyboard-managed tabs with counts and disabled states', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminTabs, {
        ariaLabel: '社区内容类型',
        value: 'danmaku',
        onValueChange: () => undefined,
        items: [
          { value: 'danmaku', label: '弹幕', count: 12 },
          { value: 'posts', label: '帖子', count: 3 },
          { value: 'audit', label: '操作审计', disabled: true },
        ],
      }),
    );

    expect(markup).toContain('data-admin-tabs');
    expect(markup).toContain('role="tablist"');
    expect(markup).toContain('role="tab"');
    expect(markup).toContain('aria-selected="true"');
    expect(markup).toContain('aria-label="弹幕，12 条"');
    expect(markup).toContain('disabled=""');
    expect(markup).not.toMatch(/purple|violet/i);
  });

  it('formats empty and populated pagination ranges and disables unavailable moves', () => {
    const emptyMarkup = renderToStaticMarkup(
      React.createElement(AdminPagination, {
        page: 1,
        totalPages: 1,
        total: 0,
        start: 0,
        end: 0,
        onPageChange: () => undefined,
      }),
    );
    const populatedMarkup = renderToStaticMarkup(
      React.createElement(AdminPagination, {
        page: 3,
        totalPages: 3,
        total: 26,
        start: 21,
        end: 26,
        loading: true,
        onPageChange: () => undefined,
      }),
    );

    expect(emptyMarkup).toContain('共 0 条');
    expect(emptyMarkup).not.toContain('显示 0–0 条');
    expect(emptyMarkup.match(/disabled=""/g)).toHaveLength(2);
    expect(populatedMarkup).toContain('显示 21–26 条，共 26 条');
    expect(populatedMarkup).toContain('第 3 / 3 页');
    expect(populatedMarkup.match(/disabled=""/g)).toHaveLength(2);
  });

  it('distinguishes first-empty, filtered-empty, and load-failure states', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        'div',
        null,
        React.createElement(AdminEmptyState, { title: '还没有课程' }),
        React.createElement(AdminEmptyState, {
          kind: 'filtered',
          title: '当前筛选没有结果',
          compact: true,
        }),
        React.createElement(AdminEmptyState, {
          kind: 'error',
          title: '课程加载失败',
          action: React.createElement('button', null, '重试'),
        }),
      ),
    );

    expect(markup).toContain('data-admin-state="empty"');
    expect(markup).toContain('data-admin-state="filtered"');
    expect(markup).toContain('data-admin-state="error"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('重试');
  });

  it('keeps destructive row actions after ordinary actions', () => {
    const actions = [
      { id: 'delete', label: '删除', destructive: true },
      { id: 'edit', label: '编辑' },
      { id: 'archive', label: '归档', disabled: true, disabledReason: '课程正在发布' },
    ];
    const partitioned = partitionAdminRowActions(actions);
    const markup = renderToStaticMarkup(
      React.createElement(AdminRowActions, {
        actions,
        primaryAction: React.createElement('button', null, '查看'),
        triggerAriaLabel: '课程行操作',
      }),
    );

    expect(partitioned.standard.map((action) => action.id)).toEqual(['edit', 'archive']);
    expect(partitioned.destructive.map((action) => action.id)).toEqual(['delete']);
    expect(markup).toContain('data-admin-row-actions');
    expect(markup).toContain('查看');
    expect(markup).toContain('aria-label="课程行操作"');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('更多');
  });
});
