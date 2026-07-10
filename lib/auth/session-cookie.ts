import { cookies } from 'next/headers';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import type { SessionIdentity } from './types';
import { createSessionToken } from '@/lib/security/session-token';

export const SESSION_COOKIE_NAME = 'openmaic_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET is required');
  }
  return secret;
}

export function createSessionCookieValue(identity: SessionIdentity): string {
  return createSessionToken(identity, getSessionSecret(), {
    expiresInSeconds: SESSION_MAX_AGE_SECONDS,
  });
}

export function sessionCookieOptions(): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production' && process.env.SESSION_COOKIE_SECURE !== 'false',
  };
}

export async function setSessionCookie(identity: SessionIdentity): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, createSessionCookieValue(identity), sessionCookieOptions());
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function readSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}
