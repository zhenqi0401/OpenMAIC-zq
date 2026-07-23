export interface AdminPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export class AdminQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminQueryError';
  }
}

export function parseAdminPagination(
  search: URLSearchParams,
  options: { defaultPageSize: number; maxPageSize?: number },
): { page: number; pageSize: number } {
  const page = search.has('page') ? Number(search.get('page')) : 1;
  const pageSize = search.has('pageSize')
    ? Number(search.get('pageSize'))
    : options.defaultPageSize;
  const maxPageSize = options.maxPageSize ?? 100;
  if (!Number.isInteger(page) || page < 1) {
    throw new AdminQueryError('page must be a positive integer');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > maxPageSize) {
    throw new AdminQueryError(`pageSize must be between 1 and ${maxPageSize}`);
  }
  return { page, pageSize };
}

export function parseAdminEnum<T extends string>(
  search: URLSearchParams,
  name: string,
  values: readonly T[],
  fallback: T,
): T {
  const value = search.get(name) ?? fallback;
  if (!values.includes(value as T)) {
    throw new AdminQueryError(`${name} must be one of ${values.join(', ')}`);
  }
  return value as T;
}

export function parseAdminText(search: URLSearchParams, name: string): string | undefined {
  return search.get(name)?.trim() || undefined;
}

export function toAdminPagination(page: number, pageSize: number, total: number): AdminPagination {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function paginateAdminItems<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): { items: T[]; pagination: AdminPagination } {
  const offset = (page - 1) * pageSize;
  return {
    items: items.slice(offset, offset + pageSize),
    pagination: toAdminPagination(page, pageSize, items.length),
  };
}
