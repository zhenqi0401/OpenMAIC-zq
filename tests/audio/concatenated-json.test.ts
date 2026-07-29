import { describe, expect, it } from 'vitest';

import {
  parseConcatenatedJsonObjects,
  splitConcatenatedJsonObjects,
} from '@/lib/audio/concatenated-json';

describe('Doubao concatenated JSON parsing', () => {
  it('splits adjacent objects while ignoring braces inside strings', () => {
    const input =
      '{"code":0,"data":"YQ==","message":"chunk {one}"}\n' +
      '{"code":45000000,"message":"quota } for \\"team\\" \\\\ pool"}';

    expect(parseConcatenatedJsonObjects(input)).toEqual([
      { code: 0, data: 'YQ==', message: 'chunk {one}' },
      { code: 45000000, message: 'quota } for "team" \\ pool' },
    ]);
  });

  it('ignores non-object framing text between complete objects', () => {
    expect(
      splitConcatenatedJsonObjects('event: data\n{"code":0}\n--frame--\n{"code":20000000}'),
    ).toEqual(['{"code":0}', '{"code":20000000}']);
  });

  it('rejects an incomplete final object instead of hiding the provider error', () => {
    expect(() => splitConcatenatedJsonObjects('{"code":0}\n{"code":45000000')).toThrow(
      'incomplete object',
    );
  });
});
