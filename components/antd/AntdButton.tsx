'use client';

import * as React from 'react';
import { Button as AntButton } from 'antd';
import { Slot } from 'radix-ui';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type LegacyVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
type LegacySize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';

/**
 * Narrow compatibility bridge for migrated surfaces. It keeps the old call
 * sites stable while the rendered control is an Ant Design Button. `asChild`
 * remains a link-composition escape hatch so existing Next Link semantics are
 * not changed during the visual migration.
 */
export function Button({
  asChild = false,
  className,
  variant = 'default',
  size = 'default',
  type: htmlType = 'button',
  color: _color, // 原生 button 的 color 属性与 antd Button 的 color 联合类型冲突，剔除
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean;
  variant?: LegacyVariant;
  size?: LegacySize;
}) {
  if (asChild) {
    return (
      <Slot.Root
        className={cn(buttonVariants({ variant, size, className }))}
        data-size={size}
        data-slot="button"
        data-variant={variant}
        {...props}
      />
    );
  }

  const visualType =
    variant === 'link'
      ? 'link'
      : variant === 'ghost'
        ? 'text'
        : variant === 'outline' || variant === 'secondary'
          ? 'default'
          : 'primary';
  const antSize =
    size === 'xs' || size === 'sm' || size === 'icon-xs' || size === 'icon-sm'
      ? 'small'
      : size === 'lg' || size === 'icon-lg'
        ? 'large'
        : 'middle';

  return (
    <AntButton
      className={cn(buttonVariants({ variant, size, className }))}
      danger={variant === 'destructive'}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      htmlType={htmlType}
      shape={size.startsWith('icon') ? 'circle' : undefined}
      size={antSize}
      type={visualType}
      {...props}
    />
  );
}
