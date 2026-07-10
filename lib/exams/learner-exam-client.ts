import type { AssessmentAnswers } from '@/lib/assessment/course-assessment';
import type {
  PublicStageExam,
  StageExamAttemptDetail,
  StageExamQuestionRef,
} from '@/lib/exams/stage-exam';
import type { EnterpriseExamPolicy } from '@/lib/storage/enterprise-service';

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface LearnerExamAttemptResult {
  attempt: {
    score: number;
    passed: boolean;
    attemptNumber: number;
    threshold: number;
    duration: number | null;
    details: StageExamAttemptDetail[];
  };
}

export interface SubmitLearnerExamInput {
  answers: AssessmentAnswers;
  questionRefs: StageExamQuestionRef[];
  durationSeconds: number | null;
}

interface ApiErrorBody {
  error?: unknown;
}

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & ApiErrorBody;
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : fallback);
  }
  return data;
}

export async function listLearnerExams(
  fetcher: FetchLike = (url, init) => fetch(url, init),
): Promise<EnterpriseExamPolicy[]> {
  const response = await fetcher('/api/exams');
  const data = await readJson<{ exams?: EnterpriseExamPolicy[] }>(response, '阶段考核加载失败');
  if (!Array.isArray(data.exams)) throw new Error('阶段考核加载失败');
  return data.exams;
}

export async function startLearnerExam(
  policyId: string,
  fetcher: FetchLike = (url, init) => fetch(url, init),
): Promise<PublicStageExam> {
  const response = await fetcher(`/api/exams/${encodeURIComponent(policyId)}/start`, {
    method: 'POST',
  });
  const data = await readJson<{ exam?: PublicStageExam }>(response, '阶段考核开始失败');
  if (!data.exam) throw new Error('阶段考核开始失败');
  return data.exam;
}

export async function submitLearnerExam(
  policyId: string,
  input: SubmitLearnerExamInput,
  fetcher: FetchLike = (url, init) => fetch(url, init),
): Promise<LearnerExamAttemptResult> {
  const response = await fetcher(`/api/exams/${encodeURIComponent(policyId)}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await readJson<{ result?: LearnerExamAttemptResult }>(response, '阶段考核提交失败');
  if (!data.result) throw new Error('阶段考核提交失败');
  return data.result;
}

export function countAnsweredExamQuestions(answers: AssessmentAnswers): number {
  return Object.values(answers).filter((answer) =>
    Array.isArray(answer) ? answer.length > 0 : answer.trim().length > 0,
  ).length;
}
