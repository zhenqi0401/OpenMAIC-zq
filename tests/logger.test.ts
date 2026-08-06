import { afterEach, describe, expect, test, vi } from 'vitest';
import { createLogger } from '@/lib/logger';

describe('logger error serialization', () => {
  const originalLogFormat = process.env.LOG_FORMAT;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalLogFormat === undefined) delete process.env.LOG_FORMAT;
    else process.env.LOG_FORMAT = originalLogFormat;
  });

  test('keeps nested Error message and stack visible to operators and agents', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createLogger('Test').error('request failed', { error: new Error('upstream exploded') });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = String(errorSpy.mock.calls[0][0]);
    expect(line).toContain('upstream exploded');
    expect(line).toContain('Error');
  });

  test('exposes structured context as machine-readable JSON', () => {
    process.env.LOG_FORMAT = 'json';
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    createLogger('Test').error('request failed', {
      code: 'UPSTREAM_TIMEOUT',
      phase: 'provider-call',
      error: new Error('provider did not respond'),
    });

    const record = JSON.parse(String(errorSpy.mock.calls[0][0])) as {
      context: { code: string; phase: string; error: { message: string } };
    };
    expect(record.context).toMatchObject({
      code: 'UPSTREAM_TIMEOUT',
      phase: 'provider-call',
      error: { message: 'provider did not respond' },
    });
  });
});
