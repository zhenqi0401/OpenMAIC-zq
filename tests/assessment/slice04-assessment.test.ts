import { describe, expect, test } from 'vitest';

import {
  buildCourseAssessment,
  gradeCourseAssessment,
  normalizeGeneratedAssessmentQuestions,
  type CourseAssessmentQuestion,
} from '@/lib/assessment/course-assessment';
import type { QuizQuestion } from '@/lib/types/stage';

function question(overrides: Partial<QuizQuestion>): QuizQuestion {
  return {
    id: 'q1',
    type: 'single',
    question: 'Pick one',
    options: [
      { value: 'A', label: 'A' },
      { value: 'B', label: 'B' },
    ],
    answer: ['A'],
    analysis: 'Review the source material.',
    points: 1,
    ...overrides,
  };
}

describe('Slice-04 course assessment domain', () => {
  test('builds course assessments from choice questions only', () => {
    const assessment = buildCourseAssessment('course-1', [
      question({ id: 'single', type: 'single' }),
      question({ id: 'multi', type: 'multiple', answer: ['A', 'B'] }),
      question({ id: 'short', type: 'short_answer', answer: undefined }),
    ]);

    expect(assessment).toMatchObject({
      courseId: 'course-1',
      threshold: 80,
      questions: [{ id: 'single' }, { id: 'multi' }],
    });
  });

  test('grades single and multiple choice answers without calling short-answer grading', () => {
    const questions: CourseAssessmentQuestion[] = [
      question({ id: 'single', type: 'single', points: 2 }),
      question({ id: 'multi', type: 'multiple', answer: ['A', 'B'], points: 2 }),
    ];

    const result = gradeCourseAssessment({
      questions,
      answers: { single: 'A', multi: ['B', 'A'] },
      threshold: 80,
    });

    expect(result).toMatchObject({
      score: 100,
      passed: true,
      totalPoints: 4,
      earnedPoints: 4,
      details: [
        { questionId: 'single', correct: true, earned: 2, analysis: 'Review the source material.' },
        { questionId: 'multi', correct: true, earned: 2 },
      ],
    });
  });

  test('fails below threshold and preserves wrong-question analysis for relearning', () => {
    const result = gradeCourseAssessment({
      questions: [
        question({ id: 'single', type: 'single' }),
        question({ id: 'multi', type: 'multiple', answer: ['A', 'B'] }),
      ],
      answers: { single: 'B', multi: ['A', 'B'] },
      threshold: 80,
    });

    expect(result.score).toBe(50);
    expect(result.passed).toBe(false);
    expect(result.details[0]).toMatchObject({
      questionId: 'single',
      correct: false,
      analysis: 'Review the source material.',
    });
  });

  test('normalizes AI-generated post-course questions and caps them at ten', () => {
    const rawQuestions = Array.from({ length: 12 }, (_, index) => ({
      id: `ai-${index + 1}`,
      type: index % 2 === 0 ? 'single' : 'multiple',
      question: `Generated question ${index + 1}`,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: index % 2 === 0 ? 'Option A' : ['Option A', 'Option B'],
      analysis: 'Course-specific explanation.',
      points: 10,
    }));

    const normalized = normalizeGeneratedAssessmentQuestions([
      ...rawQuestions,
      { id: 'short', type: 'short_answer', question: 'Explain the concept' },
    ]);

    expect(normalized).toHaveLength(10);
    expect(normalized.map((item) => item.id)).not.toContain('short');
    expect(normalized[0]).toMatchObject({
      id: 'ai-1',
      type: 'single',
      options: [
        { value: 'A', label: 'Option A' },
        { value: 'B', label: 'Option B' },
        { value: 'C', label: 'Option C' },
        { value: 'D', label: 'Option D' },
      ],
      answer: ['A'],
    });
    expect(normalized[1]).toMatchObject({
      id: 'ai-2',
      type: 'multiple',
      answer: ['A', 'B'],
    });
  });
});
