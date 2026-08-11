'use client';

import { CheckCircle2, Info } from 'lucide-react';
import { Button, Statistic, Tooltip } from 'antd';
import { AdminCard } from '@/components/admin/AdminSurface';

export interface DashboardMetricProps {
  label: string;
  value: string;
  progress: number | null;
  note: string;
  tooltip?: string;
}

export function DashboardMetric({ label, value, progress, note, tooltip }: DashboardMetricProps) {
  const width = progress === null ? null : `${Math.max(0, Math.min(progress, 1)) * 100}%`;

  return (
    <AdminCard className="grid gap-3 p-4">
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--admin-muted-foreground)]">
        <span className="flex items-center gap-1.5">
          {label}
          {tooltip ? (
            <Tooltip title={tooltip}>
              <Button
                aria-label={`${label}指标口径`}
                className="!h-auto !rounded-full !p-0 !text-[var(--admin-link)]"
                type="text"
                htmlType="button"
              >
                <Info aria-hidden="true" className="size-3.5" />
              </Button>
            </Tooltip>
          ) : null}
        </span>
        <CheckCircle2 aria-hidden="true" className="size-4 text-[var(--admin-success)]" />
      </div>
      <Statistic value={value} valueStyle={{ color: 'var(--admin-foreground)', fontSize: 28 }} />
      {width === null ? null : (
        <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-border-subtle)]">
          <span
            className="block h-full rounded-full bg-[var(--admin-interactive-accent)]"
            style={{ width }}
          />
        </div>
      )}
      <p className="text-sm text-[var(--admin-muted-foreground)]">{note}</p>
    </AdminCard>
  );
}
