'use client';

import { CheckCircle2, Info } from 'lucide-react';
import { AdminCard } from '@/components/admin/AdminSurface';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
      <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#75665d]">
        <span className="flex items-center gap-1.5">
          {label}
          {tooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  aria-label={`${label}指标口径`}
                  className="rounded-full text-[#9b5b47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c96f54]/30"
                  type="button"
                >
                  <Info aria-hidden="true" className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          ) : null}
        </span>
        <CheckCircle2 aria-hidden="true" className="size-4 text-[#6f8068]" />
      </div>
      <div className="text-[32px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-[#2b211d]">
        {value}
      </div>
      {width === null ? null : (
        <div className="h-2 overflow-hidden rounded-full bg-[#eaded1]">
          <span className="block h-full rounded-full bg-[#c96f54]" style={{ width }} />
        </div>
      )}
      <p className="text-sm text-[#75665d]">{note}</p>
    </AdminCard>
  );
}
