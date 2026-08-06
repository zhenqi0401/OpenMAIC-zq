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
  const originalPublicUrl = process.env.YUANWO_PUBLIC_URL;
  const originalAllowInsecureHttp = process.env.YUANWO_ALLOW_INSECURE_HTTP;
  const originalHostSecret = process.env.HOST_SSO_SECRET;
  const originalNodeEnv = process.env.NODE_ENV;

  function restoreEnv(name: string, value: string | undefined) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  afterEach(() => {
    restoreEnv('YUANWO_PUBLIC_URL', originalPublicUrl);
    restoreEnv('YUANWO_ALLOW_INSECURE_HTTP', originalAllowInsecureHttp);
    restoreEnv('HOST_SSO_SECRET', originalHostSecret);
    restoreEnv('NODE_ENV', originalNodeEnv);
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
    process.env.YUANWO_PUBLIC_URL = 'https://yuanwo.example.com';
    expect(getConfiguredOpenMaicPublicUrl().origin).toBe('https://yuanwo.example.com');
    process.env.YUANWO_PUBLIC_URL = 'https://yuanwo.example.com/unsafe/path';
    expect(() => getConfiguredOpenMaicPublicUrl()).toThrow(/HTTPS origin/);
  });

  test('allows private HTTP in production only with an explicit opt-in', () => {
    process.env.NODE_ENV = 'production';
    process.env.YUANWO_PUBLIC_URL = 'http://192.168.1.78:3000';
    delete process.env.YUANWO_ALLOW_INSECURE_HTTP;
    expect(() => getConfiguredOpenMaicPublicUrl()).toThrow(/private HTTP origin/);

    process.env.YUANWO_ALLOW_INSECURE_HTTP = 'true';
    expect(getConfiguredOpenMaicPublicUrl().origin).toBe('http://192.168.1.78:3000');
  });

  test.each([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.0.0.8:3000',
    'http://172.16.0.8:3000',
    'http://172.31.255.254:3000',
    'http://192.168.1.78:3000',
    'http://[::1]:3000',
    'http://[fc00::1]:3000',
    'http://[fe80::1]:3000',
  ])('allows explicitly opted-in private HTTP origin %s', (publicUrl) => {
    process.env.NODE_ENV = 'production';
    process.env.YUANWO_ALLOW_INSECURE_HTTP = 'true';
    process.env.YUANWO_PUBLIC_URL = publicUrl;
    expect(getConfiguredOpenMaicPublicUrl().origin).toBe(new URL(publicUrl).origin);
  });

  test.each([
    'http://example.com',
    'http://8.8.8.8:3000',
    'http://172.15.255.255:3000',
    'http://172.32.0.1:3000',
    'http://192.169.0.1:3000',
    'http://[2001:4860:4860::8888]:3000',
  ])('rejects public HTTP origin %s even with the production opt-in', (publicUrl) => {
    process.env.NODE_ENV = 'production';
    process.env.YUANWO_ALLOW_INSECURE_HTTP = 'true';
    process.env.YUANWO_PUBLIC_URL = publicUrl;
    expect(() => getConfiguredOpenMaicPublicUrl()).toThrow(/private HTTP origin/);
  });

  test('still rejects paths and credentials on an opted-in private HTTP URL', () => {
    process.env.NODE_ENV = 'production';
    process.env.YUANWO_ALLOW_INSECURE_HTTP = 'true';

    process.env.YUANWO_PUBLIC_URL = 'http://192.168.1.78:3000/callback';
    expect(() => getConfiguredOpenMaicPublicUrl()).toThrow(/without a path/);

    process.env.YUANWO_PUBLIC_URL = 'http://user@192.168.1.78:3000';
    expect(() => getConfiguredOpenMaicPublicUrl()).toThrow(/without a path/);
  });

  test('rejects invalid fields before provisioning and does not trust the Host header', async () => {
    process.env.HOST_SSO_SECRET = 'host-secret';
    process.env.YUANWO_PUBLIC_URL = 'https://yuanwo.example.com/unsafe/path';
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
      error: 'YUANWO_PUBLIC_URL is invalid',
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
