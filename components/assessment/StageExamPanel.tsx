'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Modal, Progress, Radio, Result, Skeleton } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { ArrowRight, ChevronDown, ClipboardCheck } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(true);
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

  function toggleMultipleAnswer(questionId: string, value: string[]) {
    setAnswers((current) => {
      return {
        ...current,
        [questionId]: value,
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

  if (listState === 'idle' || (listState === 'ready' && exams.length === 0)) return null;

  if (listState === 'loading') {
    return (
      <section
        className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm dark:border-slate-800 dark:bg-card-solid"
        aria-label="正在加载待办事项"
        aria-busy="true"
      >
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: 200 }} />
      </section>
    );
  }

  if (listState === 'error') {
    return (
      <section
        className="flex flex-col gap-3 rounded-xl border border-red-200 bg-white px-4 py-4 shadow-sm dark:border-red-950 dark:bg-card-solid sm:flex-row sm:items-center"
        aria-label="待办事项加载失败"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">考核任务加载失败</p>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{listError}</p>
        </div>
        <Button danger onClick={() => void loadExams()} className="shrink-0 sm:ml-auto">
          重试
        </Button>
      </section>
    );
  }

  return (
    <section aria-label="阶段考核任务">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-card-solid">
        <button
          type="button"
          className="flex min-h-14 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary dark:hover:bg-slate-900/60 sm:px-5"
          aria-expanded={expanded}
          aria-controls="learner-exam-tasks"
          onClick={() => setExpanded((current) => !current)}
        >
          <ClipboardCheck className="size-5 shrink-0 text-primary dark:text-primary/80" />
          <span className="font-semibold">待办事项</span>
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary dark:bg-primary/20 dark:text-primary">
            {exams.length}
          </span>
          <span className="hidden truncate text-sm text-slate-500 dark:text-slate-400 sm:block">
            当前有 {exams.length} 项阶段考核待完成
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="hidden sm:inline">{expanded ? '收起' : '展开'}</span>
            <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
          </span>
        </button>

        {expanded && (
          <div
            id="learner-exam-tasks"
            className="grid gap-4 border-t border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/20 sm:grid-cols-2 xl:grid-cols-3"
          >
            {exams.map((exam) => (
              <button
                key={exam.id}
                type="button"
                onClick={() => openExam(exam)}
                className="group flex min-h-40 w-full flex-col items-start rounded-lg border border-slate-200 bg-white p-4 text-left transition duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-card-solid dark:hover:border-primary dark:focus-visible:ring-offset-card-solid"
              >
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">
                  阶段考核任务
                </span>
                <strong className="mt-3 line-clamp-2 text-base leading-6">{exam.title}</strong>
                <span className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  {exam.questionCount} 道题 · {exam.passThreshold}% 通过
                </span>
                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} 分钟` : '不限时'}
                </span>
                <span className="mt-auto flex w-full items-center justify-between pt-4 text-xs font-semibold text-primary dark:text-primary/80">
                  进入考核
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        closable={phase !== 'result'}
        destroyOnHidden
        footer={null}
        maskClosable={false}
        onCancel={requestClose}
        open={dialogOpen}
        styles={{ body: { padding: 0 } }}
        title={
          <span className="text-base font-semibold">{selectedPolicy?.title ?? '阶段考核'}</span>
        }
        width="min(92vw, 920px)"
      >
        <div ref={dialogBodyRef} className="max-h-[calc(100dvh-220px)] min-h-[430px] overflow-y-auto">
          {phase === 'intro' && selectedPolicy && (
            <div className="grid md:grid-cols-[minmax(0,1.35fr)_minmax(250px,0.75fr)]">
              <div className="px-6 py-9 md:px-11 md:py-11">
                <span className="inline-flex rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-semibold text-primary dark:bg-primary/30 dark:text-primary">
                  待完成
                </span>
                <h3 className="mt-4 text-2xl font-semibold leading-8">准备好后开始本次考核</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  题目来自当前岗位的已发布课程。提交后将立即评分，本次答题记录会计入考核结果。
                </p>
                <dl className="mt-8 border-t border-slate-200 text-sm dark:border-slate-800">
                  <ExamRule label="题量" value={`${selectedPolicy.questionCount} 道单选/多选题`} />
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
                <span className="grid size-20 place-items-center rounded-full border border-primary/20 bg-primary/5 text-3xl font-bold text-primary dark:border-primary/30 dark:bg-primary/30 dark:text-primary">
                  考
                </span>
                <p className="my-6 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  开始后如需退出，系统会先要求确认；未提交答案不会计入成绩。
                </p>
                <Button block type="primary" onClick={() => void startExam()} disabled={starting}>
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
                <Progress
                  percent={Math.round((answered / activeExam.questions.length) * 100)}
                  showInfo={false}
                  strokeColor="var(--color-primary, #0058be)"
                />
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
                <Button type="primary" onClick={() => void submitExam()} disabled={!allAnswered || submitting}>
                  {submitting ? '正在提交' : '提交答案'}
                </Button>
              </div>
            </div>
          )}

          {phase === 'result' && result && (
            <Result
              extra={
                <Button type="primary" onClick={closeDialog}>
                  完成并返回
                </Button>
              }
              status={result.attempt.passed ? 'success' : 'error'}
              subTitle={
                <>
                  {result.attempt.passed
                    ? `你已达到 ${result.attempt.threshold} 分通过线。`
                    : `本次未达到 ${result.attempt.threshold} 分通过线。`}
                  <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      第 <b className="font-mono text-slate-950 dark:text-white">{result.attempt.attemptNumber}</b> 次尝试
                    </span>
                    <span>
                      通过线{' '}
                      <b className="font-mono text-slate-950 dark:text-white">{result.attempt.threshold}</b> 分
                    </span>
                    <span>
                      <ClockCircleOutlined className="mr-1" />
                      {result.attempt.duration ? `${result.attempt.duration} 秒` : '未记录用时'}
                    </span>
                  </div>
                </>
              }
              title={result.attempt.passed ? '考核通过' : '未达到通过线'}
            >
              <div className="mb-2 text-5xl font-bold text-primary dark:text-primary/80">
                {result.attempt.score}
                <span className="ml-1 text-base font-normal text-slate-500">分</span>
              </div>
            </Result>
          )}
        </div>
      </Modal>

      <Modal
        centered
        okButtonProps={{ danger: true }}
        okText="退出考核"
        onCancel={() => setConfirmExitOpen(false)}
        onOk={closeDialog}
        open={confirmExitOpen}
        title="退出本次考核？"
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          当前答案尚未提交，退出后不会计入成绩。
        </p>
      </Modal>
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
  onMultiple: (questionId: string, value: string[]) => void;
}) {
  const selected =
    question.type === 'multiple'
      ? (Array.isArray(value) ? value : []) as string[]
      : typeof value === 'string'
        ? [value]
        : [];
  const options = question.options ?? [];

  return (
    <section
      className="border-b border-slate-200 py-7 dark:border-slate-800"
      aria-labelledby={`exam-question-${question.id}`}
    >
      <p className="font-mono text-[10px] font-semibold text-primary dark:text-primary/80">
        第 {index + 1} 题
      </p>
      <h3 id={`exam-question-${question.id}`} className="mt-2 text-base font-semibold leading-6">
        {question.question}
      </h3>
      <div className="mt-4">
        {question.type === 'multiple' ? (
          <Checkbox.Group
            aria-label="多选题选项"
            className="grid gap-2"
            onChange={(values) => onMultiple(question.id, values)}
            options={options.map((option, optionIndex) => ({
              label: `${String.fromCharCode(65 + optionIndex)}. ${option.label}`,
              value: option.value,
            }))}
            value={selected}
          />
        ) : (
          <Radio.Group
            aria-label="单选题选项"
            className="grid gap-2"
            onChange={(event) => onSingle(question.id, event.target.value)}
            options={options.map((option, optionIndex) => ({
              label: `${String.fromCharCode(65 + optionIndex)}. ${option.label}`,
              value: option.value,
            }))}
            value={selected[0]}
          />
        )}
      </div>
    </section>
  );
}
