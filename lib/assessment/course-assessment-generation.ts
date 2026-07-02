import { parseJsonResponse } from '@/lib/generation/json-repair';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { EnterpriseCourseContent } from '@/lib/storage/enterprise-service';
import {
  normalizeGeneratedAssessmentQuestions,
  type CourseAssessmentQuestion,
} from './course-assessment';

export const MAX_GENERATED_ASSESSMENT_QUESTIONS = 10;

export interface GenerateCourseAssessmentQuestionsInput {
  content: EnterpriseCourseContent;
  aiCall: AICallFn;
  questionCount?: number;
  languageDirective?: string;
}

const OMIT_CONTEXT_KEYS = new Set([
  'answer',
  'answers',
  'commentPrompt',
  'correct_answer',
  'correctAnswer',
  'options',
  'questions',
]);

function clampQuestionCount(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return MAX_GENERATED_ASSESSMENT_QUESTIONS;
  }
  return Math.max(1, Math.min(MAX_GENERATED_ASSESSMENT_QUESTIONS, Math.floor(value)));
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectTextFragments(value: unknown, fragments: string[], seen = new Set<unknown>()) {
  if (fragments.length >= 80 || value === null || value === undefined) return;
  if (typeof value === 'string') {
    const text = stripHtml(value);
    if (text) fragments.push(text);
    return;
  }
  if (typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collectTextFragments(item, fragments, seen);
    return;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (OMIT_CONTEXT_KEYS.has(key)) continue;
    collectTextFragments(nested, fragments, seen);
  }
}

function buildCourseAssessmentContext(content: EnterpriseCourseContent): string {
  const fragments: string[] = [];
  collectTextFragments(
    {
      course: {
        name: content.course.name,
        description: content.course.description,
        categoryName: content.course.categoryName,
      },
      outlines: content.outlines,
      scenes: content.scenes,
    },
    fragments,
  );
  return fragments.join('\n').slice(0, 8000);
}

function buildPrompts(input: {
  content: EnterpriseCourseContent;
  questionCount: number;
  languageDirective?: string;
}) {
  const context = buildCourseAssessmentContext(input.content);
  const system = [
    'You are a professional enterprise training assessment designer.',
    'Generate an original post-course assessment from the completed course content.',
    'Do not extract or copy existing in-course quiz questions.',
    'Only generate single-choice and multiple-choice questions.',
    'Never generate short_answer questions.',
    'Every question must include id, type, question, options, answer, analysis, and points.',
    'Output only a JSON array. Do not use Markdown code fences.',
  ].join('\n');
  const user = [
    `Course title: ${input.content.course.name}`,
    `Course description: ${input.content.course.description ?? ''}`,
    `Question count: ${input.questionCount} or fewer, never more than ${MAX_GENERATED_ASSESSMENT_QUESTIONS}.`,
    'Allowed types: single, multiple.',
    'Use option values A, B, C, D when possible. For multiple-choice, answer must contain at least two option values.',
    input.languageDirective ? `Language directive: ${input.languageDirective}` : '',
    '',
    'Course content summary:',
    context || '(No textual course content was available.)',
    '',
    'Return JSON like:',
    '[{"id":"assessment_1","type":"single","question":"...","options":[{"value":"A","label":"..."},{"value":"B","label":"..."}],"answer":["A"],"analysis":"...","points":10}]',
  ]
    .filter(Boolean)
    .join('\n');
  return { system, user };
}

export async function generateCourseAssessmentQuestions(
  input: GenerateCourseAssessmentQuestionsInput,
): Promise<CourseAssessmentQuestion[]> {
  const questionCount = clampQuestionCount(input.questionCount);
  const prompts = buildPrompts({
    content: input.content,
    questionCount,
    languageDirective: input.languageDirective,
  });
  const response = await input.aiCall(prompts.system, prompts.user);
  const parsed = parseJsonResponse<unknown[]>(response);
  const questions = normalizeGeneratedAssessmentQuestions(parsed, questionCount);
  if (questions.length === 0) {
    throw new Error('AI did not generate valid single/multiple choice assessment questions');
  }
  return questions;
}
