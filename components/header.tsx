'use client';

import { ArrowLeft, MessagesSquare } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useRouter } from 'next/navigation';
import type { StageMode } from '@/lib/types/stage';
import { isForumEnabled } from '@/lib/config/feature-flags';
import { HeaderControls } from './stage/header-controls';

interface HeaderProps {
  readonly currentSceneTitle: string;
  readonly mode?: StageMode;
  readonly canEdit?: boolean;
  readonly onToggleEditMode?: () => void;
  readonly discussionCourseId?: string | null;
}

export function Header({
  currentSceneTitle,
  mode,
  canEdit,
  onToggleEditMode,
  discussionCourseId,
}: HeaderProps) {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <>
      <header className="h-20 px-8 flex items-center justify-between z-10 bg-transparent gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            onClick={() => router.push('/')}
            className="shrink-0 p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title={t('generation.backToHome')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          {/* Title block — hidden when `mode === 'edit'`. Header lives
              inside `PlaybackChromeRoot`, which is unmounted by `Stage`
              once mode flips to 'edit', so in steady state this branch
              is always taken. The guard exists for the ~280ms
              AnimatePresence exit window where the playback chrome
              is still rendering its exit animation while `mode` has
              already flipped — without the guard, this title would
              briefly stack on top of the incoming EditChromeRoot's
              CommandBar title during the cross-fade. */}
          {mode !== 'edit' && (
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400 dark:text-gray-500 mb-0.5">
                {t('stage.currentScene')}
              </span>
              <h1
                className="text-xl font-bold text-gray-800 dark:text-gray-200 tracking-tight truncate"
                suppressHydrationWarning
              >
                {currentSceneTitle || t('common.loading')}
              </h1>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isForumEnabled() && discussionCourseId && mode !== 'edit' && (
            <button
              type="button"
              onClick={() =>
                router.push(
                  `/forum?view=course&courseId=${encodeURIComponent(discussionCourseId)}&compose=true`,
                )
              }
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/50 dark:text-violet-200 dark:hover:bg-violet-950"
              title="讨论本课程"
            >
              <MessagesSquare className="size-4" />
              <span className="hidden xl:inline">讨论本课程</span>
            </button>
          )}
          <HeaderControls mode={mode} canEdit={canEdit} onToggleEditMode={onToggleEditMode} />
        </div>
      </header>
    </>
  );
}
