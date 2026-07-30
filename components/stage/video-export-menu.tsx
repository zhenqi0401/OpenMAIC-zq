'use client';

import { useEffect, useState } from 'react';
import { Film, Loader2, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useRenderVideo } from '@/lib/video-export-app/use-render-video';

function formatRemaining(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

export function VideoExportMenu({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const {
    status,
    rendering,
    percent,
    etaMs,
    framesRendered,
    totalFrames,
    renderVideo,
    cancelVideo,
  } = useRenderVideo();
  const [serviceEnabled, setServiceEnabled] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let active = true;
    fetch('/api/export-video/capability', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: { enabled?: boolean }) => {
        if (active) setServiceEnabled(Boolean(data.enabled));
      })
      .catch(() => {
        if (active) setServiceEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const statusLabel = t(`export.videoStatus_${status}`);

  return (
    <>
      <div className="border-t border-gray-200 dark:border-gray-700" />
      <div className="px-3 py-2.5">
        <button
          type="button"
          onClick={() => {
            void renderVideo();
            onClose();
          }}
          disabled={serviceEnabled !== true || rendering}
          className="flex w-full items-center gap-2.5 rounded-md px-1 py-1 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        >
          {rendering ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" />
          ) : (
            <Film className="h-4 w-4 shrink-0 text-gray-400" />
          )}
          <span className="min-w-0 flex-1">
            <span className="block">{t('export.videoRenderMp4')}</span>
            <span className="block text-[11px] text-gray-400 dark:text-gray-500">
              {serviceEnabled === false
                ? t('export.videoServiceUnavailable')
                : t('export.videoDesc')}
            </span>
          </span>
        </button>

        {rendering && (
          <div className="mt-2 space-y-1.5">
            <Progress value={percent} />
            <div className="flex items-center justify-between gap-2 text-[11px] text-gray-400 dark:text-gray-500">
              <span>
                {statusLabel} · {percent}%
                {framesRendered != null && totalFrames != null
                  ? ` · ${framesRendered}/${totalFrames}`
                  : ''}
                {etaMs != null ? ` · ETA ${formatRemaining(etaMs)}` : ''}
              </span>
              <button
                type="button"
                onClick={() => void cancelVideo()}
                className="inline-flex shrink-0 items-center gap-1 text-red-500 hover:text-red-600"
              >
                <X className="h-3 w-3" />
                {t('export.videoCancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
