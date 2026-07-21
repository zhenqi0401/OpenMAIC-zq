import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  AdminSessionActions,
  adminAccountMenuLabels,
} from '@/components/admin/AdminSessionActions';
import { AdminSlice08Panel } from '@/components/admin/AdminSlice08Panel';
import { CourseAdminPanel } from '@/components/admin/courses/CourseAdminPanel';
import { ExamPolicyAdminPanel } from '@/components/admin/exams/ExamPolicyAdminPanel';

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

  it('puts dashboard filters and learner rows in one continuous panel', () => {
    const markup = renderToStaticMarkup(
      React.createElement(AdminSlice08Panel, { view: 'dashboard' }),
    );

    expect(markup).toContain('刷新看板');
    expect(markup).toContain('账户');
    expect(markup).not.toContain('返回首页');
    expect(markup).not.toContain('退出登录');
    expect(markup).toContain('data-admin-dashboard-progress-panel');
    expect(markup).toContain('学员列表');
    expect(markup).toContain('按用户 ID 筛选');
    expect(markup).toContain('显示 0 条，共 0 条');
    expect(markup).toContain('上一页');
    expect(markup).toContain('下一页');
  });

  it('keeps course and exam module action buttons textual', () => {
    const courseMarkup = renderToStaticMarkup(React.createElement(CourseAdminPanel));
    const examMarkup = renderToStaticMarkup(React.createElement(ExamPolicyAdminPanel));

    expect(courseMarkup).toContain('账户');
    expect(courseMarkup).not.toContain('返回首页');
    expect(courseMarkup).not.toContain('退出登录');
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

  it('puts roles and invites side by side, with paginated user roles below', () => {
    const markup = renderToStaticMarkup(React.createElement(AdminSlice08Panel, { view: 'access' }));

    expect(markup).toContain('data-admin-access-layout');
    expect(markup).toContain('data-admin-access-top');
    expect(markup).toContain('data-admin-access-invite-table');
    expect(markup).toContain('角色与用户');
    expect(markup).toContain('邀请码维护');
    expect(markup).toContain('每页 10 条');
    expect(markup).toContain('角色标识');
    expect(markup).toContain('角色名称');
    expect(markup).toContain('学员');
    expect(markup).toContain('手机号');
    expect(markup).toContain('邀请码状态');
    expect(markup).toContain('绑定角色');
    expect(markup).toMatch(/<input[^>]*maxLength="16"[^>]*placeholder="新邀请码明文"/);
    expect(markup).not.toContain('data-size="icon"');

    expect(markup.indexOf('data-admin-access-roles')).toBeLessThan(
      markup.indexOf('data-admin-access-invites'),
    );
    expect(markup.indexOf('data-admin-access-invites')).toBeLessThan(
      markup.indexOf('data-admin-access-user-roles'),
    );
    expect(markup).toContain('xl:grid-cols-[minmax(0,1fr)_minmax(560px,0.9fr)]');
    expect(markup).toContain('min-w-[900px]');
    expect(markup).toContain('whitespace-nowrap');
  });
});
