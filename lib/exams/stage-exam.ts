import type { AssessmentAnswers } from '@/lib/assessment/course-assessment';
import type {
  EnterpriseCourseContent,
  EnterpriseExamPolicy,
} from '@/lib/storage/enterprise-service';
import { gradeChoiceQuestions, toArray, type QuestionResult } from '@/lib/quiz/grading';
import type { QuizQuestion } from '@/lib/types/stage';

export type StageExamQuestionSource = 'scene_quiz' | 'course_assessment';

export interface StageExamQuestionRef {
  source: StageExamQuestionSource;
  courseId: string;
  questionId: string;
  sceneId?: string | null;
}

export type StageExamQuestion = QuizQuestion & {
  type: 'single' | 'multiple';
  ref: StageExamQuestionRef;
};

export interface PublicStageExamQuestion {
  id: string;
  type: 'single' | 'multiple';
  question: string;
  options?: QuizQuestion['options'];
  points?: number;
}

export interface PublicStageExam {
  policy: EnterpriseExamPolicy;
  questions: PublicStageExamQuestion[];
  questionRefs: StageExamQuestionRef[];
}

export interface StageExamAttemptDetail extends QuestionResult {
  answer: string[];
  correctAnswer: string[];
  points: number;
  analysis?: string;
  questionRef: StageExamQuestionRef;
}

export interface StageExamGrade {
  score: number;
  passed: boolean;
  threshold: number;
  totalPoints: number;
  earnedPoints: number;
  answers: AssessmentAnswers;
  details: StageExamAttemptDetail[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isAnswerableChoiceQuestion(value: unknown): value is QuizQuestion & {
  type: 'single' | 'multiple';
} {
  if (!isRecord(value)) return false;
  if (value.type !== 'single' && value.type !== 'multiple') return false;
  if (typeof value.id !== 'string' || typeof value.question !== 'string') return false;
  if (!Array.isArray(value.answer) || value.answer.length === 0) return false;
  return Array.isArray(value.options) && value.options.length >= 2;
}

function sceneId(scene: unknown): string | null {
  if (!isRecord(scene)) return null;
  return typeof scene.id === 'string' ? scene.id : null;
}

function quizContent(scene: unknown): { questions: unknown[] } | null {
  if (!isRecord(scene)) return null;
  const content = isRecord(scene.content) ? scene.content : scene;
  if (content.type !== 'quiz' || !Array.isArray(content.questions)) return null;
  return { questions: content.questions };
}

function withQuestionRef(
  question: QuizQuestion & { type: 'single' | 'multiple' },
  ref: StageExamQuestionRef,
): StageExamQuestion {
  return { ...question, ref };
}

export function collectStageExamCandidates(
  contents: EnterpriseCourseContent[],
): StageExamQuestion[] {
  return contents.flatMap((content) => {
    const sceneQuestions = content.scenes.flatMap((scene) => {
      const quiz = quizContent(scene);
      if (!quiz) return [];
      return quiz.questions.filter(isAnswerableChoiceQuestion).map((question) =>
        withQuestionRef(question, {
          source: 'scene_quiz',
          courseId: content.course.id,
          questionId: question.id,
          sceneId: sceneId(scene),
        }),
      );
    });

    const assessmentQuestions = content.course.assessmentQuestions
      .filter(isAnswerableChoiceQuestion)
      .map((question) =>
        withQuestionRef(question, {
          source: 'course_assessment',
          courseId: content.course.id,
          questionId: question.id,
        }),
      );

    return [...sceneQuestions, ...assessmentQuestions];
  });
}

export function questionRefKey(ref: StageExamQuestionRef): string {
  return [ref.source, ref.courseId, ref.sceneId ?? '', ref.questionId].join(':');
}

export function drawStageExamQuestions(
  candidates: StageExamQuestion[],
  count: number,
  random: () => number = Math.random,
): StageExamQuestion[] {
  const pool = [...candidates];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(0, Math.min(count, pool.length)));
}

export function toPublicStageExamQuestion(question: StageExamQuestion): PublicStageExamQuestion {
  return {
    id: question.id,
    type: question.type,
    question: question.question,
    options: question.options,
    points: question.points,
  };
}

export function toPublicStageExam(
  policy: EnterpriseExamPolicy,
  questions: StageExamQuestion[],
): PublicStageExam {
  return {
    policy,
    questions: questions.map(toPublicStageExamQuestion),
    questionRefs: questions.map((question) => question.ref),
  };
}

export function resolveQuestionsFromRefs(
  candidates: StageExamQuestion[],
  refs: StageExamQuestionRef[],
): StageExamQuestion[] {
  const byRef = new Map(candidates.map((question) => [questionRefKey(question.ref), question]));
  const seen = new Set<string>();
  return refs.map((ref) => {
    const key = questionRefKey(ref);
    if (seen.has(key)) throw new Error('Duplicate exam question reference');
    seen.add(key);
    const question = byRef.get(key);
    if (!question) throw new Error('Invalid exam question reference');
    return question;
  });
}

export function gradeStageExam(input: {
  questions: StageExamQuestion[];
  answers: AssessmentAnswers;
  threshold: number;
}): StageExamGrade {
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
      questionRef: question.ref,
      ...(question.analysis ? { analysis: question.analysis } : {}),
    };
  });

  return {
    score,
    passed: score >= input.threshold,
    threshold: input.threshold,
    totalPoints,
    earnedPoints,
    answers: input.answers,
    details,
  };
}
