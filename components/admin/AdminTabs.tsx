'use client';

import { Tabs as AntTabs } from 'antd';
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
 * Admin-only wrapper around Ant Design Tabs. Keeping this small adapter means
 * existing modules retain their stable value/count contract while keyboard
 * navigation, focus management and responsive overflow come from the library.
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
    <div
      className={cn(
        'min-w-0',
        showDivider && 'border-b border-[var(--admin-border-subtle)]',
        !showDivider && 'shadow-[inset_0_-2px_0_var(--admin-selection-indicator)]',
        className,
      )}
      data-admin-tabs
      aria-label={ariaLabel}
    >
      <AntTabs
        activeKey={value}
        items={items.map((item) => ({
          key: item.value,
          disabled: item.disabled,
          label: (
            <span
              aria-label={item.count === undefined ? item.label : `${item.label}，${item.count} 条`}
            >
              {item.label}
              {item.count === undefined ? null : (
                <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full border border-current/25 px-1.5 text-xs tabular-nums">
                  {item.count}
                </span>
              )}
            </span>
          ),
          children: null,
        }))}
        onChange={(nextValue) => onValueChange(nextValue as T)}
        tabBarStyle={showDivider ? { borderBottomColor: 'var(--admin-border-subtle)' } : undefined}
      />
    </div>
  );
}
