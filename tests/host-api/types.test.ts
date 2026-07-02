import { describe, expect, test } from 'vitest';

import {
  isChoiceQuestionRef,
  normalizeHostQueryFilters,
  type DashboardSummary,
  type QuestionRef,
} from '@/lib/host-api/types';

describe('host API shared types', () => {
  test('normalizes host query filters without leaking empty values', () => {
    expect(
      normalizeHostQueryFilters({
        courseId: 'course-1',
        roleId: '',
        from: '2026-07-01T00:00:00Z',
        to: undefined,
      }),
    ).toEqual({ courseId: 'course-1', from: '2026-07-01T00:00:00Z' });
  });

  test('restricts assessment/exam question refs to choice questions', () => {
    const single: QuestionRef = {
      source: 'course-quiz',
      courseId: 'course-1',
      questionId: 'q1',
      type: 'single',
    };
    const shortAnswer = {
      source: 'course-quiz',
      courseId: 'course-1',
      questionId: 'q2',
      type: 'short_answer',
    };

    expect(isChoiceQuestionRef(single)).toBe(true);
    expect(isChoiceQuestionRef(shortAnswer)).toBe(false);
  });

  test('models dashboard summary counters for admin and host queries', () => {
    const summary: DashboardSummary = {
      courseCompletionRate: 75,
      assessmentPassRate: 80,
      examPassRate: 90,
      learnerCount: 120,
      courseCount: 12,
      assessmentAttemptCount: 300,
      examAttemptCount: 40,
    };

    expect(summary.assessmentPassRate).toBe(80);
  });
});
