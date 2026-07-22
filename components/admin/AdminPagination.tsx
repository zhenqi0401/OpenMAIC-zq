'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adminSecondaryButtonClassName } from '@/components/admin/AdminSurface';

export interface AdminPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}

export function AdminPagination({
  page,
  totalPages,
  total,
  start,
  end,
  loading = false,
  onPageChange,
}: AdminPaginationProps) {
  const lastPage = Math.max(1, totalPages);
  const currentPage = Math.min(Math.max(1, page), lastPage);
  const empty = total === 0;
  const previousDisabled = loading || empty || currentPage <= 1;
  const nextDisabled = loading || empty || currentPage >= lastPage;
  const summary = empty ? '共 0 条' : `显示 ${start}–${end} 条，共 ${total} 条`;

  return (
    <nav
      aria-label="分页"
      className="flex flex-wrap items-center justify-between gap-3"
      data-admin-pagination
    >
      <span
        aria-live="polite"
        className="text-xs text-[var(--admin-muted-foreground)]"
        data-admin-pagination-summary
      >
        {summary}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-xs tabular-nums text-[var(--admin-muted-foreground)]">
          第 {currentPage} / {lastPage} 页
        </span>
        <Button
          aria-label="上一页"
          className={adminSecondaryButtonClassName}
          disabled={previousDisabled}
          onClick={() => onPageChange(currentPage - 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          <ChevronLeft aria-hidden="true" />
          上一页
        </Button>
        <Button
          aria-label="下一页"
          className={adminSecondaryButtonClassName}
          disabled={nextDisabled}
          onClick={() => onPageChange(currentPage + 1)}
          size="sm"
          type="button"
          variant="outline"
        >
          下一页
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
