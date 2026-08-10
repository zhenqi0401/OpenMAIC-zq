import type { CSSProperties } from 'react';
import { toast, type ExternalToast } from 'sonner';
import { adminBrandTokens } from '@/components/admin/admin-theme';

/**
 * Toast styles are derived from the admin brand tokens (the single source of
 * truth) so they can never drift from the console's semantic palette. We emit
 * `color-mix()` strings rather than `var(--admin-*)` because toasts may render
 * outside the scoped admin theme subtree where those variables don't resolve.
 */
function tinted(
  color: string,
  textColor: string = color,
  { bgAlpha = 0.08, borderAlpha = 0.3 }: { bgAlpha?: number; borderAlpha?: number } = {},
): CSSProperties {
  return {
    background: `color-mix(in srgb, ${color} ${bgAlpha * 100}%, #fff)`,
    borderColor: `color-mix(in srgb, ${color} ${borderAlpha * 100}%, #fff)`,
    color: textColor,
  };
}

export const adminSuccessToastStyle: CSSProperties = tinted(adminBrandTokens['--saas-success']);
export const adminErrorToastStyle: CSSProperties = tinted(
  adminBrandTokens['--saas-danger'],
  adminBrandTokens['--saas-danger-strong'],
);
export const adminInfoToastStyle: CSSProperties = tinted(
  adminBrandTokens['--saas-primary'],
  adminBrandTokens['--saas-primary'],
  { bgAlpha: 0.06 },
);
export const adminWarningToastStyle: CSSProperties = tinted(adminBrandTokens['--saas-warning']);

function withAdminStyle(options: ExternalToast | undefined, style: CSSProperties): ExternalToast {
  return {
    ...options,
    style: { ...style, ...options?.style },
  };
}

export const adminToast = {
  success(message: string, options?: ExternalToast) {
    return toast.success(message, withAdminStyle(options, adminSuccessToastStyle));
  },
  error(message: string, options?: ExternalToast) {
    return toast.error(message, withAdminStyle(options, adminErrorToastStyle));
  },
  info(message: string, options?: ExternalToast) {
    return toast.info(message, withAdminStyle(options, adminInfoToastStyle));
  },
  warning(message: string, options?: ExternalToast) {
    return toast.warning(message, withAdminStyle(options, adminWarningToastStyle));
  },
};

export function adminErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
