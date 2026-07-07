import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminShell } from '@/components/admin/AdminShell';
import { AdminSlice08Panel } from '@/components/admin/AdminSlice08Panel';
import { CourseAdminPanel } from '@/components/admin/courses/CourseAdminPanel';
import { ExamPolicyAdminPanel } from '@/components/admin/exams/ExamPolicyAdminPanel';

describe('admin layout polish', () => {
  it('keeps global session actions inside module headers instead of a separate top row', () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminShell,
        { activeModuleId: 'dashboard' },
        React.createElement('div', null, 'module content'),
      ),
    );

    expect(markup).toContain('module content');
    expect(markup).not.toContain('返回首页');
    expect(markup).not.toContain('退出登录');
  });

  it('puts dashboard filters and learner rows in one continuous panel', () => {
    const markup = renderToStaticMarkup(React.createElement(AdminSlice08Panel, { view: 'dashboard' }));

    expect(markup).toContain('刷新看板');
    expect(markup).toContain('返回首页');
    expect(markup).toContain('data-admin-dashboard-progress-panel');
    expect(markup).toContain('学员列表');
    expect(markup).toContain('按用户 ID 筛选');
  });

  it('keeps course and exam module action buttons textual', () => {
    const courseMarkup = renderToStaticMarkup(React.createElement(CourseAdminPanel));
    const examMarkup = renderToStaticMarkup(React.createElement(ExamPolicyAdminPanel));

    expect(courseMarkup).toContain('返回首页');
    expect(courseMarkup).toContain('刷新');
    expect(courseMarkup).not.toContain('data-size="icon"');
    expect(examMarkup).toContain('返回首页');
    expect(examMarkup).not.toContain('data-size="icon"');
  });

  it('lays out access management as role/user left and invite right with table headers', () => {
    const markup = renderToStaticMarkup(React.createElement(AdminSlice08Panel, { view: 'access' }));

    expect(markup).toContain('data-admin-access-layout');
    expect(markup).toContain('角色与用户');
    expect(markup).toContain('邀请码维护');
    expect(markup).toContain('角色标识');
    expect(markup).toContain('角色名称');
    expect(markup).toContain('学员');
    expect(markup).toContain('手机号');
    expect(markup).toContain('邀请码状态');
    expect(markup).toContain('绑定角色');
    expect(markup).not.toContain('data-size="icon"');
  });
});
