import { beforeEach, describe, expect, it, vi } from 'vitest';

const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));

import { adminErrorMessage, adminToast, bindAdminMessageApi } from '@/lib/admin/toast';

describe('adminToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bindAdminMessageApi(messageMocks as never);
  });

  it('routes success to the Ant App message instance', () => {
    adminToast.success('考核列表已刷新');
    expect(messageMocks.success).toHaveBeenCalledWith('考核列表已刷新');
  });

  it('routes failures to the Ant App message instance', () => {
    adminToast.error('保存失败');
    expect(messageMocks.error).toHaveBeenCalledWith('保存失败');
  });

  it('routes information and warning states', () => {
    adminToast.info('正在同步');
    adminToast.warning('部分内容未发布');
    expect(messageMocks.info).toHaveBeenCalledWith('正在同步');
    expect(messageMocks.warning).toHaveBeenCalledWith('部分内容未发布');
  });

  it('prefers an Error message and otherwise uses the fallback', () => {
    expect(adminErrorMessage(new Error('接口不可用'), '操作失败')).toBe('接口不可用');
    expect(adminErrorMessage(null, '操作失败')).toBe('操作失败');
  });
});
