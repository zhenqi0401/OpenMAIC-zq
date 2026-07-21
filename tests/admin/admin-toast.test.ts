import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: toastMocks }));

import {
  adminErrorMessage,
  adminErrorToastStyle,
  adminInfoToastStyle,
  adminSuccessToastStyle,
  adminToast,
  adminWarningToastStyle,
} from '@/lib/admin/toast';

describe('adminToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the green admin treatment for successful operations', () => {
    adminToast.success('考核列表已刷新');

    expect(toastMocks.success).toHaveBeenCalledWith('考核列表已刷新', {
      style: adminSuccessToastStyle,
    });
    expect(adminSuccessToastStyle).toMatchObject({
      background: '#eef5ec',
      borderColor: '#9db297',
      color: '#35523a',
    });
  });

  it('uses red for failures and preserves per-toast option overrides', () => {
    adminToast.error('保存失败', { duration: 6000, style: { color: '#600' } });

    expect(toastMocks.error).toHaveBeenCalledWith('保存失败', {
      duration: 6000,
      style: { ...adminErrorToastStyle, color: '#600' },
    });
    expect(adminErrorToastStyle.background).toBe('#f9ece8');
  });

  it('defines distinct information and warning state colors', () => {
    adminToast.info('正在同步');
    adminToast.warning('部分内容未发布');

    expect(toastMocks.info).toHaveBeenCalledWith('正在同步', { style: adminInfoToastStyle });
    expect(toastMocks.warning).toHaveBeenCalledWith('部分内容未发布', {
      style: adminWarningToastStyle,
    });
  });

  it('prefers an Error message and otherwise uses the fallback', () => {
    expect(adminErrorMessage(new Error('接口不可用'), '操作失败')).toBe('接口不可用');
    expect(adminErrorMessage(null, '操作失败')).toBe('操作失败');
  });
});
