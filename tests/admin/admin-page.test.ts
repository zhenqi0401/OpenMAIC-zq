import { describe, expect, it } from 'vitest';
import { resolveAdminModuleId } from '@/app/admin/page';

describe('AdminPage module routing', () => {
  it('maps query-string modules to one right-side admin view', () => {
    expect(resolveAdminModuleId({ module: 'courses' })).toBe('courses');
    expect(resolveAdminModuleId({ module: 'exams' })).toBe('exams');
    expect(resolveAdminModuleId({ module: 'access' })).toBe('access');
    expect(resolveAdminModuleId({ module: 'missing' })).toBe('dashboard');
    expect(resolveAdminModuleId({ module: ['courses', 'access'] })).toBe('dashboard');
  });
});
