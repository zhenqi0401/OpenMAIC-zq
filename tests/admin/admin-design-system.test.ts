import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_THEME_NAME,
  adminBrandTokens,
  adminSemanticTokens,
  adminThemeAttributes,
} from '@/components/admin/admin-theme';

function sourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(?:ts|tsx)$/.test(entry)
        ? [path]
        : [];
  });
}

describe('Yuanwo admin design system', () => {
  it('keeps raw brand values separate from semantic UI responsibilities', () => {
    expect(ADMIN_THEME_NAME).toBe('yuanwo-blue');
    expect(adminBrandTokens['--yw-blue-800']).toBe('#07559a');
    expect(adminBrandTokens['--yw-blue-500']).toBe('#22a7e6');
    expect(adminSemanticTokens['--admin-action-primary']).toBe('var(--yw-blue-800)');
    expect(adminSemanticTokens['--admin-interactive-accent']).toBe('var(--yw-blue-500)');
    expect(adminSemanticTokens['--admin-selection-background']).toBe('var(--yw-blue-100)');
  });

  it('exports one theme boundary for portalled admin overlays', () => {
    expect(adminThemeAttributes['data-admin-theme']).toBe('yuanwo-blue');
    expect(adminThemeAttributes.style['--primary']).toBe('var(--admin-action-primary)');
    expect(adminThemeAttributes.style['--ring']).toBe('var(--admin-focus-ring)');

    const overlaySources = [
      'components/admin/AdminRowActions.tsx',
      'components/admin/AdminSessionActions.tsx',
      'components/admin/courses/CategoryDialog.tsx',
      'components/admin/exams/ScopePicker.tsx',
    ].map((file) => readFileSync(join(process.cwd(), file), 'utf8'));
    expect(overlaySources.every((source) => source.includes('{...adminThemeAttributes}'))).toBe(
      true,
    );
  });

  it('prevents business components from introducing raw hexadecimal colors', () => {
    const adminRoot = join(process.cwd(), 'components/admin');
    const themeFile = join(adminRoot, 'admin-theme.ts');
    const violations = sourceFiles(adminRoot)
      .filter((file) => file !== themeFile)
      .flatMap((file) => {
        const matches = readFileSync(file, 'utf8').match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
        return matches.map((color) => `${relative(process.cwd(), file)}: ${color}`);
      });

    expect(violations).toEqual([]);
  });
});
