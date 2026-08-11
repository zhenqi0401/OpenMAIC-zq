'use client';

import { Pagination } from 'antd';
import { cn } from '@/lib/utils';

export interface AdminPaginationProps {
  page: number;
  total: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * 标准 Ant Design Pagination：不重画翻页结构、不自定义文字、不额外显示
 * “第 x / y 页”。桌面右对齐，移动端由 responsive 接管；单页时隐藏翻页
 * 按钮，只保留“共 N 条”摘要。
 */
export function AdminPagination({
  page,
  total,
  pageSize,
  loading = false,
  onPageChange,
  className,
}: AdminPaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), lastPage);

  if (lastPage <= 1) {
    return (
      <nav
        aria-label="分页"
        className={cn('flex flex-wrap items-center justify-end', className)}
        data-admin-pagination
      >
        <span className="text-sm tabular-nums text-[var(--admin-muted-foreground)]">
          共 {total} 条
        </span>
      </nav>
    );
  }

  return (
    <nav
      aria-label="分页"
      className={cn('flex flex-wrap items-center justify-end gap-3', className)}
      data-admin-pagination
    >
      <Pagination
        current={currentPage}
        disabled={loading}
        onChange={onPageChange}
        pageSize={pageSize}
        responsive
        showSizeChanger={false}
        showTotal={(pageTotal, range) => `${range[0]}–${range[1]} / 共 ${pageTotal} 条`}
        total={total}
      />
    </nav>
  );
}
