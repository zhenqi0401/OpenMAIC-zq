import { describe, expect, test } from 'vitest';

import { logoutCurrentSession } from '@/lib/auth/logout-client';

describe('logoutCurrentSession', () => {
  test('posts to the logout endpoint', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return Response.json({ success: true, authenticated: false });
    };

    await logoutCurrentSession(fetcher);

    expect(calls).toEqual([
      {
        url: '/api/auth/logout',
        init: { method: 'POST' },
      },
    ]);
  });

  test('throws when logout fails', async () => {
    const fetcher = async () =>
      Response.json({ success: false, error: 'Cannot logout' }, { status: 500 });

    await expect(logoutCurrentSession(fetcher)).rejects.toThrow('Cannot logout');
  });
});
