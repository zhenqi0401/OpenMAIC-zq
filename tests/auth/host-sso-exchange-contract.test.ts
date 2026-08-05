import { afterEach, describe, expect, test } from 'vitest';
import { getConfiguredOpenMaicPublicUrl } from '@/lib/auth/host-sso-exchange';
import { verifyHostSsoExchangeSignature } from '@/lib/auth/service';
import type { HostSsoExchangeProfile } from '@/lib/auth/service';

const payload: HostSsoExchangeProfile = {
  hostUserId: 'host-user-10001',
  displayName: '张三',
  phone: '13800138000',
  companyId: 'company-001',
  companyName: '示例企业',
  categoryKey: 'management',
  timestamp: 1_785_823_200,
  requestId: '123e4567-e89b-42d3-a456-426614174000',
};

describe('host SSO exchange contract', () => {
  const originalPublicUrl = process.env.OPENMAIC_PUBLIC_URL;
  const originalHostSecret = process.env.HOST_SSO_SECRET;

  afterEach(() => {
    process.env.OPENMAIC_PUBLIC_URL = originalPublicUrl;
    process.env.HOST_SSO_SECRET = originalHostSecret;
  });

  test('signs the eight exchange fields and rejects tampering', () => {
    const signature = verifyHostSsoExchangeSignature.sign(payload, 'host-secret');
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
    expect(verifyHostSsoExchangeSignature(payload, signature, 'host-secret')).toBe(true);
    expect(
      verifyHostSsoExchangeSignature(
        { ...payload, categoryKey: 'professional' },
        signature,
        'host-secret',
      ),
    ).toBe(false);
    expect(
      verifyHostSsoExchangeSignature(
        { ...payload, requestId: '123e4567-e89b-42d3-a456-426614174001' },
        signature,
        'host-secret',
      ),
    ).toBe(false);
  });

  test('uses only the configured public origin', () => {
    process.env.OPENMAIC_PUBLIC_URL = 'https://yuanwo.example.com';
    expect(getConfiguredOpenMaicPublicUrl().origin).toBe('https://yuanwo.example.com');
    process.env.OPENMAIC_PUBLIC_URL = 'https://yuanwo.example.com/unsafe/path';
    expect(() => getConfiguredOpenMaicPublicUrl()).toThrow(/HTTPS origin/);
  });

  test('rejects invalid fields before provisioning and does not trust the Host header', async () => {
    process.env.HOST_SSO_SECRET = 'host-secret';
    process.env.OPENMAIC_PUBLIC_URL = 'https://yuanwo.example.com/unsafe/path';
    const currentPayload = { ...payload, timestamp: Math.floor(Date.now() / 1000) };
    const signature = verifyHostSsoExchangeSignature.sign(currentPayload, 'host-secret');
    const { POST } = await import('@/app/api/auth/host-sso/exchange/route');
    const response = await POST(
      new Request('https://attacker.example/api/auth/host-sso/exchange', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          host: 'attacker.example',
          'x-openmaic-signature': signature,
        },
        body: JSON.stringify(currentPayload),
      }),
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: 'OPENMAIC_PUBLIC_URL is invalid',
    });
  });

  test('callback failures use one safe message and never set a session cookie', async () => {
    const { GET } = await import('@/app/api/auth/host-sso/callback/route');
    const response = await GET(
      new Request('https://yuanwo.example.com/api/auth/host-sso/callback?code=tampered'),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.text()).toContain('登录链接无效或已过期，请从宿主系统重新进入');
  });
});
