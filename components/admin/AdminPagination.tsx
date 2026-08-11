'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Pagination } from 'antd';

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
        <Pagination
          current={currentPage}
          disabled={loading || empty}
          hideOnSinglePage={false}
          itemRender={(page, type, originalElement) => {
            if (type === 'prev')
              return (
                <span aria-label="上一页">
                  <ChevronLeft aria-hidden="true" />
                  上一页
                </span>
              );
            if (type === 'next')
              return (
                <span aria-label="下一页">
                  下一页
                  <ChevronRight aria-hidden="true" />
                </span>
              );
            return originalElement;
          }}
          pageSize={1}
          showLessItems
          showSizeChanger={false}
          simple
          total={lastPage}
          onChange={onPageChange}
        />
      </div>
    </nav>
  );
}
