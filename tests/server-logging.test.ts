import { describe, expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { withApiErrorLogging } from '@/lib/server/api-wrapper';
import { requestContextFromRequest, isValidRequestId } from '@/lib/server/logger';

describe('server request logging', () => {
  test('accepts safe request ids and replaces invalid values', () => {
    const valid = new NextRequest('http://localhost/api/test', { headers: { 'x-request-id': 'host-abc_123' } });
    expect(requestContextFromRequest(valid).requestId).toBe('host-abc_123');
    expect(isValidRequestId('a'.repeat(129))).toBe(false);
    const invalid = new NextRequest('http://localhost/api/test', { headers: { 'x-request-id': 'bad value' } });
    expect(requestContextFromRequest(invalid).requestId).not.toBe('bad value');
  });

  test('adds request id to normal and error responses', async () => {
    const handler = withApiErrorLogging(async () => new Response('ok'));
    const response = await handler(new NextRequest('http://localhost/api/test', {
      headers: { 'x-request-id': 'request-42' },
    }));
    expect(response.headers.get('x-request-id')).toBe('request-42');

    const failing = withApiErrorLogging(async () => {
      throw new Error('boom');
    });
    const failed = await failing(new NextRequest('http://localhost/api/test', {
      headers: { 'x-request-id': 'request-43' },
    }));
    expect(failed.status).toBe(500);
    expect(failed.headers.get('x-request-id')).toBe('request-43');
    expect(await failed.json()).toMatchObject({ success: false, errorCode: 'INTERNAL_ERROR', requestId: 'request-43' });
  });
});
