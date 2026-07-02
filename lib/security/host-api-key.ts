import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export interface HostApiCredential {
  keyId: string;
  secret: string;
}

export interface HostApiKeyState {
  enabled: boolean;
}

export function createHostApiCredential(prefix = 'host'): HostApiCredential {
  return {
    keyId: `${prefix}_${randomBytes(8).toString('hex')}`,
    secret: `sk_${randomBytes(32).toString('base64url')}`,
  };
}

export function hashHostApiSecret(secret: string): string {
  return `sha256$${createHash('sha256').update(secret).digest('hex')}`;
}

export function verifyHostApiSecret(secret: string, storedHash: string): boolean {
  const [algorithm, hash] = storedHash.split('$');
  if (algorithm !== 'sha256' || !hash) return false;

  const actual = Buffer.from(hashHostApiSecret(secret).split('$')[1], 'hex');
  const expected = Buffer.from(hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function canUseHostApiKey(record: HostApiKeyState): boolean {
  return record.enabled;
}
