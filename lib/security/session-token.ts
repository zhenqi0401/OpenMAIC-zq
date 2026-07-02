import { createHmac, timingSafeEqual } from 'crypto';
import type { SessionIdentity } from '@/lib/auth/types';

const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

interface SessionPayload {
  identity: SessionIdentity;
  exp: number;
}

interface CreateSessionTokenOptions {
  expiresInSeconds?: number;
}

export type SessionTokenVerification =
  | { valid: true; identity: SessionIdentity; expiresAt: number }
  | { valid: false; reason: 'malformed' | 'bad-signature' | 'expired' };

function encodeBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function decodeBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(data: string, secret: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

function signaturesMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function createSessionToken(
  identity: SessionIdentity,
  secret: string,
  options: CreateSessionTokenOptions = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  const expiresInSeconds = options.expiresInSeconds ?? DEFAULT_EXPIRES_IN_SECONDS;
  const payload = encodeBase64Url(JSON.stringify({ identity, exp: now + expiresInSeconds }));
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string, secret: string): SessionTokenVerification {
  const [payloadPart, signature, extra] = token.split('.');
  if (!payloadPart || !signature || extra !== undefined) {
    return { valid: false, reason: 'malformed' };
  }

  if (!signaturesMatch(signature, sign(payloadPart, secret))) {
    return { valid: false, reason: 'bad-signature' };
  }

  let payload: SessionPayload;
  try {
    payload = JSON.parse(decodeBase64Url(payloadPart)) as SessionPayload;
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, identity: payload.identity, expiresAt: payload.exp };
}
