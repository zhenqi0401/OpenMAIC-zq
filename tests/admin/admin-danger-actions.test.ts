import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  adminDangerButtonClassName,
  adminDangerOutlineButtonClassName,
  adminSecondaryButtonClassName,
} from '@/components/admin/AdminSurface';

describe('admin destructive action styling', () => {
  it('forces red-on-white confirmation semantics over the base destructive variant', () => {
    expect(adminDangerButtonClassName).toContain('!bg-[var(--admin-danger)]');
    expect(adminDangerButtonClassName).toContain('!text-white');
    expect(adminDangerButtonClassName).toContain('hover:!bg-[var(--admin-danger-strong)]');
    expect(adminDangerOutlineButtonClassName).toContain('border-[var(--admin-danger)]');
    expect(adminDangerOutlineButtonClassName).toContain('bg-[var(--admin-surface)]');
    expect(adminSecondaryButtonClassName).toContain('bg-[var(--admin-surface)]');
  });

  it('routes all six requested delete or revoke surfaces through the shared danger contract', () => {
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

    expect(deleteDialog).toContain('className={adminDangerButtonClassName}');
    expect(courses).toContain('<AdminDeleteDialog');
    expect(accessUsers).toContain('className={adminDangerButtonClassName}');
    expect(accessRoles).toContain('<AccessDangerDialog');
    expect(accessInvites).toContain('<AccessDangerDialog');
    expect(exams).toContain('className={adminDangerButtonClassName}');
    expect(community).toContain("action === 'delete' ? adminDangerButtonClassName");
  });
});
