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
});
