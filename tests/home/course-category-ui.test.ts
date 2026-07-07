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
});
