import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveAdminModuleId } from '@/lib/admin/module';

describe('AdminPage module routing', () => {
  it('maps query-string modules to one right-side admin view', () => {
    expect(resolveAdminModuleId({ module: 'courses' })).toBe('courses');
    expect(resolveAdminModuleId({ module: 'exams' })).toBe('exams');
    expect(resolveAdminModuleId({ module: 'community' })).toBe('community');
    expect(resolveAdminModuleId({ module: 'access' })).toBe('access');
    expect(resolveAdminModuleId({ module: 'missing' })).toBe('dashboard');
    expect(resolveAdminModuleId({ module: ['courses', 'access'] })).toBe('dashboard');
  });

  it('routes dashboard and access module ids to their split panels', () => {
    const source = readFileSync('app/admin/page.tsx', 'utf8');

    expect(source).toContain("if (activeModuleId === 'dashboard') return <DashboardAdminPanel />;");
    expect(source).toContain("if (activeModuleId === 'access') return <AccessAdminPanel />;");
    expect(source).not.toContain('AdminSlice08Panel');
  });
});
