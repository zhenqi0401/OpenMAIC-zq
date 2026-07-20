'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Captions, Loader2, Mic, Send } from 'lucide-react';
import { toast } from 'sonner';
import { DANMAKU_MAX_CONTENT_LENGTH, type DanmakuInputSource } from '@/lib/community/danmaku';
import { useAudioRecorder } from '@/lib/hooks/use-audio-recorder';
import { useI18n } from '@/lib/hooks/use-i18n';
import {
  danmakuScheduleChannel,
  getDanmakuDuration,
  playbackCursorChannel,
  type DanmakuDueEvent,
  type DanmakuGateResult,
  type PlaybackCursorSnapshot,
} from '@/lib/playback';
import { cn } from '@/lib/utils';

const DANMAKU_PREFERENCE_KEY = 'openmaic-danmaku-enabled';
const DANMAKU_RECORDING_LIMIT_SECONDS = 20;
const DANMAKU_COOLDOWN_SECONDS = 2;

interface DanmakuProviderProps {
  readonly courseId: string | null;
  readonly featureAvailable: boolean;
  readonly gate: DanmakuGateResult;
  readonly children: ReactNode;
}

interface VisibleDanmaku {
  key: string;
  content: string;
  lane: number;
  durationMs: number;
  optimistic?: boolean;
}

interface DanmakuContextValue {
  featureAvailable: boolean;
  gate: DanmakuGateResult;
  userEnabled: boolean;
  composerVisible: boolean;
  interactionActive: boolean;
  visible: VisibleDanmaku[];
  laneCount: number;
  animationPaused: boolean;
  draft: string;
  canSend: boolean;
  isSending: boolean;
  isRecording: boolean;
  isProcessing: boolean;
  voiceBusy: boolean;
  statusText: string;
  transcriptionVersion: number;
  toggleDanmaku: () => void;
  setDraftValue: (value: string) => void;
  setComposerFocused: (focused: boolean) => void;
  handleVoiceClick: () => void;
  handleSend: () => Promise<void>;
  removeVisible: (key: string) => void;
}

const DanmakuContext = createContext<DanmakuContextValue | null>(null);

export function estimateDanmakuOffset(cursor: PlaybackCursorSnapshot, now = Date.now()): number {
  const elapsed = cursor.phase === 'playing' ? (now - cursor.emittedAt) * cursor.playbackRate : 0;
  return Math.max(0, Math.round(cursor.actionOffsetMs + elapsed));
}

function getLaneCount(): number {
  if (typeof window === 'undefined') return 8;
  if (window.innerWidth < 640) return 4;
  if (window.innerWidth < 1024) return 6;
  return 8;
}

function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function useDanmakuControls(): DanmakuContextValue | null {
  return useContext(DanmakuContext);
}

export function DanmakuProvider({
  courseId,
  featureAvailable,
  gate,
  children,
}: DanmakuProviderProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState<VisibleDanmaku[]>([]);
  const [laneCount, setLaneCount] = useState(getLaneCount);
  const [cursor, setCursor] = useState<PlaybackCursorSnapshot | null>(
    () => playbackCursorChannel.getLatest()?.cursor ?? null,
  );
  const [userEnabled, setUserEnabled] = useState(true);
  const [draft, setDraft] = useState('');
  const [inputSource, setInputSource] = useState<DanmakuInputSource>('text');
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);
  const [transcriptionVersion, setTranscriptionVersion] = useState(0);
  const playbackEnabled = featureAvailable && gate.enabled;

  const addVisible = useCallback(
    (event: DanmakuDueEvent, optimistic = false) => {
      if (!playbackEnabled || !userEnabled || !courseId || event.courseId !== courseId) return;
      const key = optimistic ? `optimistic-${createClientRequestId()}` : event.danmaku.id;
      setVisible((current) => {
        if (!optimistic && current.some((item) => item.key === key)) return current;
        const maxVisible = laneCount <= 4 ? 6 : 12;
        return [
          ...current.slice(-(maxVisible - 1)),
          {
            key,
            content: event.danmaku.content,
            lane: event.lane % laneCount,
            durationMs: getDanmakuDuration(event.danmaku.content),
            optimistic,
          },
        ];
      });
    },
    [courseId, laneCount, playbackEnabled, userEnabled],
  );

  useEffect(() => {
    try {
      setUserEnabled(localStorage.getItem(DANMAKU_PREFERENCE_KEY) !== 'false');
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setLaneCount(getLaneCount());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => danmakuScheduleChannel.subscribe((event) => addVisible(event)), [addVisible]);

  useEffect(
    () =>
      playbackCursorChannel.subscribe((event) => {
        setCursor(event.cursor);
        if (
          event.reason === 'scene-change' ||
          event.reason === 'discussion-start' ||
          event.reason === 'complete' ||
          event.reason === 'stop'
        ) {
          setVisible([]);
        }
      }),
    [],
  );

  useEffect(() => {
    if (!playbackEnabled || !userEnabled) setVisible([]);
  }, [playbackEnabled, userEnabled]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleTranscription = useCallback((text: string) => {
    const normalized = text.trim();
    if (!normalized) return;
    setDraft((current) =>
      `${current}${current && !/\s$/.test(current) ? ' ' : ''}${normalized}`.slice(
        0,
        DANMAKU_MAX_CONTENT_LENGTH,
      ),
    );
    setInputSource('voice');
    setStatus('');
    setTranscriptionVersion((version) => version + 1);
  }, []);

  const handleVoiceError = useCallback((message: string) => {
    setStatus(message);
    toast.error(message);
  }, []);

  const {
    isRecording,
    isProcessing,
    recordingTime,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder({
    onTranscription: handleTranscription,
    onError: handleVoiceError,
  });

  useEffect(() => {
    if (isRecording && recordingTime >= DANMAKU_RECORDING_LIMIT_SECONDS) stopRecording();
  }, [isRecording, recordingTime, stopRecording]);

  useEffect(() => {
    if ((!playbackEnabled || !userEnabled) && isRecording) cancelRecording();
  }, [cancelRecording, isRecording, playbackEnabled, userEnabled]);

  const anchoredCursor =
    cursor?.courseId === courseId && cursor.sceneKey && cursor.actionId ? cursor : null;
  const canSend =
    playbackEnabled &&
    userEnabled &&
    !!anchoredCursor &&
    !!draft.trim() &&
    !isSending &&
    cooldown === 0;

  const handleSend = useCallback(async () => {
    const activeCursor = playbackCursorChannel.getLatest()?.cursor ?? cursor;
    const content = draft.trim();
    if (
      !content ||
      !courseId ||
      !playbackEnabled ||
      !userEnabled ||
      !activeCursor ||
      activeCursor.courseId !== courseId ||
      !activeCursor.sceneKey ||
      !activeCursor.actionId ||
      isSending ||
      cooldown > 0
    ) {
      return;
    }

    const optimisticKey = `optimistic-${createClientRequestId()}`;
    const lane = Math.floor(Math.random() * laneCount);
    setVisible((current) => [
      ...current.slice(-(laneCount <= 4 ? 5 : 11)),
      {
        key: optimisticKey,
        content,
        lane,
        durationMs: getDanmakuDuration(content),
        optimistic: true,
      },
    ]);
    setIsSending(true);
    setStatus(t('danmaku.sending'));

    try {
      const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}/danmaku`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': createClientRequestId(),
        },
        body: JSON.stringify({
          sceneKey: activeCursor.sceneKey,
          actionId: activeCursor.actionId,
          actionOffsetMs: estimateDanmakuOffset(activeCursor),
          content,
          inputSource,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string | { message?: string };
          message?: string;
        } | null;
        const apiMessage =
          typeof body?.error === 'string' ? body.error : body?.error?.message || body?.message;
        throw new Error(apiMessage || t('danmaku.sendFailed'));
      }
      setDraft('');
      setInputSource('text');
      setCooldown(DANMAKU_COOLDOWN_SECONDS);
      setStatus(t('danmaku.sent'));
    } catch (error) {
      setVisible((current) => current.filter((item) => item.key !== optimisticKey));
      const message = error instanceof Error ? error.message : t('danmaku.sendFailed');
      setStatus(message);
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  }, [
    cooldown,
    courseId,
    cursor,
    draft,
    inputSource,
    isSending,
    laneCount,
    playbackEnabled,
    t,
    userEnabled,
  ]);

  const toggleDanmaku = useCallback(() => {
    const next = !userEnabled;
    setUserEnabled(next);
    if (!next) {
      setVisible([]);
      setComposerFocused(false);
      if (isRecording) cancelRecording();
    }
    try {
      localStorage.setItem(DANMAKU_PREFERENCE_KEY, String(next));
    } catch {
      // The preference remains valid for the current page when storage is unavailable.
    }
  }, [cancelRecording, isRecording, userEnabled]);

  const setDraftValue = useCallback((value: string) => {
    setDraft(value);
    if (!value) setInputSource('text');
    setStatus('');
  }, []);

  const handleVoiceClick = useCallback(() => {
    setStatus('');
    if (isRecording) stopRecording();
    else void startRecording();
  }, [isRecording, startRecording, stopRecording]);

  const removeVisible = useCallback((key: string) => {
    setVisible((current) => current.filter((item) => item.key !== key));
  }, []);

  const phase = cursor?.phase;
  const voiceBusy = isRecording || isProcessing;
  const statusText = isRecording
    ? t('danmaku.recording', {
        seconds: recordingTime,
        limit: DANMAKU_RECORDING_LIMIT_SECONDS,
      })
    : isProcessing
      ? t('danmaku.transcribing')
      : cooldown > 0
        ? t('danmaku.cooldown', { seconds: cooldown })
        : status || (!anchoredCursor ? t('danmaku.waitingForPlayback') : '');
  const composerVisible = playbackEnabled && userEnabled;
  const interactionActive = composerFocused || isRecording || isProcessing || isSending;

  const value = useMemo<DanmakuContextValue>(
    () => ({
      featureAvailable,
      gate,
      userEnabled,
      composerVisible,
      interactionActive,
      visible,
      laneCount,
      animationPaused: phase !== 'playing',
      draft,
      canSend,
      isSending,
      isRecording,
      isProcessing,
      voiceBusy,
      statusText,
      transcriptionVersion,
      toggleDanmaku,
      setDraftValue,
      setComposerFocused,
      handleVoiceClick,
      handleSend,
      removeVisible,
    }),
    [
      canSend,
      composerVisible,
      draft,
      featureAvailable,
      gate,
      handleSend,
      handleVoiceClick,
      interactionActive,
      isProcessing,
      isRecording,
      isSending,
      laneCount,
      phase,
      removeVisible,
      setDraftValue,
      statusText,
      toggleDanmaku,
      transcriptionVersion,
      userEnabled,
      visible,
      voiceBusy,
    ],
  );

  return <DanmakuContext.Provider value={value}>{children}</DanmakuContext.Provider>;
}

export function DanmakuOverlay() {
  const danmaku = useDanmakuControls();
  if (!danmaku?.featureAvailable || !danmaku.gate.enabled) return null;

  return (
    <div className="absolute inset-0 z-[30] pointer-events-none" data-testid="danmaku-overlay">
      {danmaku.userEnabled && (
        <div className="absolute inset-x-0 top-0 bottom-[22%] overflow-hidden" aria-hidden="true">
          {danmaku.visible.map((item) => (
            <span
              key={item.key}
              className={cn(
                'danmaku-item absolute left-full max-w-[75%] whitespace-nowrap rounded-full',
                'bg-gray-950/55 px-3 py-1 text-[clamp(12px,1.35vw,18px)] font-medium text-white',
                'shadow-[0_1px_5px_rgba(0,0,0,0.45)] backdrop-blur-[2px]',
                item.optimistic && 'ring-1 ring-violet-300/70',
              )}
              data-duration-ms={item.durationMs}
              style={{
                top: `${8 + item.lane * (72 / danmaku.laneCount)}%`,
                animationDuration: `${item.durationMs}ms`,
                animationPlayState: danmaku.animationPaused ? 'paused' : 'running',
              }}
              onAnimationEnd={() => danmaku.removeVisible(item.key)}
            >
              {item.content}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function DanmakuComposer({ className }: { readonly className?: string }) {
  const { t } = useI18n();
  const danmaku = useDanmakuControls();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const setComposerFocused = danmaku?.setComposerFocused;
  const transcriptionVersion = danmaku?.transcriptionVersion ?? 0;
  const lastTranscriptionVersionRef = useRef(transcriptionVersion);

  useEffect(
    () => () => {
      setComposerFocused?.(false);
    },
    [setComposerFocused],
  );

  useEffect(() => {
    if (transcriptionVersion > lastTranscriptionVersionRef.current) inputRef.current?.focus();
    lastTranscriptionVersionRef.current = transcriptionVersion;
  }, [transcriptionVersion]);

  if (!danmaku?.composerVisible) return null;

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative flex h-11 w-full max-w-[520px] items-center gap-1.5 rounded-full',
        'border border-gray-200/70 bg-white/82 p-1.5 text-gray-700',
        'shadow-[0_8px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl',
        'dark:border-white/12 dark:bg-black/62 dark:text-gray-100 dark:shadow-[0_8px_30px_rgba(0,0,0,0.42)]',
        className,
      )}
      data-testid="danmaku-composer"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      onFocusCapture={() => danmaku.setComposerFocused(true)}
      onBlurCapture={() => {
        requestAnimationFrame(() => {
          danmaku.setComposerFocused(!!rootRef.current?.contains(document.activeElement));
        });
      }}
    >
      <div className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 sm:flex dark:bg-violet-400/12 dark:text-violet-300">
        <Captions className="size-4" />
      </div>

      <div className="flex h-8 min-w-0 flex-1 items-center rounded-full bg-gray-100/75 px-3 ring-1 ring-transparent transition focus-within:bg-white focus-within:ring-violet-300/70 dark:bg-white/8 dark:focus-within:bg-white/12 dark:focus-within:ring-violet-500/55">
        <input
          ref={inputRef}
          value={danmaku.draft}
          maxLength={DANMAKU_MAX_CONTENT_LENGTH}
          aria-label={t('danmaku.inputLabel')}
          placeholder={t('danmaku.placeholder')}
          className="h-full min-w-0 flex-1 bg-transparent text-xs text-gray-800 outline-none placeholder:text-gray-400 sm:text-sm dark:text-white dark:placeholder:text-gray-500"
          onChange={(event) => danmaku.setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void danmaku.handleSend();
            }
          }}
        />
        <span
          className={cn(
            'ml-1 shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500',
            danmaku.draft.length < 160 && 'hidden sm:inline',
            danmaku.draft.length >= 190 && 'text-amber-500 dark:text-amber-400',
          )}
        >
          {danmaku.draft.length}/{DANMAKU_MAX_CONTENT_LENGTH}
        </span>
      </div>

      <button
        type="button"
        disabled={danmaku.isProcessing}
        aria-label={danmaku.isRecording ? t('danmaku.stopRecording') : t('danmaku.startRecording')}
        aria-pressed={danmaku.isRecording}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full transition active:scale-95',
          danmaku.voiceBusy
            ? 'bg-rose-500 text-white shadow-[0_0_0_4px_rgba(244,63,94,0.12)]'
            : 'text-gray-500 hover:bg-gray-100 hover:text-violet-600 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-violet-300',
          'disabled:cursor-not-allowed disabled:opacity-45',
        )}
        onClick={danmaku.handleVoiceClick}
      >
        {danmaku.isProcessing ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Mic className="size-4" />
        )}
      </button>

      <button
        type="button"
        disabled={!danmaku.canSend}
        aria-label={t('danmaku.send')}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white',
          'shadow-[0_4px_14px_rgba(124,58,237,0.3)] transition hover:bg-violet-500 active:scale-95',
          'disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none dark:disabled:bg-white/12 dark:disabled:text-gray-500',
        )}
        onClick={() => void danmaku.handleSend()}
      >
        {danmaku.isSending ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <Send className="size-3.5" />
        )}
      </button>

      <span className="sr-only" aria-live="polite">
        {danmaku.statusText}
      </span>
      {danmaku.statusText && (
        <span className="pointer-events-none absolute bottom-full left-3 mb-1 max-w-[calc(100%-1.5rem)] truncate rounded-full border border-gray-200/70 bg-white/90 px-2.5 py-1 text-[10px] text-gray-500 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-gray-900/90 dark:text-gray-300">
          {danmaku.statusText}
        </span>
      )}
    </div>
  );
}

export { getDanmakuDuration } from '@/lib/playback/danmaku-motion';
