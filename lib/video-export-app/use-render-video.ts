'use client';

import { useCallback } from 'react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useVideoRenderStore } from '@/lib/store/video-render';

export function useRenderVideo() {
  const { t } = useI18n();
  const state = useVideoRenderStore();
  const renderVideo = useCallback(() => state.startRender(t), [state, t]);
  const cancelVideo = useCallback(() => state.cancel(t), [state, t]);

  return {
    ...state,
    rendering: state.isActive(),
    renderVideo,
    cancelVideo,
  };
}
