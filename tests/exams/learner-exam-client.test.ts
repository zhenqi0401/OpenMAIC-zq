import { describe, expect, test, vi } from 'vitest';

import {
  countAnsweredExamQuestions,
  listLearnerExams,
  startLearnerExam,
  submitLearnerExam,
} from '@/lib/exams/learner-exam-client';

describe('SLICE-09 learner exam client', () => {
  test('loads role-filtered policies through the existing exams endpoint', async () => {
    const fetcher = vi.fn(async (url: string) => {
      expect(url).toBe('/api/exams');
      return new Response(
        JSON.stringify({
          success: true,
          exams: [
            {
              id: 'exam-sales',
              title: '门店服务考核',
              targetRoleId: 'role-sales',
              categoryIds: ['category-sales'],
              courseIds: [],
              questionCount: 5,
              passThreshold: 80,
              timeLimitMinutes: 15,
              status: 'published',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    await expect(listLearnerExams(fetcher)).resolves.toHaveLength(1);
  });

  test('keeps the existing start and attempt request contracts', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/start')) {
        expect(init?.method).toBe('POST');
        return new Response(
          JSON.stringify({
            success: true,
            exam: {
              policy: { id: 'exam-sales', passThreshold: 80 },
              questions: [],
              questionRefs: [],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      expect(url).toBe('/api/exams/exam-sales/attempts');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({
        answers: { q1: 'A' },
        questionRefs: [{ source: 'course_assessment', courseId: 'course-1', questionId: 'q1' }],
        durationSeconds: 12,
      });
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            attempt: {
              score: 100,
              passed: true,
              attemptNumber: 1,
              threshold: 80,
              duration: 12,
              details: [],
            },
          },
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      );
    });

    await startLearnerExam('exam-sales', fetcher);
    await expect(
      submitLearnerExam(
        'exam-sales',
        {
          answers: { q1: 'A' },
          questionRefs: [{ source: 'course_assessment', courseId: 'course-1', questionId: 'q1' }],
          durationSeconds: 12,
        },
        fetcher,
      ),
    ).resolves.toMatchObject({ attempt: { score: 100, passed: true } });
  });

  test('surfaces API errors and counts only non-empty answers', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: '阶段考核提交失败' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
    );

    await expect(listLearnerExams(fetcher)).rejects.toThrow('阶段考核提交失败');
    expect(
      countAnsweredExamQuestions({
        q1: 'A',
        q2: [],
        q3: ['A'],
        q4: '',
      }),
    ).toBe(2);
  });
});
