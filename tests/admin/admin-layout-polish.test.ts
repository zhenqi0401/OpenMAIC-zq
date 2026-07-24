import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminSessionActions,
  adminAccountMenuLabels,
} from '@/components/admin/AdminSessionActions';
import { DashboardAdminPanel } from '@/components/admin/dashboard/DashboardAdminPanel';
import { AccessAdminPanel } from '@/components/admin/access/AccessAdminPanel';
import { CourseAdminPanel } from '@/components/admin/courses/CourseAdminPanel';
import { ExamPolicyAdminPanel } from '@/components/admin/exams/ExamPolicyAdminPanel';
import { CommunityAdminPanel } from '@/components/admin/community/CommunityAdminPanel';

describe('admin layout polish', () => {
  it('keeps global session actions inside module headers instead of a separate top row', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminShell,
        { activeModuleId: 'dashboard' } as React.ComponentProps<typeof AdminShell>,
        React.createElement('div', null, 'module content'),
      ),
    );

    expect(markup).toContain('module content');
    expect(markup).not.toContain('返回首页');
    expect(markup).not.toContain('退出登录');
  });

  it('keeps leading actions visible and moves session links into an account menu', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminSessionActions, {
        leading: React.createElement('button', null, '刷新'),
      }),
    );

    expect(markup).toContain('刷新');
    expect(markup).toContain('账户');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).not.toContain('返回首页');
    expect(markup).not.toContain('退出登录');
    expect(adminAccountMenuLabels.home).toBe('返回首页');
    expect(adminAccountMenuLabels.logout).toBe('退出登录');
  });

  it('uses the new dashboard periods without the removed learning table', () => {
    const markup = renderToStaticMarkup(React.createElement(DashboardAdminPanel));

    expect(markup).toContain('数据看板');
    expect(markup).toContain('账户');
    expect(markup).not.toContain('返回首页');
    expect(markup).not.toContain('退出登录');
    const chartSource = readFileSync('components/admin/dashboard/AdminActivityChart.tsx', 'utf8');
    expect(chartSource).toContain('aria-label="趋势周期"');
    expect(chartSource).toContain("['week', 'month', 'year']");
    expect(markup).not.toContain('data-admin-dashboard-progress-panel');
    expect(markup).not.toContain('学习记录');
    expect(markup).not.toContain('测评通过率');
  });

  it('keeps course and exam module action buttons textual', () => {
    const courseMarkup = renderToStaticMarkup(React.createElement(CourseAdminPanel));
    const examMarkup = renderToStaticMarkup(React.createElement(ExamPolicyAdminPanel));

    expect(courseMarkup).toContain('账户');
    expect(courseMarkup).not.toContain('>返回首页<');
    expect(courseMarkup).not.toContain('>退出登录<');
    expect(courseMarkup).toContain('刷新');
    expect(courseMarkup).toContain('课程列表');
    expect(courseMarkup).toContain('上一页');
    expect(courseMarkup).toContain('下一页');
    expect(courseMarkup).not.toContain('新建课程草稿');
    expect(courseMarkup).not.toContain('创建草稿');
    expect(courseMarkup).not.toContain('data-size="icon"');
    expect(examMarkup).toContain('账户');
    expect(examMarkup).not.toContain('返回首页');
    expect(examMarkup).not.toContain('退出登录');
    expect(examMarkup).not.toContain('data-size="icon"');
  });

  it('places the same refresh control before the account button in all five modules', () => {
    const markups = [
      DashboardAdminPanel,
      CourseAdminPanel,
      ExamPolicyAdminPanel,
      CommunityAdminPanel,
      AccessAdminPanel,
    ].map((Component) => renderToStaticMarkup(React.createElement(Component)));

    for (const markup of markups) {
      expect(markup.match(/data-admin-refresh-button="true"/g)).toHaveLength(1);
      expect(markup).toContain('lucide-refresh-cw');
      expect(markup.indexOf('data-admin-refresh-button')).toBeLessThan(
        markup.indexOf('aria-label="账户"'),
      );
      expect(markup).toContain('刷新中…');
      expect(markup).toContain('disabled=""');
    }
  });

  it('renders one URL-addressable access workspace behind three semantic tabs', () => {
    const userMarkup = renderToStaticMarkup(React.createElement(AccessAdminPanel));
    const roleMarkup = renderToStaticMarkup(
      React.createElement(AccessAdminPanel, { initialSection: 'roles' }),
    );
    const inviteMarkup = renderToStaticMarkup(
      React.createElement(AccessAdminPanel, { initialSection: 'invites' }),
    );

    expect(userMarkup).toContain('data-admin-access-layout');
    expect(userMarkup).toContain('用户管理');
    expect(userMarkup).toContain('role="tablist"');
    expect(userMarkup.match(/role="tab"/g)).toHaveLength(3);
    expect(userMarkup).toContain('用户');
    expect(userMarkup).toContain('角色');
    expect(userMarkup).toContain('邀请码');
    expect(userMarkup).toContain('data-admin-access-workspace="users"');
    expect(userMarkup).not.toContain('脱敏手机号');
    expect(userMarkup).not.toContain('危险操作');
    expect(userMarkup).not.toContain('data-admin-access-workspace="roles"');
    expect(userMarkup).not.toContain('data-admin-access-workspace="invites"');

    expect(roleMarkup).toContain('data-admin-access-workspace="roles"');
    expect(roleMarkup).not.toContain('data-admin-access-workspace="users"');
    expect(roleMarkup).not.toContain('data-admin-access-workspace="invites"');

    expect(inviteMarkup).toContain('data-admin-access-workspace="invites"');
    expect(inviteMarkup).not.toContain('data-admin-access-workspace="users"');
    expect(inviteMarkup).not.toContain('data-admin-access-workspace="roles"');

    for (const markup of [userMarkup, roleMarkup, inviteMarkup]) {
      expect(markup).not.toContain('min-w-[900px]');
      expect(markup).not.toContain('data-size="icon"');
    }

    const inviteSource = readFileSync(
      `${process.cwd()}/components/admin/access/AccessInvitesTab.tsx`,
      'utf8',
    );
    expect(inviteSource).not.toContain('min-w-[900px]');
    expect(inviteSource).not.toContain('whitespace-nowrap');
  });
});
