import Image from 'next/image';
import type { HTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

import styles from './brand-lockup.module.css';

export type BrandLockupVariant = 'full' | 'compact' | 'mark';
export type BrandLockupTone = 'default' | 'inverse';

export interface BrandLockupProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  variant?: BrandLockupVariant;
  tone?: BrandLockupTone;
  alt?: string;
  ariaLabel?: string;
  priority?: boolean;
}

const IMAGE_SIZES: Record<BrandLockupVariant, string> = {
  full: '46px',
  compact: '32px',
  mark: '30px',
};

export function BrandLockup({
  variant = 'full',
  tone = 'default',
  alt = '元我智脑 Logo',
  ariaLabel = '元我智脑',
  priority = false,
  className,
  ...props
}: BrandLockupProps) {
  return (
    <div
      {...props}
      aria-label={ariaLabel}
      className={cn(styles.root, styles[variant], tone === 'inverse' && styles.inverse, className)}
      data-brand-lockup={variant}
    >
      <Image
        src="/brand/yuanwo-mark.png"
        alt={alt}
        width={variant === 'full' ? 46 : variant === 'compact' ? 32 : 30}
        height={variant === 'full' ? 46 : variant === 'compact' ? 32 : 30}
        priority={priority}
        unoptimized
        sizes={IMAGE_SIZES[variant]}
        className={styles.markImage}
      />
      {variant !== 'mark' ? <span className={styles.wordmark}>元我智脑</span> : null}
    </div>
  );
}
