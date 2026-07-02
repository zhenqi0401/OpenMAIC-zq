import { canUseHostApiKey, verifyHostApiSecret } from '@/lib/security/host-api-key';

export interface StoredHostApiKey {
  keyId: string;
  secretHash: string;
  enabled: boolean;
}

export type HostApiAccessResult =
  | { ok: true; keyId: string }
  | {
      ok: false;
      reason:
        | 'missing-token'
        | 'malformed-token'
        | 'key-mismatch'
        | 'invalid-secret'
        | 'disabled'
        | 'forbidden-route';
    };

export interface HostApiAccessInput {
  pathname: string;
  token: string | null | undefined;
  key: StoredHostApiKey | null | undefined;
}

export interface HostApiTokenHeaders {
  authorization?: string;
  xOpenmaicKey?: string;
}

export function extractBearerToken(headers: HostApiTokenHeaders): string | null {
  if (headers.authorization?.startsWith('Bearer ')) {
    return headers.authorization.slice('Bearer '.length);
  }
  return headers.xOpenmaicKey ?? null;
}

export function assertHostApiAccess(input: HostApiAccessInput): HostApiAccessResult {
  if (!input.pathname.startsWith('/api/host/')) {
    return { ok: false, reason: 'forbidden-route' };
  }
  if (!input.token) {
    return { ok: false, reason: 'missing-token' };
  }

  const separatorIndex = input.token.indexOf('.');
  if (separatorIndex <= 0 || separatorIndex === input.token.length - 1) {
    return { ok: false, reason: 'malformed-token' };
  }

  const keyId = input.token.slice(0, separatorIndex);
  const secret = input.token.slice(separatorIndex + 1);
  if (!input.key || input.key.keyId !== keyId) {
    return { ok: false, reason: 'key-mismatch' };
  }
  if (!canUseHostApiKey(input.key)) {
    return { ok: false, reason: 'disabled' };
  }
  if (!verifyHostApiSecret(secret, input.key.secretHash)) {
    return { ok: false, reason: 'invalid-secret' };
  }

  return { ok: true, keyId };
}
