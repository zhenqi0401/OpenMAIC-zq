import pino, { type Logger } from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, getSessionSecret } from '@/lib/auth/session-cookie';
import { resolveSessionIdentity } from '@/lib/auth/session-guard';

export const REQUEST_ID_HEADER = 'x-request-id';
const requestIdPattern = /^[A-Za-z0-9._~-]{1,128}$/;

export interface RequestLogContext {
  requestId: string;
  method: string;
  path: string;
  userId?: string;
  tenantId?: string;
  roleCode?: string;
  authSource?: string;
}

const storage = new AsyncLocalStorage<{ context: RequestLogContext; logger: Logger }>();

function normalizeRequestId(value: string | null | undefined): string {
  return value && requestIdPattern.test(value) ? value : randomUUID();
}

function redactValue(value: unknown, seen = new WeakSet<object>(), key = ''): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack } : {}),
      ...(value.cause !== undefined ? { cause: redactValue(value.cause, seen, 'cause') } : {}),
    };
  }
  if (typeof value === 'string' && value.length > 512) return `${value.slice(0, 512)}…[truncated]`;
  if (typeof value === 'string' && /phone/i.test(key)) return value.replace(/^(\d{3})\d+(\d{2})$/, '$1****$2');
  if (typeof value === 'string' && /email/i.test(key)) {
    const [name, domain] = value.split('@');
    return domain ? `${name.slice(0, 2)}***@${domain}` : value;
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (/password|token|accessToken|refreshToken|apiKey|secret|cookie|authorization|set-cookie/i.test(key)) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = redactValue(child, seen, key);
    }
  }
  return result;
}

export function createServerLogger(bindings: Record<string, unknown> = {}): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: ['password', 'token', 'accessToken', 'refreshToken', 'apiKey', 'secret', 'cookie', 'authorization', 'set-cookie'], censor: '[REDACTED]' },
    serializers: { err: pino.stdSerializers.err },
    hooks: {
      logMethod(args, method) {
        method.apply(this, args.map((arg) => redactValue(arg)) as Parameters<typeof method>);
      },
    },
  }).child(redactValue(bindings) as Record<string, unknown>);
}

export const serverLogger = createServerLogger();

export function requestContextFromRequest(request: NextRequest): RequestLogContext {
  const context: RequestLogContext = {
    requestId: normalizeRequestId(request.headers.get(REQUEST_ID_HEADER)),
    method: request.method,
    path: new URL(request.url).pathname,
  };
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const identity = resolveSessionIdentity(token, getSessionSecret());
    if (identity) Object.assign(context, {
      userId: identity.userId,
      tenantId: identity.tenantId,
      roleCode: identity.roleCode,
      authSource: identity.authSource,
    });
  } catch {
    // Missing SESSION_SECRET or malformed cookies must never break an API request.
  }
  return context;
}

export function getRequestLogger(): Logger {
  return storage.getStore()?.logger ?? serverLogger;
}

export function runWithRequestContext<T>(context: RequestLogContext, fn: () => T): T {
  return storage.run({ context, logger: serverLogger.child(redactValue(context) as Record<string, unknown>) }, fn);
}

export function isValidRequestId(value: string | null | undefined): boolean {
  return !!value && requestIdPattern.test(value);
}
