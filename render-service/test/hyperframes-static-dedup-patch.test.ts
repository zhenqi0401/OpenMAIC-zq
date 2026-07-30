import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Hyperframes static-frame reuse patch', () => {
  it('keeps verification enabled and makes the fail-closed time budget configurable', async () => {
    const producerBundle = await readFile(
      resolve('node_modules/@hyperframes/producer/dist/index.js'),
      'utf8',
    );

    expect(producerBundle).toContain('HF_STATIC_DEDUP_VERIFY_MAX_MS');
    expect(producerBundle).not.toContain('STATIC_VERIFY_MAX_MS = 15e3;');
  });

  it('sizes the hard cap from the actual samples planned for every static run', async () => {
    const producerBundle = await readFile(
      resolve('node_modules/@hyperframes/producer/dist/index.js'),
      'utf8',
    );

    expect(producerBundle).toContain(
      'computeStaticVerificationPoints(run.a, run.b, sampleCount).length',
    );
    expect(producerBundle).not.toContain(
      'Math.ceil(frames.length / STATIC_VERIFY_REFERENCE_STRIDE) * 3 + runs.length',
    );
  });
});
