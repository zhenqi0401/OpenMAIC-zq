import type { NextRequest } from 'next/server';
import { apiError } from './api-response';
import { REQUEST_ID_HEADER, requestContextFromRequest, runWithRequestContext, getRequestLogger } from './logger';

type RouteHandler = (request: NextRequest, context?: unknown) => Response | Promise<Response>;

export function withApiErrorLogging(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    const requestContext = requestContextFromRequest(request);
    const started = Date.now();
    return runWithRequestContext(requestContext, async () => {
      try {
        const response = await handler(request, context);
        response.headers.set(REQUEST_ID_HEADER, requestContext.requestId);
        if (response.status >= 500) {
          getRequestLogger().error({ event: 'api_request_failed', tag: 'api', status: response.status, durationMs: Date.now() - started }, 'API request failed');
        } else if (response.status === 401 || response.status === 403 || response.status === 409 || response.status === 429) {
          getRequestLogger().warn({ event: 'api_request_rejected', tag: 'api', status: response.status, durationMs: Date.now() - started }, 'API request rejected');
        }
        return response;
      } catch (error) {
        getRequestLogger().error({ event: 'api_request_failed', tag: 'api', status: 500, durationMs: Date.now() - started, err: error }, 'Unhandled API request error');
        const response = apiError('INTERNAL_ERROR', 500, '请求失败', undefined, requestContext.requestId);
        response.headers.set(REQUEST_ID_HEADER, requestContext.requestId);
        return response;
      }
    });
  };
}

export function withRequestId<T extends RouteHandler>(handler: T): T {
  return withApiErrorLogging(handler) as T;
}
