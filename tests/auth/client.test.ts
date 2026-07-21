import { describe, expect, test } from 'vitest';

import {
  mapAuthApiError,
  normalizeInviteCodeInput,
  normalizePhoneInput,
  validateLoginValues,
  validateRegisterValues,
} from '@/lib/auth/client';

describe('auth client validation', () => {
  test('normalizes numeric phone input and uppercase invite codes', () => {
    expect(normalizePhoneInput('138 00a13-8000')).toBe('13800138000');
    expect(normalizeInviteCodeInput(' learn - 2026 ')).toBe('LEARN-2026');
  });

  test('validates login fields with production mobile rules', () => {
    expect(validateLoginValues({ phone: '', password: '' })).toEqual({
      phone: '请输入手机号',
      password: '请输入密码',
    });
    expect(validateLoginValues({ phone: '12800128000', password: '12345' })).toEqual({
      phone: '请输入有效的 11 位手机号',
      password: '密码至少需要 6 位字符',
    });
    expect(validateLoginValues({ phone: '13800138000', password: '123456' })).toEqual({});
  });

  test('validates registration name and invite-code boundaries', () => {
    expect(
      validateRegisterValues({
        name: '张',
        phone: '13800138000',
        password: '123456',
        inviteCode: 'ABC',
      }),
    ).toEqual({
      name: '姓名至少需要 2 个字符',
      inviteCode: '请检查邀请码是否完整',
    });

    expect(
      validateRegisterValues({
        name: '张三',
        phone: '13800138000',
        password: '123456',
        inviteCode: 'A'.repeat(17),
      }),
    ).toEqual({ inviteCode: '邀请码不能超过 16 个字符' });
  });

  test('maps structured API failures to actionable fields', () => {
    expect(mapAuthApiError('login', { error: 'INVALID_CREDENTIALS' })).toEqual({
      field: 'password',
      message: '手机号或密码不正确',
    });
    expect(mapAuthApiError('register', { error: 'PHONE_ALREADY_REGISTERED' })).toEqual({
      field: 'phone',
      message: '该手机号已注册，请直接登录',
    });
    expect(mapAuthApiError('register', { error: 'INVITE_CODE_EXPIRED' })).toEqual({
      field: 'inviteCode',
      message: '邀请码已过期，请联系企业管理员',
    });
  });
});
