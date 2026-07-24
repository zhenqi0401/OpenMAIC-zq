import { describe, expect, it } from 'vitest';
import { formatAdminDateTime } from '@/lib/admin/date-time';

describe('formatAdminDateTime', () => {
  const localDate = new Date(2026, 6, 23, 14, 5, 9);

  it('formats Date and ISO string values in local time with seconds', () => {
    expect(formatAdminDateTime(localDate)).toBe('2026-07-23 14:05:09');
    expect(formatAdminDateTime(localDate.toISOString())).toBe('2026-07-23 14:05:09');
    expect(formatAdminDateTime(localDate)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it('uses the requested empty fallback but never hides an invalid timestamp', () => {
    expect(formatAdminDateTime(null)).toBe('—');
    expect(formatAdminDateTime(undefined, '长期有效')).toBe('长期有效');
    expect(formatAdminDateTime('', '长期有效')).toBe('长期有效');
    expect(formatAdminDateTime('not-a-date', '长期有效')).toBe('—');
    expect(formatAdminDateTime(new Date(Number.NaN))).toBe('—');
  });
});
