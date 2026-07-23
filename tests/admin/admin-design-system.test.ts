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

describe('Yuanwo SaaS admin design system', () => {
  it('keeps raw brand values separate from semantic UI responsibilities', () => {
    expect(ADMIN_THEME_NAME).toBe('yuanwo-saas-admin');
    expect(adminBrandTokens['--saas-primary']).toBe('#0058be');
    expect(adminBrandTokens['--saas-surface']).toBe('#f7f9fb');
    expect(adminBrandTokens['--saas-on-surface']).toBe('#191c1e');
    expect(adminSemanticTokens['--admin-action-primary']).toBe('var(--saas-primary)');
    expect(adminSemanticTokens['--admin-interactive-accent']).toBe('var(--saas-primary-container)');
    expect(adminSemanticTokens['--admin-selection-background']).toBe('var(--saas-primary-fixed)');
    expect(adminSemanticTokens['--admin-sidebar-width']).toBe('260px');
    expect(adminSemanticTokens['--admin-sidebar-compact-width']).toBe('72px');
  });

  it('exports one theme boundary for portalled admin overlays', () => {
    expect(adminThemeAttributes['data-admin-theme']).toBe('yuanwo-saas-admin');
    expect(adminThemeAttributes.style['--primary']).toBe('var(--admin-action-primary)');
    expect(adminThemeAttributes.style['--ring']).toBe('var(--admin-focus-ring)');

    const overlaySources = [
      'components/admin/AdminRowActions.tsx',
      'components/admin/AdminSessionActions.tsx',
      'components/admin/courses/CategoryDialog.tsx',
      'components/admin/exams/ScopePicker.tsx',
      'components/admin/AdminOverlay.tsx',
    ].map((file) => readFileSync(join(process.cwd(), file), 'utf8'));
    expect(overlaySources.every((source) => source.includes('{...adminThemeAttributes}'))).toBe(
      true,
    );
  });

  it('keeps Stitch temporary colors and brands out of the formal theme', () => {
    const themeSource = readFileSync(
      join(process.cwd(), 'components/admin/admin-theme.ts'),
      'utf8',
    );
    const previewSource = readFileSync(
      join(process.cwd(), 'components/admin/examples/AdminDesignPreview.tsx'),
      'utf8',
    );

    expect(themeSource).not.toMatch(/#3b82f6/i);
    expect(previewSource).not.toMatch(/SaaS Admin|Management Portal|hbc/);
    expect(previewSource).not.toMatch(/新建课程|添加用户/);
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
