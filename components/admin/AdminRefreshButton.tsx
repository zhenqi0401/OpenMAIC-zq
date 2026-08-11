'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/antd/AntdButton';
import { adminSecondaryButtonClassName } from '@/components/admin/AdminSurface';
import { cn } from '@/lib/utils';

export function AdminRefreshButton({
  loading,
  onRefresh,
}: {
  loading: boolean;
  onRefresh: () => void;
}) {
  return (
    <Button
      aria-busy={loading}
      className={cn(adminSecondaryButtonClassName, 'h-[var(--admin-control-height)] gap-2 px-3')}
      data-admin-refresh-button
      disabled={loading}
      onClick={onRefresh}
      type="button"
      variant="outline"
    >
      <RefreshCw aria-hidden="true" className={cn('size-4', loading && 'animate-spin')} />
      {loading ? '刷新中…' : '刷新'}
    </Button>
  );
}
