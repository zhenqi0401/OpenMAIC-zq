import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('home course category selector UI', () => {
  it('uses the Chinese course category label without the admin icon', () => {
    const source = readFileSync('app/page.tsx', 'utf8');
    const categoryBlock = source.slice(
      source.indexOf('{requiresCategory && ('),
      source.indexOf('{/* Toolbar row */}'),
    );

    expect(categoryBlock).toContain('课程分类选择');
    expect(categoryBlock).not.toContain('Course category</span>');
    expect(categoryBlock).not.toContain('<Shield');
  });

  it('requires a separate empty-by-default training strategy and keeps the legacy label', () => {
    const source = readFileSync('app/page.tsx', 'utf8');
    const zhCN = readFileSync('lib/i18n/locales/zh-CN.json', 'utf8');

    expect(source).toContain("trainingCourseType: ''");
    expect(source).toContain('!!form.trainingCourseType');
    expect(source).toContain('trainingCourseType: form.trainingCourseType');
    expect(source).toContain('name="training-course-type"');
    expect(zhCN).toContain('"原大纲总结式"');
    expect(zhCN).not.toContain('"其他课程"');
  });

  it('keeps system categories reorderable while disabling rename and delete controls', () => {
    const source = readFileSync('components/admin/courses/CategoryDialog.tsx', 'utf8');
    expect(source).toContain('category.isSystem');
    expect(source).toContain("category.managementMode === 'read_only' || category.isSystem");
    expect(source).toContain('onClick={() => reorder(category.id, -1)}');
    expect(source).toContain('onClick={() => reorder(category.id, 1)}');
  });

  it('keeps fixed learner categories independent from the course source tabs', () => {
    const source = readFileSync('components/home/LearnerHome.tsx', 'utf8');

    expect(source).toContain("scope: 'all'");
    expect(source).toContain('changeHomeCourseCategory(\n          current,');
    expect(source).not.toContain("scope: requestedCategoryKey ? 'tenant' : 'all'");
  });

  it('places the learner entry second in the management home toolbar', () => {
    const source = readFileSync('app/page.tsx', 'utf8');
    const toolbar = source.slice(
      source.indexOf('{/* ═══ Top-right pill'),
      source.indexOf('<SettingsDialog'),
    );

    expect(toolbar.indexOf('aria-label="Admin"')).toBeLessThan(
      toolbar.indexOf('aria-label="进入学员端"'),
    );
    expect(toolbar.indexOf('aria-label="进入学员端"')).toBeLessThan(
      toolbar.indexOf('<LanguageSwitcher'),
    );
    expect(toolbar).toContain("router.push('/learn')");
  });
});
