'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Send, Volume2, VolumeX } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { DANMAKU_MAX_CONTENT_LENGTH, type DanmakuInputSource } from '@/lib/community/danmaku';
import { useAudioRecorder } from '@/lib/hooks/use-audio-recorder';
import { useI18n } from '@/lib/hooks/use-i18n';
import {
  danmakuScheduleChannel,
  playbackCursorChannel,
  type DanmakuDueEvent,
  type PlaybackCursorSnapshot,
} from '@/lib/playback';
import { cn } from '@/lib/utils';

const DANMAKU_PREFERENCE_KEY = 'openmaic-danmaku-enabled';
const DANMAKU_RECORDING_LIMIT_SECONDS = 20;
const DANMAKU_COOLDOWN_SECONDS = 2;

interface DanmakuOverlayProps {
  courseId: string;
  enabled: boolean;
}

interface VisibleDanmaku {
  key: string;
  content: string;
  lane: number;
  durationMs: number;
  optimistic?: boolean;
}

export function estimateDanmakuOffset(cursor: PlaybackCursorSnapshot, now = Date.now()): number {
  const elapsed = cursor.phase === 'playing' ? (now - cursor.emittedAt) * cursor.playbackRate : 0;
  return Math.max(0, Math.round(cursor.actionOffsetMs + elapsed));
}

export function getDanmakuDuration(content: string): number {
  return Math.min(12_000, 5_000 + content.length * 80);
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

export function DanmakuOverlay({ courseId, enabled }: DanmakuOverlayProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState<VisibleDanmaku[]>([]);
  const [laneCount, setLaneCount] = useState(getLaneCount);
  const [cursor, setCursor] = useState<PlaybackCursorSnapshot | null>(
    () => playbackCursorChannel.getLatest()?.cursor ?? null,
  );
  const [danmakuEnabled, setDanmakuEnabled] = useState(true);
  const [draft, setDraft] = useState('');
  const [inputSource, setInputSource] = useState<DanmakuInputSource>('text');
  const [isSending, setIsSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const addVisible = useCallback(
    (event: DanmakuDueEvent, optimistic = false) => {
      if (!enabled || !danmakuEnabled || event.courseId !== courseId) return;
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
    [courseId, danmakuEnabled, enabled, laneCount],
  );

  useEffect(() => {
    try {
      setDanmakuEnabled(localStorage.getItem(DANMAKU_PREFERENCE_KEY) !== 'false');
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
    if (!enabled || !danmakuEnabled) setVisible([]);
  }, [danmakuEnabled, enabled]);

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
    requestAnimationFrame(() => inputRef.current?.focus());
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
    if (!enabled && isRecording) cancelRecording();
  }, [cancelRecording, enabled, isRecording]);

  const anchoredCursor =
    cursor?.courseId === courseId && cursor.sceneKey && cursor.actionId ? cursor : null;
  const canSend =
    enabled && danmakuEnabled && !!anchoredCursor && !!draft.trim() && !isSending && cooldown === 0;

  const handleSend = useCallback(async () => {
    const activeCursor = playbackCursorChannel.getLatest()?.cursor ?? cursor;
    const content = draft.trim();
    if (
      !content ||
      !enabled ||
      !danmakuEnabled ||
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
    danmakuEnabled,
    draft,
    enabled,
    inputSource,
    isSending,
    laneCount,
    t,
  ]);

  const toggleDanmaku = (checked: boolean) => {
    setDanmakuEnabled(checked);
    try {
      localStorage.setItem(DANMAKU_PREFERENCE_KEY, String(checked));
    } catch {
      // The preference remains valid for the current page when storage is unavailable.
    }
  };

  if (!enabled) return null;

  const phase = cursor?.phase;
  const animationPaused = phase !== 'playing';
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

  return (
    <div className="absolute inset-0 z-[90] pointer-events-none" data-testid="danmaku-overlay">
      {danmakuEnabled && (
        <div className="absolute inset-x-0 top-0 bottom-[18%] overflow-hidden" aria-hidden="true">
          {visible.map((item) => (
            <span
              key={item.key}
              className={cn(
                'danmaku-item absolute left-full max-w-[75%] whitespace-nowrap rounded-full',
                'bg-gray-950/55 px-3 py-1 text-[clamp(12px,1.35vw,18px)] font-medium text-white',
                'shadow-[0_1px_5px_rgba(0,0,0,0.45)] backdrop-blur-[2px]',
                item.optimistic && 'ring-1 ring-violet-300/70',
              )}
              style={{
                top: `${8 + item.lane * (72 / laneCount)}%`,
                animationDuration: `${item.durationMs}ms`,
                animationPlayState: animationPaused ? 'paused' : 'running',
              }}
              onAnimationEnd={() =>
                setVisible((current) => current.filter((candidate) => candidate.key !== item.key))
              }
            >
              {item.content}
            </span>
          ))}
        </div>
      )}

      <div
        className={cn(
          'absolute inset-x-2 bottom-2 pointer-events-auto',
          'flex items-center gap-1.5 rounded-xl border border-white/30 bg-gray-950/62 p-1.5',
          'shadow-lg backdrop-blur-md sm:inset-x-[8%] sm:gap-2 sm:p-2',
        )}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <label className="flex shrink-0 items-center gap-1.5 px-1 text-xs font-medium text-white">
          {danmakuEnabled ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          <span className="hidden sm:inline">{t('danmaku.toggle')}</span>
          <Switch
            checked={danmakuEnabled}
            onCheckedChange={toggleDanmaku}
            aria-label={t('danmaku.toggle')}
            className="data-[state=checked]:bg-violet-500"
          />
        </label>

        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            value={draft}
            maxLength={DANMAKU_MAX_CONTENT_LENGTH}
            disabled={!danmakuEnabled}
            aria-label={t('danmaku.inputLabel')}
            placeholder={t('danmaku.placeholder')}
            className={cn(
              'h-8 w-full rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white',
              'placeholder:text-white/50 outline-none transition focus:border-violet-300/70 focus:bg-white/15',
              'disabled:cursor-not-allowed disabled:opacity-45',
            )}
            onChange={(event) => {
              setDraft(event.target.value);
              if (!event.target.value) setInputSource('text');
              setStatus('');
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
          <div
            className="mt-0.5 flex min-h-3 items-center justify-between px-1 text-[10px] text-white/65"
            aria-live="polite"
          >
            <span className="truncate">{statusText}</span>
            <span className="ml-2 shrink-0">
              {draft.length}/{DANMAKU_MAX_CONTENT_LENGTH}
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={!danmakuEnabled || isProcessing}
          aria-label={isRecording ? t('danmaku.stopRecording') : t('danmaku.startRecording')}
          aria-pressed={isRecording}
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-lg text-white transition',
            voiceBusy ? 'bg-rose-500' : 'bg-white/12 hover:bg-white/20',
            'disabled:cursor-not-allowed disabled:opacity-45',
          )}
          onClick={() => {
            setStatus('');
            if (isRecording) stopRecording();
            else void startRecording();
          }}
        >
          {isProcessing ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Mic className="size-4" />
          )}
        </button>

        <button
          type="button"
          disabled={!canSend}
          aria-label={t('danmaku.send')}
          className={cn(
            'flex h-8 shrink-0 items-center gap-1 rounded-lg bg-violet-500 px-2.5 text-xs font-semibold text-white',
            'transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-45',
          )}
          onClick={() => void handleSend()}
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Send className="size-4" />
          )}
          <span className="hidden sm:inline">{t('danmaku.send')}</span>
        </button>
      </div>
    </div>
  );
}
