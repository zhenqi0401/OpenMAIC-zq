import { describe, expect, test } from 'vitest';

import {
  createHostApiCredential,
  hashHostApiSecret,
  verifyHostApiSecret,
  canUseHostApiKey,
} from '@/lib/security/host-api-key';

describe('host API key security', () => {
  test('generates a key id and one-time secret, then verifies only the matching secret', () => {
    const credential = createHostApiCredential('host');
    const storedSecretHash = hashHostApiSecret(credential.secret);

    expect(credential.keyId).toMatch(/^host_/);
    expect(credential.secret).toMatch(/^sk_/);
    expect(storedSecretHash).not.toContain(credential.secret);
    expect(verifyHostApiSecret(credential.secret, storedSecretHash)).toBe(true);
    expect(verifyHostApiSecret('sk_wrong', storedSecretHash)).toBe(false);
  });

  test('blocks disabled host API key records', () => {
    expect(canUseHostApiKey({ enabled: true })).toBe(true);
    expect(canUseHostApiKey({ enabled: false })).toBe(false);
  });
});
