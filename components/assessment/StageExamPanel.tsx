'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  RefreshCw,
  Send,
  Timer,
  X,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AssessmentAnswers } from '@/lib/assessment/course-assessment';
import type { PublicStageExam, PublicStageExamQuestion } from '@/lib/exams/stage-exam';
import {
  countAnsweredExamQuestions,
  listLearnerExams,
  startLearnerExam,
  submitLearnerExam,
  type LearnerExamAttemptResult,
} from '@/lib/exams/learner-exam-client';
import type { EnterpriseExamPolicy } from '@/lib/storage/enterprise-service';
import type { SessionIdentity } from '@/lib/auth/types';

interface StageExamPanelProps {
  identity: SessionIdentity | null;
}

type ExamPhase = 'intro' | 'questions' | 'result';
type ListState = 'idle' | 'loading' | 'ready' | 'error';

export function StageExamPanel({ identity }: StageExamPanelProps) {
  const [exams, setExams] = useState<EnterpriseExamPolicy[]>([]);
  const [listState, setListState] = useState<ListState>('idle');
  const [listError, setListError] = useState<string | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<EnterpriseExamPolicy | null>(null);
  const [activeExam, setActiveExam] = useState<PublicStageExam | null>(null);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [result, setResult] = useState<LearnerExamAttemptResult | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [phase, setPhase] = useState<ExamPhase>('intro');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const dialogBodyRef = useRef<HTMLDivElement>(null);

  const loadExams = useCallback(async () => {
    if (!identity) {
      setExams([]);
      setListState('idle');
      return;
    }
    setListState('loading');
    setListError(null);
    try {
      setExams(await listLearnerExams());
      setListState('ready');
    } catch (error) {
      setListError(error instanceof Error ? error.message : '阶段考核加载失败');
      setListState('error');
    }
  }, [identity]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  useEffect(() => {
    dialogBodyRef.current?.scrollTo({ top: 0 });
  }, [phase]);

  const answered = useMemo(() => countAnsweredExamQuestions(answers), [answers]);
  const allAnswered =
    !!activeExam && activeExam.questions.length > 0 && answered === activeExam.questions.length;

  function openExam(policy: EnterpriseExamPolicy) {
    setSelectedPolicy(policy);
    setActiveExam(null);
    setAnswers({});
    setResult(null);
    setStartedAt(null);
    setDialogError(null);
    setPhase('intro');
    setDialogOpen(true);
  }

  function resetDialog() {
    setSelectedPolicy(null);
    setActiveExam(null);
    setAnswers({});
    setResult(null);
    setStartedAt(null);
    setDialogError(null);
    setPhase('intro');
  }

  function closeDialog() {
    setDialogOpen(false);
    resetDialog();
  }

  function requestClose() {
    if (starting || submitting) return;
    if (phase === 'result') return;
    if (phase === 'questions' && activeExam) {
      setConfirmExitOpen(true);
      return;
    }
    closeDialog();
  }

  async function startExam() {
    if (!selectedPolicy || starting) return;
    setStarting(true);
    setDialogError(null);
    try {
      const exam = await startLearnerExam(selectedPolicy.id);
      setActiveExam(exam);
      setAnswers({});
      setStartedAt(Date.now());
      setPhase('questions');
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : '阶段考核开始失败');
    } finally {
      setStarting(false);
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
    setDialogError(null);
    try {
      const durationSeconds = startedAt
        ? Math.max(1, Math.round((Date.now() - startedAt) / 1000))
        : null;
      const attemptResult = await submitLearnerExam(activeExam.policy.id, {
        answers,
        questionRefs: activeExam.questionRefs,
        durationSeconds,
      });
      setResult(attemptResult);
      setPhase('result');
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : '阶段考核提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  if (!identity) return null;

  return (
    <section className="mt-5" aria-label="阶段考核任务">
      {listState === 'loading' && (
        <div className="min-h-[220px] -rotate-1 rounded-sm bg-amber-100 p-6 shadow-[0_14px_28px_rgba(85,66,14,0.12)] dark:bg-amber-950/60">
          <div className="h-3 w-24 animate-pulse rounded bg-amber-200/70 dark:bg-amber-900" />
          <div className="mt-6 h-6 w-4/5 animate-pulse rounded bg-amber-200/70 dark:bg-amber-900" />
          <div className="mt-2 h-6 w-3/5 animate-pulse rounded bg-amber-200/70 dark:bg-amber-900" />
          <div className="mt-8 h-px w-full bg-amber-300/70 dark:bg-amber-900" />
          <div className="mt-5 h-3 w-2/3 animate-pulse rounded bg-amber-200/70 dark:bg-amber-900" />
        </div>
      )}

      {listState === 'error' && (
        <div className="border-y border-red-200 py-6 dark:border-red-950">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">考核任务加载失败</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{listError}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadExams()}
            className="mt-4 rounded-md"
          >
            <RefreshCw className="size-3.5" />
            重试
          </Button>
        </div>
      )}

      {listState === 'ready' && exams.length === 0 && (
        <div className="border-y border-slate-200 py-6 dark:border-slate-800">
          <ClipboardCheck className="size-5 text-slate-400" />
          <p className="mt-2 text-sm font-medium">暂无待完成考核</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            新考核发布后会显示在这里。
          </p>
        </div>
      )}

      {listState === 'ready' && exams.length > 0 && (
        <div className="space-y-5">
          {exams.map((exam) => (
            <button
              key={exam.id}
              type="button"
              onClick={() => openExam(exam)}
              className="group relative flex min-h-[220px] w-full -rotate-1 flex-col items-start overflow-hidden rounded-sm bg-[#f4d36f] px-6 pb-5 pt-7 text-left text-[#382e14] shadow-[0_14px_28px_rgba(85,66,14,0.16)] transition duration-200 after:absolute after:bottom-0 after:right-0 after:size-6 after:bg-[#d2ad46] after:[clip-path:polygon(100%_0,0_100%,100%_100%)] hover:rotate-0 hover:-translate-y-0.5 hover:shadow-[0_18px_34px_rgba(85,66,14,0.22)] focus-visible:rotate-0"
            >
              <span className="absolute right-4 top-3 size-2.5 rounded-full border-[3px] border-[#382e14]/35" />
              <span className="font-mono text-[10px] font-semibold">待完成考核</span>
              <strong className="mt-4 text-xl leading-7">{exam.title}</strong>
              <span className="my-4 h-px w-full bg-[#382e14]/25" />
              <span className="text-xs">
                {exam.questionCount} 道题 · {exam.passThreshold}% 通过
              </span>
              <span className="mt-1 text-xs">
                {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} 分钟` : '不限时'}
              </span>
              <span className="mt-auto flex w-full items-center justify-between pt-5 text-xs font-semibold">
                进入考核
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) requestClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[920px] flex-col gap-0 overflow-hidden rounded-lg p-0 sm:max-w-[920px] max-sm:left-0 max-sm:top-0 max-sm:h-[100dvh] max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none"
        >
          <DialogHeader className="flex min-h-20 flex-row items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 text-left dark:border-slate-800">
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-semibold text-violet-600 dark:text-violet-300">
                阶段考核
              </p>
              <DialogTitle className="mt-1 truncate text-lg font-semibold">
                {selectedPolicy?.title ?? '阶段考核'}
              </DialogTitle>
              <DialogDescription className="sr-only">
                完成阶段考核答题并查看提交结果
              </DialogDescription>
            </div>
            {phase !== 'result' && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={requestClose}
                aria-label="关闭考核"
                title="关闭考核"
              >
                <X className="size-4" />
              </Button>
            )}
          </DialogHeader>

          <div ref={dialogBodyRef} className="min-h-0 flex-1 overflow-y-auto">
            {phase === 'intro' && selectedPolicy && (
              <div className="grid min-h-[430px] md:grid-cols-[minmax(0,1.35fr)_minmax(250px,0.75fr)]">
                <div className="px-6 py-9 md:px-11 md:py-11">
                  <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
                    待完成
                  </span>
                  <h3 className="mt-4 text-2xl font-semibold leading-8">准备好后开始本次考核</h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                    题目来自当前岗位的已发布课程。提交后将立即评分，本次答题记录会计入考核结果。
                  </p>
                  <dl className="mt-8 border-t border-slate-200 text-sm dark:border-slate-800">
                    <ExamRule
                      label="题量"
                      value={`${selectedPolicy.questionCount} 道单选/多选题`}
                    />
                    <ExamRule label="通过线" value={`${selectedPolicy.passThreshold} 分`} />
                    <ExamRule
                      label="时限"
                      value={
                        selectedPolicy.timeLimitMinutes
                          ? `${selectedPolicy.timeLimitMinutes} 分钟`
                          : '不限时'
                      }
                    />
                  </dl>
                  {dialogError && <ExamError message={dialogError} />}
                </div>
                <div className="flex flex-col items-center justify-center border-t border-slate-200 bg-slate-50 px-7 py-8 text-center dark:border-slate-800 dark:bg-slate-900/60 md:border-l md:border-t-0">
                  <span className="grid size-20 place-items-center rounded-full border border-violet-200 bg-violet-50 text-3xl font-bold text-violet-700 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300">
                    考
                  </span>
                  <p className="my-6 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    开始后如需退出，系统会先要求确认；未提交答案不会计入成绩。
                  </p>
                  <Button
                    onClick={() => void startExam()}
                    disabled={starting}
                    className="w-full rounded-md"
                  >
                    {starting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4" />
                    )}
                    {starting ? '正在开始' : '开始答题'}
                  </Button>
                </div>
              </div>
            )}

            {phase === 'questions' && activeExam && (
              <div className="px-4 py-6 sm:px-8 sm:py-7">
                <div className="grid items-center gap-3 border-b border-slate-200 pb-5 dark:border-slate-800 sm:grid-cols-[auto_180px] sm:justify-between">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    答题进度{' '}
                    <b className="ml-1 font-mono text-sm text-slate-950 dark:text-white">
                      {answered} / {activeExam.questions.length}
                    </b>
                  </p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <span
                      className="block h-full rounded-full bg-violet-600 transition-[width] duration-200"
                      style={{ width: `${(answered / activeExam.questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div>
                  {activeExam.questions.map((question, index) => (
                    <ExamQuestion
                      key={question.id}
                      question={question}
                      index={index}
                      value={answers[question.id]}
                      onSingle={setSingleAnswer}
                      onMultiple={toggleMultipleAnswer}
                    />
                  ))}
                </div>

                {dialogError && <ExamError message={dialogError} />}
                <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {allAnswered
                      ? '全部题目已完成，可以提交。'
                      : `还有 ${activeExam.questions.length - answered} 道题未作答。`}
                  </p>
                  <Button
                    onClick={() => void submitExam()}
                    disabled={!allAnswered || submitting}
                    className="rounded-md"
                  >
                    {submitting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    {submitting ? '正在提交' : '提交答案'}
                  </Button>
                </div>
              </div>
            )}

            {phase === 'result' && result && (
              <div className="flex min-h-[470px] flex-col items-center justify-center px-6 py-10 text-center">
                <span
                  className={cn(
                    'grid size-20 place-items-center rounded-full border',
                    result.attempt.passed
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'border-red-200 bg-red-50 text-red-700 dark:border-red-950 dark:bg-red-950/40 dark:text-red-300',
                  )}
                >
                  {result.attempt.passed ? (
                    <CheckCircle2 className="size-9" />
                  ) : (
                    <XCircle className="size-9" />
                  )}
                </span>
                <p className="mt-5 font-mono text-[10px] font-semibold text-violet-600 dark:text-violet-300">
                  考核结果
                </p>
                <h3 className="mt-2 text-2xl font-semibold">
                  {result.attempt.passed ? '考核通过' : '未达到通过线'}
                </h3>
                <div className="mt-4 flex items-baseline text-violet-700 dark:text-violet-300">
                  <strong className="font-mono text-6xl leading-none">
                    {result.attempt.score}
                  </strong>
                  <span className="ml-1 text-sm">分</span>
                </div>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  {result.attempt.passed
                    ? `你已达到 ${result.attempt.threshold} 分通过线。`
                    : `本次未达到 ${result.attempt.threshold} 分通过线。`}
                </p>
                <div className="mt-7 flex flex-col border-y border-slate-200 py-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:py-3">
                  <span className="px-5 py-1">
                    第{' '}
                    <b className="font-mono text-slate-950 dark:text-white">
                      {result.attempt.attemptNumber}
                    </b>{' '}
                    次尝试
                  </span>
                  <span className="border-t border-slate-200 px-5 py-1 dark:border-slate-800 sm:border-l sm:border-t-0">
                    通过线{' '}
                    <b className="font-mono text-slate-950 dark:text-white">
                      {result.attempt.threshold}
                    </b>{' '}
                    分
                  </span>
                  <span className="border-t border-slate-200 px-5 py-1 dark:border-slate-800 sm:border-l sm:border-t-0">
                    <Timer className="mr-1 inline size-3.5" />
                    {result.attempt.duration ? `${result.attempt.duration} 秒` : '未记录用时'}
                  </span>
                </div>
                <Button onClick={closeDialog} className="mt-8 rounded-md">
                  完成并返回
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmExitOpen} onOpenChange={setConfirmExitOpen}>
        <AlertDialogContent className="rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>退出本次考核？</AlertDialogTitle>
            <AlertDialogDescription>当前答案尚未提交，退出后不会计入成绩。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续答题</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={closeDialog}>
              退出考核
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function ExamRule({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[90px_1fr] border-b border-slate-200 py-3 dark:border-slate-800">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="m-0 font-medium">{value}</dd>
    </div>
  );
}

function ExamError({ message }: { message: string }) {
  return (
    <div
      className="mt-5 border-l-2 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
      role="alert"
    >
      {message}
    </div>
  );
}

function ExamQuestion({
  question,
  index,
  value,
  onSingle,
  onMultiple,
}: {
  question: PublicStageExamQuestion;
  index: number;
  value: AssessmentAnswers[string] | undefined;
  onSingle: (questionId: string, value: string) => void;
  onMultiple: (questionId: string, value: string) => void;
}) {
  return (
    <section
      className="border-b border-slate-200 py-7 dark:border-slate-800"
      aria-labelledby={`exam-question-${question.id}`}
    >
      <p className="font-mono text-[10px] font-semibold text-violet-600 dark:text-violet-300">
        QUESTION {String(index + 1).padStart(2, '0')}
      </p>
      <h3 id={`exam-question-${question.id}`} className="mt-2 text-base font-semibold leading-6">
        {question.question}
      </h3>
      <div className="mt-4 grid gap-2">
        {(question.options ?? []).map((option, optionIndex) => {
          const selected =
            question.type === 'multiple'
              ? Array.isArray(value) && value.includes(option.value)
              : value === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                'grid cursor-pointer grid-cols-[18px_minmax(0,1fr)] items-center gap-2.5 rounded-md border px-3 py-3 text-sm transition-colors',
                selected
                  ? 'border-violet-500 bg-violet-50 text-violet-950 dark:bg-violet-950/45 dark:text-violet-100'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900/60',
              )}
            >
              <input
                checked={selected}
                name={question.id}
                type={question.type === 'multiple' ? 'checkbox' : 'radio'}
                onChange={() =>
                  question.type === 'multiple'
                    ? onMultiple(question.id, option.value)
                    : onSingle(question.id, option.value)
                }
                className="size-4 accent-violet-600"
              />
              <span>
                {String.fromCharCode(65 + optionIndex)}. {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}
