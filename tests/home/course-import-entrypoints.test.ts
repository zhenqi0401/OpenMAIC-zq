import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

describe('enterprise course import entry points', () => {
  test('uses one enterprise import dialog from both administrator surfaces', () => {
    const home = readFileSync('app/page.tsx', 'utf8');
    const management = readFileSync('components/admin/courses/CourseAdminPanel.tsx', 'utf8');
    expect(home).toContain('<EnterpriseCourseImportDialog');
    expect((home.match(/setEnterpriseImportOpen\(true\)/g) ?? []).length).toBe(2);
    expect(management).toContain('<EnterpriseCourseImportDialog');
    expect(management).toContain('导入企业课程');
  });

  test('removes learner ZIP import controls while retaining local-course operations', () => {
    const learner = readFileSync('components/home/LearnerHome.tsx', 'utf8');
    const home = readFileSync('app/page.tsx', 'utf8');
    expect(learner).not.toContain('导入本地课程');
    expect(learner).not.toContain('onImport');
    expect(learner).toContain("{ value: 'local', label: '本地课程' }");
    expect(learner).toContain('onRenameCourse');
    expect(learner).toContain('onDeleteCourse');
    expect(home).not.toContain('useImportClassroom');
  });
});
