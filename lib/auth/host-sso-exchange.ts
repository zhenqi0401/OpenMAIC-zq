import { createHash, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { eq, lte } from 'drizzle-orm';
import { hostSsoLoginExchanges } from '@/lib/storage/schema';
import { runDbTransaction } from '@/lib/storage/db';
import type { SystemCourseCategoryKey } from '@/lib/courses/system-categories';

const EXCHANGE_TTL_MS = 120_000;

function isPrivateHttpHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (normalized === 'localhost' || normalized === 'localhost.') return true;

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    const octets = normalized.split('.').map(Number);
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 169 && octets[1] === 254) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  }
  if (ipVersion === 6) {
    if (normalized === '::1') return true;
    const firstHextet = Number.parseInt(normalized.split(':', 1)[0], 16);
    return (
      (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) ||
      (firstHextet >= 0xfe80 && firstHextet <= 0xfebf)
    );
  }
  return false;
}

export class HostSsoExchangeReplayError extends Error {
  constructor() {
    super('HOST_SSO_EXCHANGE_REPLAY');
    this.name = 'HostSsoExchangeReplayError';
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === '23505';
}

export async function issueHostSsoLoginCode(input: {
  requestId: string;
  userId: string;
  tenantId: string;
  categoryKey: SystemCourseCategoryKey;
  now?: Date;
}): Promise<{ code: string; expiresAt: Date }> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + EXCHANGE_TTL_MS);
  const code = randomBytes(32).toString('base64url');
  try {
    await runDbTransaction(async (tx) => {
      await tx.delete(hostSsoLoginExchanges).where(lte(hostSsoLoginExchanges.expiresAt, now));
      await tx.insert(hostSsoLoginExchanges).values({
        codeHash: sha256(code),
        requestIdHash: sha256(input.requestId.toLowerCase()),
        userId: input.userId,
        tenantId: input.tenantId,
        categoryKey: input.categoryKey,
        expiresAt,
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new HostSsoExchangeReplayError();
    throw error;
  }
  return { code, expiresAt };
}

export async function redeemHostSsoLoginCode(
  code: string,
  now = new Date(),
): Promise<{
  userId: string;
  tenantId: string;
  categoryKey: SystemCourseCategoryKey;
} | null> {
  const codeHash = sha256(code);
  return runDbTransaction(async (tx) => {
    const [record] = await tx
      .select({
        id: hostSsoLoginExchanges.id,
        userId: hostSsoLoginExchanges.userId,
        tenantId: hostSsoLoginExchanges.tenantId,
        categoryKey: hostSsoLoginExchanges.categoryKey,
        expiresAt: hostSsoLoginExchanges.expiresAt,
        usedAt: hostSsoLoginExchanges.usedAt,
      })
      .from(hostSsoLoginExchanges)
      .where(eq(hostSsoLoginExchanges.codeHash, codeHash))
      .for('update')
      .limit(1);
    if (!record || record.usedAt || record.expiresAt.getTime() <= now.getTime()) {
      await tx.delete(hostSsoLoginExchanges).where(lte(hostSsoLoginExchanges.expiresAt, now));
      return null;
    }
    await tx
      .update(hostSsoLoginExchanges)
      .set({ usedAt: now })
      .where(eq(hostSsoLoginExchanges.id, record.id));
    await tx.delete(hostSsoLoginExchanges).where(lte(hostSsoLoginExchanges.expiresAt, now));
    return {
      userId: record.userId,
      tenantId: record.tenantId,
      categoryKey: record.categoryKey as SystemCourseCategoryKey,
    };
  });
}

export function getConfiguredOpenMaicPublicUrl(): URL {
  const configured = process.env.YUANWO_PUBLIC_URL;
  if (!configured) throw new Error('YUANWO_PUBLIC_URL is required');
  const url = new URL(configured);
  const explicitlyAllowsPrivateHttp = process.env.YUANWO_ALLOW_INSECURE_HTTP === 'true';
  const allowsHttp =
    process.env.NODE_ENV !== 'production' ||
    (explicitlyAllowsPrivateHttp && isPrivateHttpHostname(url.hostname));
  const validProtocol = url.protocol === 'https:' || (url.protocol === 'http:' && allowsHttp);
  if (
    !validProtocol ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error(
      'YUANWO_PUBLIC_URL must be an HTTPS origin, or an explicitly allowed private HTTP origin, without a path',
    );
  }
  return url;
}
