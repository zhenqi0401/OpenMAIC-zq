'use client';

import * as React from 'react';
import { Button as AntButton } from 'antd';
import { Slot } from 'radix-ui';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type LegacyVariant = 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'link';
type LegacySize = 'default' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg';

/** 旧的 shadcn 视觉变体到 antd Button `type` 的映射。 */
const VARIANT_TYPE: Record<LegacyVariant, 'primary' | 'default' | 'text' | 'link'> = {
  default: 'primary',
  outline: 'default',
  secondary: 'default',
  ghost: 'text',
  destructive: 'primary',
  link: 'link',
};

function toAntSize(size: LegacySize): 'small' | 'middle' | 'large' {
  if (size === 'xs' || size === 'sm' || size === 'icon-xs' || size === 'icon-sm') return 'small';
  if (size === 'lg' || size === 'icon-lg') return 'large';
  return 'middle';
}

/**
 * 兼容桥接：渲染层是 Ant Design Button，只把旧的 variant/size 调用点映射到
 * antd 语义（type / size / shape / danger）。不再叠加 shadcn 的 buttonVariants
 * 视觉类 —— 之前的叠加会让 antd 按钮出现黑边、尺寸不一致、文字颜色异常。
 * 视觉统一由 ConfigProvider 的 admin 主题 token 负责。
 */
export function Button({
  asChild = false,
  className,
  variant = 'default',
  size = 'default',
  danger = false,
  type: htmlType = 'button',
  color: _color, // 原生 button 的 color 属性与 antd Button 的 color 联合类型冲突，剔除
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean;
  variant?: LegacyVariant;
  size?: LegacySize;
  danger?: boolean;
}) {
  // Link 逃生舱：asChild 场景下 Slot 是原生 <a>，无法套用 antd 的 CSS-in-JS
  // 视觉类，只能沿用 shadcn buttonVariants 维持按钮外观。
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

  return (
    <AntButton
      className={className}
      danger={danger || variant === 'destructive'}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      htmlType={htmlType}
      shape={size.startsWith('icon') ? 'circle' : undefined}
      size={toAntSize(size)}
      type={VARIANT_TYPE[variant]}
      {...props}
    />
  );
}
