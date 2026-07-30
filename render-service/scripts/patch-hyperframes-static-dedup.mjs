import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * Hyperframes 0.7.60 hard-codes static-frame verification to 15 seconds and
 * estimates a second sample-count hard cap from total static frames. For a
 * timeline with many short static runs, the per-run minimum sample count can
 * legitimately exceed that estimate, so verification stops early even when
 * the wall-clock budget remains.
 *
 * Keep verification enabled, but make its wall-clock budget configurable.
 * This postinstall patch deliberately fails when the upstream bundle changes,
 * forcing an explicit review instead of silently shipping without the fix.
 */
const bundlePaths = [
  'node_modules/@hyperframes/producer/dist/index.js',
  'node_modules/@hyperframes/producer/dist/public-server.js',
];

const budgetOriginal = 'STATIC_VERIFY_MAX_MS = 15e3;';
const budgetReplacement =
  'STATIC_VERIFY_MAX_MS = Math.max(1e3, Number(process.env.HF_STATIC_DEDUP_VERIFY_MAX_MS ?? "15e3") || 15e3);';

const hardCapOriginal = `const hardCap = Math.max(
    sampleCount * 8,
    400,
    Math.ceil(frames.length / STATIC_VERIFY_REFERENCE_STRIDE) * 3 + runs.length
  );`;
const hardCapReplacement = `const hardCap = Math.max(
    sampleCount * 8,
    400,
    runs.reduce(
      (total, run) => total + 1 + computeStaticVerificationPoints(run.a, run.b, sampleCount).length,
      0
    )
  );`;

for (const relativePath of bundlePaths) {
  const path = resolve(relativePath);
  const source = await readFile(path, 'utf8');

  let patched = source;

  if (!patched.includes(budgetReplacement)) {
    const matches = patched.split(budgetOriginal).length - 1;
    if (matches !== 1) {
      throw new Error(
        `[hyperframes patch] expected one static verification budget assignment in ${relativePath}, found ${matches}`,
      );
    }
    patched = patched.replace(budgetOriginal, budgetReplacement);
  }

  if (!patched.includes(hardCapReplacement)) {
    const matches = patched.split(hardCapOriginal).length - 1;
    if (matches !== 1) {
      throw new Error(
        `[hyperframes patch] expected one static verification hard-cap assignment in ${relativePath}, found ${matches}`,
      );
    }
    patched = patched.replace(hardCapOriginal, hardCapReplacement);
  }

  if (patched === source) continue;
  await writeFile(path, patched);
  console.log(
    `[hyperframes patch] made static verification budget configurable and hard-cap exact in ${relativePath}`,
  );
}
