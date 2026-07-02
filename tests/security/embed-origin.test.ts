import { afterEach, describe, expect, test } from 'vitest';

import { isAllowedEmbedOrigin, parseAllowedEmbedOrigins } from '@/lib/security/embed-origin';

describe('embed origin allow-list', () => {
  afterEach(() => {
    delete process.env.ALLOWED_EMBED_ORIGINS;
  });

  test('parses comma and space separated origins from env', () => {
    process.env.ALLOWED_EMBED_ORIGINS =
      'https://admin.example.com, https://host.example.com https://ops.example.com';

    expect(parseAllowedEmbedOrigins()).toEqual([
      'https://admin.example.com',
      'https://host.example.com',
      'https://ops.example.com',
    ]);
  });

  test('matches exact allowed postMessage origins only', () => {
    const allowed = ['https://host.example.com'];

    expect(isAllowedEmbedOrigin('https://host.example.com', allowed)).toBe(true);
    expect(isAllowedEmbedOrigin('https://evil.example.com', allowed)).toBe(false);
  });
});
