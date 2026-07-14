import { describe, expect, it } from 'vitest';
import { paginateAdminRows } from '@/lib/admin/pagination';

describe('paginateAdminRows', () => {
  const rows = Array.from({ length: 23 }, (_, index) => `row-${index + 1}`);

  it('calculates ten-row pages and record ranges', () => {
    expect(paginateAdminRows(rows, 2)).toEqual({
      page: 2,
      totalPages: 3,
      start: 11,
      end: 20,
      total: 23,
      rows: rows.slice(10, 20),
    });
  });

  it('paginates the filtered result rather than the unfiltered source', () => {
    const filtered = rows.filter((row) => Number(row.split('-')[1]) % 2 === 1);

    expect(paginateAdminRows(filtered, 2)).toMatchObject({
      page: 2,
      totalPages: 2,
      start: 11,
      end: 12,
      total: 12,
      rows: ['row-21', 'row-23'],
    });
  });

  it('clamps the current page after rows are removed', () => {
    expect(paginateAdminRows(rows.slice(0, 11), 3)).toMatchObject({
      page: 2,
      totalPages: 2,
      start: 11,
      end: 11,
      rows: ['row-11'],
    });
  });

  it('keeps an empty list on page one with a zero range', () => {
    expect(paginateAdminRows([], 8)).toEqual({
      page: 1,
      totalPages: 1,
      start: 0,
      end: 0,
      total: 0,
      rows: [],
    });
  });
});
