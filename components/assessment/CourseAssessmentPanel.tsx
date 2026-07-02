'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Send, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  AssessmentAnswers,
  CourseAssessmentDetail,
  PublicCourseAssessment,
} from '@/lib/assessment/course-assessment';

interface CourseAssessmentPanelProps {
  courseId: string;
  learningProgress: { sceneIndex: number; actionIndex: number };
  onPassed: () => void;
  onRestartLearning: () => void;
}

interface AttemptResult {
  attempt: {
    score: number;
    passed: boolean;
    attemptNumber: number;
    threshold: number;
    details: CourseAssessmentDetail[];
  };
  requiresRelearning: boolean;
}

function answerCount(answers: AssessmentAnswers) {
  return Object.values(answers).filter((answer) =>
    Array.isArray(answer) ? answer.length > 0 : answer.trim().length > 0,
  ).length;
}

export function CourseAssessmentPanel({
  courseId,
  learningProgress,
  onPassed,
  onRestartLearning,
}: CourseAssessmentPanelProps) {
  const [assessment, setAssessment] = useState<PublicCourseAssessment | null>(null);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAssessment() {
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        await fetch(`/api/courses/${encodeURIComponent(courseId)}/progress`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...learningProgress, completed: true }),
        });
        const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/assessment`);
        const data = (await response.json()) as {
          assessment?: PublicCourseAssessment;
          error?: string;
        };
        if (!response.ok || !data.assessment) {
          throw new Error(data.error ?? '课后测评加载失败');
        }
        if (!cancelled) {
          setAssessment(data.assessment);
          if (data.assessment.completed) onPassed();
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '课后测评加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAssessment();
    return () => {
      cancelled = true;
    };
  }, [courseId, learningProgress, onPassed]);

  const answered = useMemo(() => answerCount(answers), [answers]);
  const allAnswered = !!assessment && answered === assessment.questions.length;
  const resultMap = useMemo(() => {
    const map = new Map<string, CourseAssessmentDetail>();
    result?.attempt.details.forEach((detail) => map.set(detail.questionId, detail));
    return map;
  }, [result]);

  function setSingleAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function toggleMultipleAnswer(questionId: string, value: string) {
    setAnswers((current) => {
      const existing = Array.isArray(current[questionId]) ? current[questionId] : [];
      const next = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];
      return { ...current, [questionId]: next };
    });
  }

  async function submitAssessment() {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/courses/${encodeURIComponent(courseId)}/assessment/attempts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ answers }),
        },
      );
      const data = (await response.json()) as { result?: AttemptResult; error?: string };
      if (!response.ok || !data.result) {
        throw new Error(data.error ?? '课后测评提交失败');
      }
      setResult(data.result);
      if (data.result.attempt.passed) onPassed();
    } catch (err) {
      setError(err instanceof Error ? err.message : '课后测评提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800">
        <Loader2 className="size-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-8 text-center dark:bg-gray-800">
        <AlertCircle className="size-9 text-red-500" />
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {error ?? '课后测评不可用'}
        </p>
      </div>
    );
  }

  if (!assessment.canAttempt) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white px-8 text-center dark:bg-gray-800">
        <RotateCcw className="size-10 text-amber-500" />
        <div>
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">请先重新学习</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            课后测评未通过后，需要重新完成课程再作答。
          </p>
        </div>
        <button
          onClick={onRestartLearning}
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900"
        >
          <RotateCcw className="size-4" />
          重新学习
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-white dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-700">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">课后测评</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {answered}/{assessment.questions.length} · {assessment.threshold}% 通过
          </p>
        </div>
        {!result && (
          <button
            onClick={submitAssessment}
            disabled={!allAnswered || submitting}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition',
              allAnswered && !submitting
                ? 'bg-violet-600 text-white hover:bg-violet-700'
                : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
            )}
          >
            {submitting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            提交
          </button>
        )}
      </div>

      {result && (
        <div
          className={cn(
            'mx-5 mt-4 flex items-start gap-3 rounded-md border px-4 py-3',
            result.attempt.passed
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
              : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200',
          )}
        >
          {result.attempt.passed ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" />
          ) : (
            <XCircle className="mt-0.5 size-5 shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {result.attempt.passed ? '测评通过' : '测评未通过'}
            </p>
            <p className="text-xs opacity-80">
              得分 {result.attempt.score}%，第 {result.attempt.attemptNumber} 次提交
            </p>
          </div>
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        {assessment.questions.map((question, index) => {
          const detail = resultMap.get(question.id);
          const currentAnswer = answers[question.id];
          return (
            <div
              key={question.id}
              className="rounded-md border border-gray-100 p-4 dark:border-gray-700"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {index + 1}. {question.question}
                </p>
                {detail &&
                  (detail.correct ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="size-4 shrink-0 text-red-500" />
                  ))}
              </div>
              <div className="mt-3 space-y-2">
                {(question.options ?? []).map((option) => {
                  const selected =
                    question.type === 'multiple'
                      ? Array.isArray(currentAnswer) && currentAnswer.includes(option.value)
                      : currentAnswer === option.value;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition',
                        selected
                          ? 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100'
                          : 'border-gray-100 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700/40',
                        result && 'cursor-default',
                      )}
                    >
                      <input
                        checked={selected}
                        disabled={!!result}
                        type={question.type === 'multiple' ? 'checkbox' : 'radio'}
                        name={question.id}
                        onChange={() =>
                          question.type === 'multiple'
                            ? toggleMultipleAnswer(question.id, option.value)
                            : setSingleAnswer(question.id, option.value)
                        }
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
              {detail && !detail.correct && detail.analysis && (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                  {detail.analysis}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {result?.requiresRelearning && (
        <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-700">
          <button
            onClick={onRestartLearning}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900"
          >
            <RotateCcw className="size-4" />
            重新学习
          </button>
        </div>
      )}
    </div>
  );
}
