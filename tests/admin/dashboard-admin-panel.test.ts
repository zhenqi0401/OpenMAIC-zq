import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { loadDashboardAdminData } from '@/components/admin/dashboard/DashboardAdminPanel';
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
