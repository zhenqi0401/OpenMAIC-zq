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
}

/**
 * Admin-only wrapper around Ant Design Tabs. Only the Ant ink bar is drawn —
 * no extra full-width divider or inset shadow, so the double-blue-line
 * artifact cannot occur. Keyboard navigation, focus management and responsive
 * overflow come from the library.
 */
export function AdminTabs<T extends string>({
  items,
  value,
  onValueChange,
  ariaLabel,
  className,
}: AdminTabsProps<T>) {
  return (
    <div className={cn('min-w-0', className)} data-admin-tabs aria-label={ariaLabel}>
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
      />
    </div>
  );
}
