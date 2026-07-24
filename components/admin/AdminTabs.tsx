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
  showDivider?: boolean;
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
  showDivider = true,
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
        className={cn(
          'h-auto max-w-full flex-wrap justify-start gap-5 rounded-none bg-transparent px-1 py-0',
          showDivider && 'border-b border-[var(--admin-border-subtle)]',
        )}
        variant="line"
      >
        {items.map((item) => (
          <TabsTrigger
            aria-label={item.count === undefined ? item.label : `${item.label}，${item.count} 条`}
            className="h-10 flex-none rounded-none border-0 bg-transparent px-1 text-[var(--admin-muted-foreground)] shadow-none hover:bg-transparent hover:text-[var(--admin-foreground)] data-[state=active]:!border-0 data-[state=active]:!bg-transparent data-[state=active]:!text-[var(--admin-link)] data-[state=active]:shadow-[inset_0_-2px_0_var(--admin-selection-indicator)] data-active:after:opacity-0 data-[state=active]:after:opacity-0"
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
