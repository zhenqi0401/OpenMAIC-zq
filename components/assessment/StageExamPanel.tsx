'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, Loader2, PlayCircle, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AssessmentAnswers } from '@/lib/assessment/course-assessment';
import type {
  PublicStageExam,
  PublicStageExamQuestion,
  StageExamAttemptDetail,
} from '@/lib/exams/stage-exam';
import type { EnterpriseExamPolicy } from '@/lib/storage/enterprise-service';
import type { SessionIdentity } from '@/lib/auth/types';

interface StageExamPanelProps {
  identity: SessionIdentity | null;
}

interface ExamAttemptResult {
  attempt: {
    score: number;
    passed: boolean;
    attemptNumber: number;
    threshold: number;
    duration: number | null;
    details: StageExamAttemptDetail[];
  };
}

function answerCount(answers: AssessmentAnswers) {
  return Object.values(answers).filter((answer) =>
    Array.isArray(answer) ? answer.length > 0 : answer.trim().length > 0,
  ).length;
}

export function StageExamPanel({ identity }: StageExamPanelProps) {
  const [exams, setExams] = useState<EnterpriseExamPolicy[]>([]);
  const [activeExam, setActiveExam] = useState<PublicStageExam | null>(null);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [result, setResult] = useState<ExamAttemptResult | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!identity) {
      setExams([]);
      return;
    }
    let cancelled = false;

    async function loadExams() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/exams');
        if (response.status === 401) return;
        const data = (await response.json()) as {
          exams?: EnterpriseExamPolicy[];
          error?: string;
        };
        if (!response.ok || !data.exams) {
          throw new Error(data.error ?? '阶段考核加载失败');
        }
        if (!cancelled) setExams(data.exams);
      } catch (loadError) {
        if (!cancelled)
          setError(loadError instanceof Error ? loadError.message : '阶段考核加载失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadExams();
    return () => {
      cancelled = true;
    };
  }, [identity]);

  const answered = useMemo(() => answerCount(answers), [answers]);
  const allAnswered = !!activeExam && answered === activeExam.questions.length;
  const resultMap = useMemo(() => {
    const map = new Map<string, StageExamAttemptDetail>();
    result?.attempt.details.forEach((detail) => map.set(detail.questionId, detail));
    return map;
  }, [result]);

  async function startExam(policy: EnterpriseExamPolicy) {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswers({});
    try {
      const response = await fetch(`/api/exams/${encodeURIComponent(policy.id)}/start`, {
        method: 'POST',
      });
      const data = (await response.json()) as { exam?: PublicStageExam; error?: string };
      if (!response.ok || !data.exam) {
        throw new Error(data.error ?? '阶段考核开始失败');
      }
      setActiveExam(data.exam);
      setStartedAt(Date.now());
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : '阶段考核开始失败');
    } finally {
      setLoading(false);
    }
  }

  function setSingleAnswer(questionId: string, value: string) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function toggleMultipleAnswer(questionId: string, value: string) {
    setAnswers((current) => {
      const existing = Array.isArray(current[questionId]) ? current[questionId] : [];
      return {
        ...current,
        [questionId]: existing.includes(value)
          ? existing.filter((item) => item !== value)
          : [...existing, value],
      };
    });
  }

  async function submitExam() {
    if (!activeExam || !allAnswered || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const durationSeconds = startedAt
        ? Math.max(1, Math.round((Date.now() - startedAt) / 1000))
        : null;
      const response = await fetch(
        `/api/exams/${encodeURIComponent(activeExam.policy.id)}/attempts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answers,
            questionRefs: activeExam.questionRefs,
            durationSeconds,
          }),
        },
      );
      const data = (await response.json()) as { result?: ExamAttemptResult; error?: string };
      if (!response.ok || !data.result) {
        throw new Error(data.error ?? '阶段考核提交失败');
      }
      setResult(data.result);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '阶段考核提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (!identity || (!loading && exams.length === 0 && !activeExam && !error)) return null;

  return (
    <section className="relative z-10 mt-8 w-full max-w-6xl">
      <div className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-950">
              <ClipboardList className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-50">阶段考核</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {activeExam
                  ? `${answered}/${activeExam.questions.length} · ${activeExam.policy.passThreshold}%`
                  : `${exams.length} 个任务`}
              </p>
            </div>
          </div>
          {activeExam && !result && (
            <Button disabled={!allAnswered || submitting} onClick={submitExam}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              提交
            </Button>
          )}
        </div>

        {error && <p className="mb-3 text-sm text-red-600 dark:text-red-300">{error}</p>}

        {loading && !activeExam ? (
          <div className="flex items-center justify-center py-8 text-sm text-slate-500">
            <Loader2 className="mr-2 size-4 animate-spin" />
            加载中
          </div>
        ) : activeExam ? (
          <ExamQuestions
            answers={answers}
            disabled={!!result}
            questions={activeExam.questions}
            resultMap={resultMap}
            onSingle={setSingleAnswer}
            onToggleMultiple={toggleMultipleAnswer}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="rounded-lg border border-slate-100 p-4 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950 dark:text-slate-50">{exam.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {exam.questionCount} 题 · {exam.passThreshold}% ·{' '}
                      {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} 分钟` : '不限时'}
                    </p>
                  </div>
                  <Button onClick={() => startExam(exam)} size="icon" title="开始考核">
                    <PlayCircle className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {result && (
          <div
            className={cn(
              'mt-4 flex items-start gap-3 rounded-md border px-4 py-3',
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
                {result.attempt.passed ? '考核通过' : '考核未通过'}
              </p>
              <p className="text-xs opacity-80">
                得分 {result.attempt.score}%，第 {result.attempt.attemptNumber} 次提交
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ExamQuestions({
  questions,
  answers,
  resultMap,
  disabled,
  onSingle,
  onToggleMultiple,
}: {
  questions: PublicStageExamQuestion[];
  answers: AssessmentAnswers;
  resultMap: Map<string, StageExamAttemptDetail>;
  disabled: boolean;
  onSingle: (questionId: string, value: string) => void;
  onToggleMultiple: (questionId: string, value: string) => void;
}) {
  return (
    <div className="grid gap-3">
      {questions.map((question, index) => {
        const detail = resultMap.get(question.id);
        const currentAnswer = answers[question.id];
        return (
          <div
            key={question.id}
            className="rounded-lg border border-slate-100 p-4 dark:border-slate-800"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-950 dark:text-slate-50">
                {index + 1}. {question.question}
              </p>
              {detail &&
                (detail.correct ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : (
                  <XCircle className="size-4 text-red-500" />
                ))}
            </div>
            <div className="grid gap-2">
              {(question.options ?? []).map((option) => {
                const selected =
                  question.type === 'multiple'
                    ? Array.isArray(currentAnswer) && currentAnswer.includes(option.value)
                    : currentAnswer === option.value;
                return (
                  <label
                    key={option.value}
                    className={cn(
                      'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition',
                      selected
                        ? 'border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100'
                        : 'border-slate-100 text-slate-600 dark:border-slate-800 dark:text-slate-300',
                      disabled ? 'cursor-default' : 'cursor-pointer',
                    )}
                  >
                    <input
                      checked={selected}
                      disabled={disabled}
                      name={question.id}
                      onChange={() =>
                        question.type === 'multiple'
                          ? onToggleMultiple(question.id, option.value)
                          : onSingle(question.id, option.value)
                      }
                      type={question.type === 'multiple' ? 'checkbox' : 'radio'}
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
  );
}
