import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('exam policy repository deletion contract', () => {
  const repositorySource = readFileSync(
    resolve(process.cwd(), 'lib/storage/enterprise-repository.ts'),
    'utf8',
  );
  const schemaSource = readFileSync(resolve(process.cwd(), 'lib/storage/schema/index.ts'), 'utf8');

  test('deletes with both id and draft status in the same repository predicate', () => {
    expect(repositorySource).toMatch(
      /delete\(examPolicies\)[\s\S]*?where\(and\(eq\(examPolicies\.id, id\), eq\(examPolicies\.status, 'draft'\)\)\)/,
    );
  });

  test('keeps course mappings cascade-bound to the exam policy', () => {
    expect(schemaSource).toMatch(
      /examPolicyId:[\s\S]*?references\(\(\) => examPolicies\.id, \{ onDelete: 'cascade' \}\)/,
    );
  });
});
