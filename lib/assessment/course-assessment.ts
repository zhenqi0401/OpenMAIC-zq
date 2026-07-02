import type { QuizQuestion } from '@/lib/types/stage';
import { gradeChoiceQuestions, toArray, type QuestionResult } from '@/lib/quiz/grading';

export const DEFAULT_ASSESSMENT_THRESHOLD = 80;

export type AssessmentAnswers = Record<string, string | string[]>;
export type CourseAssessmentQuestion = QuizQuestion & { type: 'single' | 'multiple' };

export interface PublicCourseAssessmentQuestion {
  id: string;
  type: 'single' | 'multiple';
  question: string;
  options?: QuizQuestion['options'];
  points?: number;
}

export interface CourseAssessment {
  courseId: string;
  threshold: number;
  questions: CourseAssessmentQuestion[];
}

export interface PublicCourseAssessment {
  courseId: string;
  threshold: number;
  questions: PublicCourseAssessmentQuestion[];
  completed: boolean;
  canAttempt: boolean;
  requiresRelearning: boolean;
}

export interface CourseAssessmentDetail extends QuestionResult {
  answer: string[];
  correctAnswer: string[];
  points: number;
  analysis?: string;
}

export interface CourseAssessmentGrade {
  score: number;
  passed: boolean;
  threshold: number;
  totalPoints: number;
  earnedPoints: number;
  answers: AssessmentAnswers;
  details: CourseAssessmentDetail[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isChoiceAssessmentQuestion(value: unknown): value is CourseAssessmentQuestion {
  if (!isRecord(value)) return false;
  if (value.type !== 'single' && value.type !== 'multiple') return false;
  return typeof value.id === 'string' && typeof value.question === 'string';
}

export function filterChoiceQuestions(questions: unknown[] | null | undefined) {
  return (Array.isArray(questions) ? questions : []).filter(isChoiceAssessmentQuestion);
}

function optionLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

function normalizeOptions(options: unknown): NonNullable<QuizQuestion['options']> {
  if (!Array.isArray(options)) return [];
  return options
    .map((option, index) => {
      const fallbackValue = optionLetter(index);
      if (typeof option === 'string') {
        return { value: fallbackValue, label: option };
      }
      if (!isRecord(option)) return null;
      const value =
        typeof option.value === 'string' && option.value.trim()
          ? option.value.trim()
          : fallbackValue;
      const label =
        typeof option.label === 'string' && option.label.trim()
          ? option.label.trim()
          : typeof option.text === 'string' && option.text.trim()
            ? option.text.trim()
            : value;
      return { value, label };
    })
    .filter((option): option is NonNullable<QuizQuestion['options']>[number] => option !== null);
}

function rawAnswerValues(question: Record<string, unknown>): string[] {
  const raw = question.answer ?? question.correctAnswer ?? question.correct_answer;
  if (Array.isArray(raw)) return raw.map(String);
  if (raw === undefined || raw === null || raw === '') return [];
  return [String(raw)];
}

function normalizeAnswers(
  question: Record<string, unknown>,
  options: NonNullable<QuizQuestion['options']>,
) {
  const optionValues = new Set(options.map((option) => option.value));
  const labelToValue = new Map(
    options.map((option) => [option.label.trim().toLowerCase(), option.value] as const),
  );
  const normalized = rawAnswerValues(question)
    .map((answer) => {
      const trimmed = answer.trim();
      if (optionValues.has(trimmed)) return trimmed;
      const byLabel = labelToValue.get(trimmed.toLowerCase());
      return byLabel ?? trimmed;
    })
    .filter((answer) => optionValues.has(answer));

  return Array.from(new Set(normalized));
}

export function normalizeGeneratedAssessmentQuestions(
  questions: unknown[] | null | undefined,
  maxQuestions = 10,
): CourseAssessmentQuestion[] {
  const normalized: CourseAssessmentQuestion[] = [];
  for (const value of Array.isArray(questions) ? questions : []) {
    if (!isRecord(value)) continue;
    if (value.type !== 'single' && value.type !== 'multiple') continue;
    if (typeof value.question !== 'string' || !value.question.trim()) continue;

    const options = normalizeOptions(value.options);
    if (options.length < 2) continue;

    const answers = normalizeAnswers(value, options);
    const answer = value.type === 'single' ? answers.slice(0, 1) : answers;
    if (answer.length === 0) continue;
    if (value.type === 'multiple' && answer.length < 2) continue;

    const points = typeof value.points === 'number' && value.points > 0 ? value.points : 10;
    normalized.push({
      id:
        typeof value.id === 'string' && value.id.trim()
          ? value.id.trim()
          : `assessment_${normalized.length + 1}`,
      type: value.type,
      question: value.question.trim(),
      options,
      answer,
      hasAnswer: true,
      points,
      ...(typeof value.analysis === 'string' && value.analysis.trim()
        ? { analysis: value.analysis.trim() }
        : {}),
    });
    if (normalized.length >= maxQuestions) break;
  }
  return normalized;
}

export function buildCourseAssessment(
  courseId: string,
  questions: unknown[] | null | undefined,
  threshold = DEFAULT_ASSESSMENT_THRESHOLD,
): CourseAssessment {
  return {
    courseId,
    threshold,
    questions: filterChoiceQuestions(questions),
  };
}

export function toPublicCourseAssessment(
  assessment: CourseAssessment,
  state: { completed?: boolean; canAttempt: boolean; requiresRelearning: boolean },
): PublicCourseAssessment {
  return {
    courseId: assessment.courseId,
    threshold: assessment.threshold,
    questions: assessment.questions.map((question) => ({
      id: question.id,
      type: question.type,
      question: question.question,
      options: question.options,
      points: question.points,
    })),
    completed: state.completed ?? false,
    canAttempt: state.canAttempt,
    requiresRelearning: state.requiresRelearning,
  };
}

export function gradeCourseAssessment(input: {
  questions: CourseAssessmentQuestion[];
  answers: AssessmentAnswers;
  threshold?: number;
}): CourseAssessmentGrade {
  const threshold = input.threshold ?? DEFAULT_ASSESSMENT_THRESHOLD;
  const results = gradeChoiceQuestions(input.questions, input.answers);
  const resultMap = new Map(results.map((result) => [result.questionId, result]));
  const totalPoints = input.questions.reduce((sum, question) => sum + (question.points ?? 1), 0);
  const earnedPoints = results.reduce((sum, result) => sum + result.earned, 0);
  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  const details = input.questions.map((question) => {
    const result = resultMap.get(question.id);
    return {
      questionId: question.id,
      correct: result?.correct ?? false,
      status: result?.status ?? ('incorrect' as const),
      earned: result?.earned ?? 0,
      answer: toArray(input.answers[question.id]),
      correctAnswer: toArray(question.answer),
      points: question.points ?? 1,
      ...(question.analysis ? { analysis: question.analysis } : {}),
    };
  });

  return {
    score,
    passed: score >= threshold,
    threshold,
    totalPoints,
    earnedPoints,
    answers: input.answers,
    details,
  };
}
