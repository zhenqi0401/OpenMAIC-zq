import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  adminDangerButtonClassName,
  adminDangerOutlineButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';

describe('admin destructive action styling', () => {
  it('delegates destructive styling to the antd danger semantic (no className overrides)', () => {
    // 视觉由 ConfigProvider 主题 token 与 antd Button 的 danger / type 语义接管，
    // 不再用 className 硬编码颜色（旧覆盖会产生黑边与尺寸/文字异常）。
    expect(adminDangerButtonClassName).toBe('');
    expect(adminDangerOutlineButtonClassName).toBe('');
    expect(adminSecondaryButtonClassName).toBe('');
  });

  it('routes all six requested delete or revoke surfaces through the antd danger semantic', () => {
    const deleteDialog = readFileSync('components/admin/AdminDeleteDialog.tsx', 'utf8');
    const accessUsers = readFileSync('components/admin/access/AccessUsersTab.tsx', 'utf8');
    const accessRoles = readFileSync('components/admin/access/AccessRolesTab.tsx', 'utf8');
    const accessInvites = readFileSync('components/admin/access/AccessInvitesTab.tsx', 'utf8');
    const courses = readFileSync('components/admin/courses/CourseAdminPanel.tsx', 'utf8');
    const exams = readFileSync('components/admin/exams/ExamPolicyTable.tsx', 'utf8');
    const community = readFileSync(
      'components/admin/community/CommunityModerationDialog.tsx',
      'utf8',
    );

    expect(deleteDialog).toContain('danger');
    expect(courses).toContain('<AdminDeleteDialog');
    expect(accessUsers).toContain('danger');
    expect(accessRoles).toContain('<AccessDangerDialog');
    expect(accessInvites).toContain('<AccessDangerDialog');
    expect(exams).toContain('variant="destructive"');
    expect(community).toContain("danger={action === 'delete'}");
  });
});
