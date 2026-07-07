import type { QuizQuestion } from '@/lib/types/stage';

export type ChoiceQuestionType = Extract<QuizQuestion['type'], 'single' | 'multiple'>;

export interface QuestionRef {
  source: 'course-quiz' | 'assessment';
  courseId: string;
  questionId: string;
  type: ChoiceQuestionType;
}

export interface ExamPolicy {
  id: string;
  title: string;
  targetRoleId: string;
  categoryIds: string[];
  courseIds: string[];
  questionCount: number;
  passThreshold: number;
  timeLimitMinutes?: number;
  status: 'draft' | 'published' | 'archived';
}

export interface DashboardSummary {
  /** 0-100 integer percent. */
  courseCompletionRate: number;
  /** 0-100 integer percent. */
  assessmentPassRate: number;
  /** 0-100 integer percent. */
  examPassRate: number;
  learnerCount: number;
  courseCount: number;
  assessmentAttemptCount: number;
  examAttemptCount: number;
}

export interface HostQueryFilters {
  courseId?: string;
  roleId?: string;
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function isChoiceQuestionRef(value: unknown): value is QuestionRef {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown };
  return candidate.type === 'single' || candidate.type === 'multiple';
}

export function normalizeHostQueryFilters(input: HostQueryFilters): HostQueryFilters {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== ''),
  ) as HostQueryFilters;
}
