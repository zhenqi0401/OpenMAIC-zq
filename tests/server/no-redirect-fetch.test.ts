import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchWithoutRedirects } from '@/lib/server/no-redirect-fetch';

describe('fetchWithoutRedirects', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('forces manual redirects while preserving request options', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchWithoutRedirects('https://provider.example/models', {
      method: 'POST',
      headers: { Authorization: 'Bearer redacted' },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://provider.example/models', {
      method: 'POST',
      headers: { Authorization: 'Bearer redacted' },
      redirect: 'manual',
    });
  });

  it('rejects a redirect response without requesting its target', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/admin' } }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchWithoutRedirects('https://provider.example/models')).rejects.toThrow(
      'Redirect responses are not allowed',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
