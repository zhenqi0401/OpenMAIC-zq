import { describe, expect, test } from 'vitest';

import { hashPassword, verifyPassword } from '@/lib/security/password';

describe('enterprise password hashing', () => {
  test('hashes and verifies a password without storing the plaintext', async () => {
    const hashed = await hashPassword('correct horse battery staple');

    expect(hashed).toMatch(/^scrypt\$/);
    expect(hashed).not.toContain('correct horse battery staple');
    await expect(verifyPassword('correct horse battery staple', hashed)).resolves.toBe(true);
    await expect(verifyPassword('wrong password', hashed)).resolves.toBe(false);
  });
});
