export const ADMIN_PAGE_SIZE = 10;

export interface AdminPagination<T> {
  page: number;
  totalPages: number;
  start: number;
  end: number;
  total: number;
  rows: T[];
}

export function paginateAdminRows<T>(
  rows: readonly T[],
  requestedPage: number,
  pageSize = ADMIN_PAGE_SIZE,
): AdminPagination<T> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error('pageSize must be a positive integer');
  }

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const page = Math.max(1, Math.min(normalizedPage, totalPages));
  const offset = (page - 1) * pageSize;

  return {
    page,
    totalPages,
    start: total === 0 ? 0 : offset + 1,
    end: Math.min(offset + pageSize, total),
    total,
    rows: rows.slice(offset, offset + pageSize),
  };
}
