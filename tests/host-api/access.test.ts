import { describe, expect, test } from 'vitest';

import {
  assertHostApiAccess,
  extractBearerToken,
  type StoredHostApiKey,
} from '@/lib/host-api/access';
import { hashHostApiSecret } from '@/lib/security/host-api-key';

const storedKey: StoredHostApiKey = {
  keyId: 'host_demo',
  secretHash: hashHostApiSecret('sk_demo'),
  enabled: true,
};

describe('host API access guard', () => {
  test('accepts a matching bearer token only for /api/host routes', () => {
    expect(
      assertHostApiAccess({
        pathname: '/api/host/summary',
        token: 'host_demo.sk_demo',
        key: storedKey,
      }),
    ).toEqual({ ok: true, keyId: 'host_demo' });

    expect(
      assertHostApiAccess({
        pathname: '/api/admin/dashboard',
        token: 'host_demo.sk_demo',
        key: storedKey,
      }),
    ).toEqual({ ok: false, reason: 'forbidden-route' });
  });

  test('rejects disabled or mismatched host API keys', () => {
    expect(
      assertHostApiAccess({
        pathname: '/api/host/summary',
        token: 'host_demo.wrong',
        key: storedKey,
      }),
    ).toEqual({ ok: false, reason: 'invalid-secret' });

    expect(
      assertHostApiAccess({
        pathname: '/api/host/summary',
        token: 'host_demo.sk_demo',
        key: { ...storedKey, enabled: false },
      }),
    ).toEqual({ ok: false, reason: 'disabled' });
  });

  test('extracts bearer and X-OpenMAIC-Key tokens', () => {
    expect(extractBearerToken({ authorization: 'Bearer host_demo.sk_demo' })).toBe(
      'host_demo.sk_demo',
    );
    expect(extractBearerToken({ xOpenmaicKey: 'host_demo.sk_demo' })).toBe('host_demo.sk_demo');
    expect(extractBearerToken({ authorization: 'Basic nope' })).toBeNull();
  });
});
