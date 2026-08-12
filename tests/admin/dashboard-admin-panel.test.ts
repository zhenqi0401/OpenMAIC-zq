import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  DashboardPendingItems,
  loadDashboardAdminData,
} from '@/components/admin/dashboard/DashboardAdminPanel';
import {
  AdminActivityChart,
  buildTickFilter,
  formatActivityTooltip,
  seriesNameOf,
} from '@/components/admin/dashboard/AdminActivityChart';
import { DashboardMetric } from '@/components/admin/dashboard/DashboardMetric';
import { DashboardProgressTable } from '@/components/admin/dashboard/DashboardProgressTable';
import type { AdminInviteCode, AdminRole } from '@/lib/admin/client';
import {
  buildDashboardPendingItems,
  getDashboardLastActivity,
  getDashboardPassRateDisplay,
  getDashboardRoleName,
} from '@/lib/admin/presentation';

describe('DashboardAdminPanel data loading', () => {
  it('loads dashboard, roles, invite codes, and users together', async () => {
    const dashboard = {
      summary: {
        courseCompletionRate: 75,
        assessmentPassRate: 80,
        examPassRate: 60,
        learnerCount: 2,
        courseCount: 3,
        assessmentAttemptCount: 4,
        examAttemptCount: 5,
      },
      progress: [],
    };
    const client = {
      getDashboard: vi.fn(async () => dashboard),
      listRoles: vi.fn(async () => []),
      listInviteCodes: vi.fn(async () => []),
      listUsers: vi.fn(async () => []),
    };

    await expect(loadDashboardAdminData(client)).resolves.toEqual({
      dashboard,
      roles: [],
      inviteCodes: [],
      users: [],
    });
    expect(client.getDashboard).toHaveBeenCalledOnce();
    expect(client.listRoles).toHaveBeenCalledOnce();
    expect(client.listInviteCodes).toHaveBeenCalledOnce();
    expect(client.listUsers).toHaveBeenCalledOnce();
  });
});

describe('dashboard metric presentation', () => {
  it('shows no sample for assessment and exam metrics with zero attempts', () => {
    expect(getDashboardPassRateDisplay(0, 0, '测评')).toEqual({
      value: '—',
      note: '暂无测评记录',
      progress: null,
    });
    expect(getDashboardPassRateDisplay(0, 0, '考核')).toEqual({
      value: '—',
      note: '暂无考核记录',
      progress: null,
    });
  });

  it('keeps a zero pass rate visible when attempts exist', () => {
    expect(getDashboardPassRateDisplay(0, 3, '测评')).toEqual({
      value: '0%',
      note: '测评 3 次',
      progress: 0,
    });
  });

  it('does not render a progress bar for a count metric', () => {
    const markup = renderToStaticMarkup(
      React.createElement(DashboardMetric, {
        label: '学员人数',
        value: '8',
        progress: null,
        note: '覆盖课程 2 门',
      }),
    );

    expect(markup).toContain('学员人数');
    expect(markup).not.toContain('style="width:');
  });
});

describe('dashboard pending items', () => {
  const now = new Date('2026-07-21T00:00:00.000Z');
  const dashboard = {
    summary: {
      courseCompletionRate: 0,
      assessmentPassRate: 0,
      examPassRate: 0,
      learnerCount: 0,
      courseCount: 0,
      assessmentAttemptCount: 0,
      examAttemptCount: 0,
    },
    progress: [],
  };

  it('links each actionable task to the matching access section', () => {
    const items = buildDashboardPendingItems(dashboard, [], [], [], now);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: '尚未创建可分配角色',
          href: '/admin?module=access&section=roles',
          actionLabel: '配置角色',
        }),
        expect.objectContaining({
          title: '暂无可用邀请码',
          href: '/admin?module=access&section=invites',
          actionLabel: '创建邀请码',
        }),
        expect.objectContaining({
          title: '尚无用户记录',
          href: '/admin?module=access&section=users',
          actionLabel: '查看用户管理',
        }),
      ]),
    );
    expect(items.find((item) => item.id === 'progress-empty')?.severity).toBe('info');
  });

  it('does not treat disabled or expired invite codes as available', () => {
    const inviteCodes = [
      {
        id: 'disabled',
        roleId: 'role-1',
        enabled: false,
        expiresAt: null,
        createdAt: now,
      },
      {
        id: 'expired',
        roleId: 'role-1',
        enabled: true,
        expiresAt: new Date('2026-07-20T23:59:59.000Z'),
        createdAt: now,
      },
    ] satisfies AdminInviteCode[];

    expect(
      buildDashboardPendingItems(null, [{} as AdminRole], inviteCodes, [{} as never], now),
    ).toEqual([
      expect.objectContaining({
        id: 'invites-empty',
        href: '/admin?module=access&section=invites',
      }),
    ]);
  });

  it('uses a warning badge only for real pending work and removes the old detached copy', () => {
    const pending = {
      total: 2,
      items: [
        {
          id: 'courses',
          type: 'course',
          severity: 'high' as const,
          title: '课程待补充',
          description: '仍有课程缺少题目。',
          count: 2,
          href: '/admin?module=courses',
          actionLabel: '查看课程',
        },
      ],
    };
    const warningMarkup = renderToStaticMarkup(
      React.createElement(DashboardPendingItems, { pending }),
    );
    const zeroMarkup = renderToStaticMarkup(
      React.createElement(DashboardPendingItems, {
        pending: { total: 0, items: [] },
      }),
    );

    expect(warningMarkup).toContain('2个待处理');
    expect(warningMarkup).toContain('ant-tag-error');
    expect(zeroMarkup).toContain('0个待处理');
    expect(zeroMarkup).toContain('ant-tag-success');
    expect(`${warningMarkup}${zeroMarkup}`).not.toContain('只列出已确认的配置或内容异常');
    expect(`${warningMarkup}${zeroMarkup}`).not.toContain('text-2xl font-semibold tabular-nums');
  });
});

describe('dashboard community activity chart', () => {
  const activity = {
    totals: { interactions: 20, posts: 3, replies: 7, danmaku: 10 },
    points: [
      { date: '2026-07-22', interactions: 8, posts: 1, replies: 2, danmaku: 5 },
      { date: '2026-07-23', interactions: 12, posts: 2, replies: 5, danmaku: 5 },
    ],
  };

  it('resolves the series name from both single datum and G2 series arrays', () => {
    expect(seriesNameOf({ series: '总互动', date: '2026-07-22' })).toBe('总互动');
    // G2 对 area/line 系列图形传入该系列全部数据点数组
    expect(
      seriesNameOf([
        { series: '帖子', date: '2026-07-22', value: 1 },
        { series: '帖子', date: '2026-07-23', value: 2 },
      ]),
    ).toBe('帖子');
    expect(seriesNameOf([])).toBeUndefined();
    expect(seriesNameOf(null)).toBeUndefined();
  });

  it('keeps one x tick per day for week, one per 3 days for month and one per month for year', () => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 6, 1 + i));
      return d.toISOString().slice(0, 10);
    });
    // 周:每天一个刻度
    expect(days.filter(buildTickFilter('week'))).toHaveLength(30);
    // 月:每三天一个刻度(1、4、7、…、28)
    const monthTicks = days.filter(buildTickFilter('month'));
    expect(monthTicks).toHaveLength(10);
    expect(monthTicks[0]).toBe('2026-07-01');
    expect(monthTicks[1]).toBe('2026-07-04');
    // 年:每月一个刻度(YYYY-MM 格式直接放行)
    const yearMonths = ['2026-01', '2026-02', '2026-12'];
    expect(yearMonths.filter(buildTickFilter('year'))).toHaveLength(3);
    // 非日期标签(空数据占位)在月视图也保持显示
    expect(buildTickFilter('month')('暂无数据')).toBe(true);
  });

  it('formats a rich axis tooltip for the focused point', () => {
    const tooltip = formatActivityTooltip(activity.points[1]);

    expect(tooltip).toContain('2026-07-23');
    expect(tooltip).toContain('总互动');
    expect(tooltip).toContain('<strong>12</strong>');
    expect(tooltip).toContain('<strong>5</strong>');
  });

  it('keeps the chart accessible and exposes week, month and year controls', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminActivityChart, {
        activity,
        loading: false,
        onRangeChange: vi.fn(),
        range: 'month',
      }),
    );

    expect(markup).toContain('aria-label="趋势周期"');
    expect(markup).toContain('>周</div>');
    expect(markup).toContain('>月</div>');
    expect(markup).toContain('>年</div>');
    expect(markup).toContain('ant-segmented-item-selected');
    expect(markup).toContain('总互动');
    expect(markup).toContain('20');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('data-admin-activity-legend="interactions"');
    expect(markup).toContain('data-admin-activity-legend="posts"');
    expect(markup).toContain('data-admin-activity-legend="replies"');
    expect(markup).toContain('data-admin-activity-legend="danmaku"');
  });

  it('renders a zero series placeholder for empty data', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminActivityChart, {
        activity: {
          totals: { interactions: 0, posts: 0, replies: 0, danmaku: 0 },
          points: [],
        },
        loading: false,
        onRangeChange: vi.fn(),
        range: 'week',
      }),
    );

    expect(markup).toContain('data-admin-activity-chart-canvas');
    expect(markup).toContain('tabindex="0"');
    expect(markup).toContain('data-admin-community-chart');
  });
});

describe('dashboard learning records', () => {
  const roles = [
    { id: 'role-1', code: 'learner', name: '一线学员', isAdmin: false },
  ] satisfies AdminRole[];
  const lastViewedAt = new Date('2026-07-21T09:30:00.000Z');
  const updatedAt = new Date('2026-07-21T10:30:00.000Z');
  const progress = [
    {
      userId: 'user-1',
      displayName: '小元',
      roleId: 'role-1',
      roleCode: 'learner',
      courseId: 'course-1',
      courseName: '入职课程',
      completed: false,
      startedAt: new Date('2026-07-20T08:00:00.000Z'),
      lastViewedAt,
      updatedAt,
    },
  ];

  it('uses the learning-record title, visible filter labels, and real row fields', () => {
    const markup = renderToStaticMarkup(
      React.createElement(DashboardProgressTable, {
        progress,
        emptyText: '无学习记录',
        dashboardFilters: { userId: '', roleId: '', courseId: '' },
        roles,
        onFilterChange: vi.fn(),
        onPageChange: vi.fn(),
        onReset: vi.fn(),
        onSubmit: vi.fn(),
        page: 1,
      }),
    );

    expect(markup).toContain('学习记录');
    expect(markup).toContain('用户 ID');
    expect(markup).toContain('课程 ID');
    expect(markup).toContain('开始时间');
    expect(markup).toContain('一线学员');
    expect(markup).toContain('学习中');
    expect(markup).not.toContain('学习进度');
  });

  it('maps roleCode to the role name for primary display', () => {
    expect(getDashboardRoleName('role-1', 'learner', roles)).toBe('一线学员');
  });

  it('prefers lastViewedAt over updatedAt for recent activity', () => {
    expect(getDashboardLastActivity(progress[0])).toBe(lastViewedAt);
    expect(getDashboardLastActivity({ updatedAt })).toBe(updatedAt);
  });
});
