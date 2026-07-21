'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export interface AdminTabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
  disabled?: boolean;
}

export interface AdminTabsProps<T extends string> {
  items: readonly AdminTabItem<T>[];
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Admin-only wrapper around Radix Tabs. Radix owns roving focus and Arrow
 * Left/Right keyboard navigation; this wrapper owns the shared workbench look.
 */
export function AdminTabs<T extends string>({
  items,
  value,
  onValueChange,
  ariaLabel,
  className,
}: AdminTabsProps<T>) {
  return (
    <Tabs
      activationMode="automatic"
      className={cn('min-w-0', className)}
      data-admin-tabs
      onValueChange={(nextValue) => onValueChange(nextValue as T)}
      value={value}
    >
      <TabsList
        aria-label={ariaLabel}
        className="h-auto max-w-full flex-wrap justify-start gap-2 rounded-none bg-transparent p-0"
        variant="line"
      >
        {items.map((item) => (
          <TabsTrigger
            aria-label={item.count === undefined ? item.label : `${item.label}，${item.count} 条`}
            className="h-9 flex-none rounded-[4px] border-[#d8c8b9] bg-[#fffaf2] px-3 text-[#75665d] shadow-none hover:border-[#c96f54]/70 hover:bg-[#f1e2d0]/60 hover:text-[#2b211d] data-[state=active]:!border-[#c96f54] data-[state=active]:!bg-[#f1e2d0] data-[state=active]:!text-[#2b211d] data-[state=active]:shadow-[inset_0_-2px_0_#c96f54] data-active:after:opacity-0 data-[state=active]:after:opacity-0"
            disabled={item.disabled}
            key={item.value}
            value={item.value}
          >
            <span>{item.label}</span>
            {item.count === undefined ? null : (
              <span
                aria-hidden="true"
                className="inline-flex min-w-5 items-center justify-center rounded-full border border-current/25 px-1.5 text-xs tabular-nums"
              >
                {item.count}
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
