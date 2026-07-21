import type { CSSProperties } from 'react';
import { toast, type ExternalToast } from 'sonner';

export const adminSuccessToastStyle: CSSProperties = {
  background: '#eef5ec',
  borderColor: '#9db297',
  color: '#35523a',
};

export const adminErrorToastStyle: CSSProperties = {
  background: '#f9ece8',
  borderColor: '#d7a397',
  color: '#7b3e32',
};

export const adminInfoToastStyle: CSSProperties = {
  background: '#edf3f8',
  borderColor: '#9eb2c2',
  color: '#35546a',
};

export const adminWarningToastStyle: CSSProperties = {
  background: '#fbf3df',
  borderColor: '#d8bb72',
  color: '#72551f',
};

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
