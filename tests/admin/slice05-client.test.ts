import { describe, expect, test, vi } from 'vitest';

import { createAdminClient } from '@/lib/admin/client';

describe('Slice-05 admin exam client helpers', () => {
  test('loads, creates, updates, publishes, and deletes exam policies through admin APIs', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (input: string, init?: RequestInit) => {
      calls.push({ url: input, init });
      if (input === '/api/admin/exam-policies' && !init) {
        return Response.json({
          examPolicies: [
            {
              id: 'policy-1',
              title: 'Sales Exam',
              targetRoleId: 'role-sales',
              categoryIds: ['cat-sales'],
              courseIds: [],
              questionCount: 20,
              passThreshold: 80,
              timeLimitMinutes: 45,
              status: 'draft',
              candidateQuestionCount: 32,
            },
          ],
        });
      }
      if (input === '/api/admin/exam-policies' && init?.method === 'POST') {
        return Response.json(
          { examPolicy: { id: 'policy-new', status: 'draft' } },
          { status: 201 },
        );
      }
      if (input === '/api/admin/exam-policies/policy-1' && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as { status?: string };
        return Response.json({
          examPolicy:
            body.status === 'archived'
              ? { id: 'policy-1', status: 'archived' }
              : { id: 'policy-1', questionCount: 24 },
        });
      }
      if (input === '/api/admin/exam-policies/policy-1/publish' && init?.method === 'POST') {
        return Response.json({ examPolicy: { id: 'policy-1', status: 'published' } });
      }
      if (input === '/api/admin/exam-policies/policy-1' && init?.method === 'DELETE') {
        return Response.json({ examPolicy: { id: 'policy-1', status: 'draft' } });
      }
      return Response.json({ error: 'unexpected' }, { status: 500 });
    });
    const client = createAdminClient(fetcher);

    await expect(client.listExamPolicies()).resolves.toMatchObject([
      { id: 'policy-1', candidateQuestionCount: 32 },
    ]);
    await expect(
      client.createExamPolicy({
        title: 'New Exam',
        targetRoleId: 'role-sales',
        categoryIds: ['cat-sales'],
        courseIds: [],
        questionCount: 20,
        passThreshold: 80,
        timeLimitMinutes: 45,
      }),
    ).resolves.toMatchObject({ examPolicy: { id: 'policy-new' } });
    await expect(client.updateExamPolicy('policy-1', { questionCount: 24 })).resolves.toMatchObject(
      {
        examPolicy: { questionCount: 24 },
      },
    );
    await expect(
      client.updateExamPolicy('policy-1', { status: 'archived' }),
    ).resolves.toMatchObject({ examPolicy: { status: 'archived' } });
    await expect(client.publishExamPolicy('policy-1')).resolves.toMatchObject({
      examPolicy: { status: 'published' },
    });
    await expect(client.deleteExamPolicy('policy-1')).resolves.toMatchObject({
      examPolicy: { id: 'policy-1', status: 'draft' },
    });

    expect(calls.map((call) => [call.url, call.init?.method ?? 'GET'])).toEqual([
      ['/api/admin/exam-policies', 'GET'],
      ['/api/admin/exam-policies', 'POST'],
      ['/api/admin/exam-policies/policy-1', 'PATCH'],
      ['/api/admin/exam-policies/policy-1', 'PATCH'],
      ['/api/admin/exam-policies/policy-1/publish', 'POST'],
      ['/api/admin/exam-policies/policy-1', 'DELETE'],
    ]);
  });

  test('surfaces a conflict when a non-draft exam policy cannot be deleted', async () => {
    const client = createAdminClient(async () =>
      Response.json({ error: 'Only draft exam policies can be deleted' }, { status: 409 }),
    );

    await expect(client.deleteExamPolicy('policy-published')).rejects.toMatchObject({
      status: 409,
      message: '考核策略删除失败',
    });
  });
});
