'use client';

import { motion } from 'motion/react';
import { Check, CheckCircle2, XCircle } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { cn } from '@/lib/utils';

export interface ChoiceQuestionCardQuestion {
  id: string;
  type: 'single' | 'multiple' | 'short_answer';
  question: string;
  options?: Array<{ label: string; value: string }>;
  points?: number;
  answer?: string[];
  analysis?: string;
}

interface ChoiceQuestionCardProps {
  question: ChoiceQuestionCardQuestion;
  index: number;
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  disabled?: boolean;
  result?: { status: 'correct' | 'incorrect' };
  correctAnswer?: string[];
  analysis?: string;
}

/** Shared learner-facing choice card used by in-course quizzes and course assessments. */
export function ChoiceQuestionCard({
  question,
  index,
  value,
  onChange,
  disabled,
  result,
  correctAnswer = question.answer,
  analysis = question.analysis,
}: ChoiceQuestionCardProps) {
  const { t } = useI18n();
  if (question.type === 'short_answer') return null;
  const isReview = !!result;
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const multiple = question.type === 'multiple';
  const pts = question.points ?? 1;

  function select(optionValue: string) {
    if (disabled) return;
    if (!multiple) {
      onChange(optionValue);
      return;
    }
    onChange(
      selected.includes(optionValue)
        ? selected.filter((item) => item !== optionValue)
        : [...selected, optionValue],
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-white p-5 dark:bg-gray-800',
        !isReview && 'border-gray-150 shadow-sm dark:border-gray-700',
        isReview &&
          result.status === 'correct' &&
          'border-emerald-200 shadow-sm shadow-emerald-50 dark:border-emerald-800 dark:shadow-emerald-900/20',
        isReview &&
          result.status === 'incorrect' &&
          'border-red-200 shadow-sm shadow-red-50 dark:border-red-800 dark:shadow-red-900/20',
      )}
    >
      <div
        className={cn(
          'absolute inset-y-0 left-0 w-1 rounded-l-2xl',
          !isReview && 'bg-violet-400',
          isReview && result.status === 'correct' && 'bg-emerald-400',
          isReview && result.status === 'incorrect' && 'bg-red-400',
        )}
      />

      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
              !isReview &&
                'bg-violet-100 text-violet-600 dark:bg-violet-900/50 dark:text-violet-400',
              isReview &&
                result.status === 'correct' &&
                'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400',
              isReview &&
                result.status === 'incorrect' &&
                'bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400',
            )}
          >
            {index + 1}
          </span>
          <div>
            <p className="text-sm font-medium leading-relaxed text-gray-800 dark:text-gray-100">
              {question.question}
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              {multiple ? t('quiz.multipleChoice') : t('quiz.singleChoice')}
              {' · '}
              {pts} {t('quiz.pointsSuffix')}
            </p>
          </div>
        </div>
        {isReview && (
          <div className="ml-2 shrink-0">
            {result.status === 'correct' ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            ) : (
              <XCircle className="h-6 w-6 text-red-400" />
            )}
          </div>
        )}
      </div>

      {multiple && !isReview && (
        <p className="mb-2 text-xs text-gray-400 dark:text-gray-500">
          {t('quiz.multipleChoiceHint')}
        </p>
      )}
      <div className="grid gap-2">
        {question.options?.map((option) => {
          const isSelected = selected.includes(option.value);
          const isCorrectOption = isReview && correctAnswer?.includes(option.value);
          const isWrong = isReview && isSelected && !isCorrectOption;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => select(option.value)}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all',
                !isReview &&
                  !isSelected &&
                  'border-gray-200 hover:border-violet-200 hover:bg-violet-50/50 dark:border-gray-600 dark:hover:border-violet-700 dark:hover:bg-violet-900/30',
                !isReview &&
                  isSelected &&
                  'border-violet-400 bg-violet-50 ring-1 ring-violet-200 dark:bg-violet-900/30 dark:ring-violet-700',
                isReview &&
                  isCorrectOption &&
                  'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/30',
                isWrong && 'border-red-300 bg-red-50 dark:bg-red-900/30',
                isReview &&
                  !isCorrectOption &&
                  !isSelected &&
                  'border-gray-100 opacity-60 dark:border-gray-700',
                disabled && !isReview && 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold transition-colors',
                  multiple ? 'rounded-lg' : 'rounded-full',
                  !isReview &&
                    !isSelected &&
                    'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
                  !isReview && isSelected && 'bg-violet-500 text-white',
                  isCorrectOption && 'bg-emerald-500 text-white',
                  isWrong && 'bg-red-400 text-white',
                  isReview &&
                    !isCorrectOption &&
                    !isSelected &&
                    'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
                )}
              >
                {multiple && !isReview && isSelected ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  option.value
                )}
              </span>
              <span
                className={cn(
                  'flex-1',
                  isReview && !isCorrectOption && !isSelected && 'text-gray-400 dark:text-gray-500',
                )}
              >
                {option.label}
              </span>
              {isCorrectOption && <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />}
              {isWrong && <XCircle className="h-5 w-5 shrink-0 text-red-400" />}
            </button>
          );
        })}
      </div>

      {isReview && analysis && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs leading-relaxed text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          <span className="font-medium">{t('quiz.analysis')}</span>
          {analysis}
        </div>
      )}
    </motion.div>
  );
}
