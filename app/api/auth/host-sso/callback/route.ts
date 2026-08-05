import { NextResponse } from 'next/server';
import { getAuthRepository } from '@/lib/auth/repository';
import { createAuthService } from '@/lib/auth/service';
import { redeemHostSsoLoginCode } from '@/lib/auth/host-sso-exchange';
import {
  createSessionCookieValue,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '@/lib/auth/session-cookie';

export const dynamic = 'force-dynamic';

const INVALID_LINK_MESSAGE = '登录链接无效或已过期，请从宿主系统重新进入';
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function invalidLinkResponse(): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录链接无效</title></head><body><main style="max-width:36rem;margin:15vh auto;padding:2rem;font-family:system-ui;text-align:center"><h1 style="font-size:1.25rem">${INVALID_LINK_MESSAGE}</h1></main></body></html>`,
    {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    },
  );
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code');
  if (!code || !CODE_PATTERN.test(code)) return invalidLinkResponse();
  try {
    const exchange = await redeemHostSsoLoginCode(code);
    if (!exchange) return invalidLinkResponse();
    const result = await createAuthService(getAuthRepository()).getSessionUser(exchange.userId);
    if (result.identity.tenantId !== exchange.tenantId) return invalidLinkResponse();
    const identity = { ...result.identity, authSource: 'host-sso' as const };
    const response = new NextResponse(null, {
      status: 303,
      headers: { location: `/learn?category=${encodeURIComponent(exchange.categoryKey)}` },
    });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      createSessionCookieValue(identity),
      sessionCookieOptions(),
    );
    response.headers.set('cache-control', 'no-store');
    return response;
  } catch {
    return invalidLinkResponse();
  }
}
