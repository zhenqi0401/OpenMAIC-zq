'use client';

import { create } from 'zustand';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import {
  buildExportZip,
  NoScenesError,
  sanitizeFilename,
  VIDEO_EXPORT_SETTINGS,
} from '@/lib/video-export-app/build-export-zip';

const log = createLogger('VideoRenderStore');
const DEFAULT_POLL_MS = 3000;
const MAX_POLL_MS = 60 * 60 * 1000;

export type VideoRenderStatus =
  | 'idle'
  | 'compiling'
  | 'uploading'
  | 'queued'
  | 'rendering'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

type Translate = (key: string, options?: Record<string, unknown>) => string;

interface SubmitResponse {
  jobId?: string;
  pollIntervalMs?: number;
  error?: string;
  message?: string;
}

interface JobStatusResponse {
  jobId?: string;
  status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  progress?: number;
  currentStage?: string;
  framesRendered?: number;
  totalFrames?: number;
  error?: string;
  pollIntervalMs?: number;
}

interface VideoRenderState {
  status: VideoRenderStatus;
  percent: number;
  etaMs: number | null;
  filename: string | null;
  jobId: string | null;
  framesRendered: number | null;
  totalFrames: number | null;
  error: string | null;
  isActive: () => boolean;
  startRender: (t: Translate) => Promise<void>;
  cancel: (t: Translate) => Promise<void>;
  reset: () => void;
}

let activeRun = 0;
let activeUpload: XMLHttpRequest | null = null;
let activePoll: AbortController | null = null;
let activeToastId: string | number | null = null;

function inFlight(status: VideoRenderStatus): boolean {
  return ['compiling', 'uploading', 'queued', 'rendering'].includes(status);
}

function submitProject(zip: Blob, onProgress: (percent: number) => void): Promise<SubmitResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('project', zip, 'project.zip');
    form.append('fps', String(VIDEO_EXPORT_SETTINGS.fps));
    form.append('quality', VIDEO_EXPORT_SETTINGS.quality);
    form.append('format', VIDEO_EXPORT_SETTINGS.format);

    const xhr = new XMLHttpRequest();
    activeUpload = xhr;
    xhr.open('POST', '/api/export-video/render');
    xhr.responseType = 'json';
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    xhr.onload = () => {
      const data = (xhr.response ?? {}) as SubmitResponse;
      if (xhr.status < 200 || xhr.status >= 300 || !data.jobId) {
        reject(new Error(data.message || data.error || `Upload rejected (HTTP ${xhr.status})`));
        return;
      }
      resolve(data);
    };
    xhr.onloadend = () => {
      if (activeUpload === xhr) activeUpload = null;
    };
    xhr.send(form);
  });
}

function triggerNativeDownload(jobId: string, filename: string): void {
  const anchor = document.createElement('a');
  anchor.href = `/api/export-video/render/${encodeURIComponent(jobId)}/download`;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export const useVideoRenderStore = create<VideoRenderState>()((set, get) => ({
  status: 'idle',
  percent: 0,
  etaMs: null,
  filename: null,
  jobId: null,
  framesRendered: null,
  totalFrames: null,
  error: null,

  isActive: () => inFlight(get().status),

  reset: () => {
    if (inFlight(get().status)) return;
    set({
      status: 'idle',
      percent: 0,
      etaMs: null,
      filename: null,
      jobId: null,
      framesRendered: null,
      totalFrames: null,
      error: null,
    });
  },

  cancel: async (t) => {
    if (!inFlight(get().status)) return;
    activeRun += 1;
    activeUpload?.abort();
    activePoll?.abort();
    const jobId = get().jobId;
    set({ status: 'cancelled', percent: 0, etaMs: null, error: null });
    if (activeToastId != null) {
      toast.info(t('export.videoCancelled'), { id: activeToastId });
      activeToastId = null;
    } else {
      toast.info(t('export.videoCancelled'));
    }
    if (jobId) {
      await fetch(`/api/export-video/render/${encodeURIComponent(jobId)}`, {
        method: 'DELETE',
      }).catch(() => undefined);
    }
  },

  startRender: async (t) => {
    if (inFlight(get().status)) return;
    const run = ++activeRun;
    let pollController: AbortController | null = null;
    const toastId = toast.loading(t('export.videoCompiling'));
    activeToastId = toastId;
    set({
      status: 'compiling',
      percent: 0,
      etaMs: null,
      filename: null,
      jobId: null,
      framesRendered: null,
      totalFrames: null,
      error: null,
    });

    try {
      const built = await buildExportZip();
      if (run !== activeRun) return;
      const filename = `${sanitizeFilename(built.stageName)}.mp4`;
      set({ status: 'uploading', percent: 0, filename });
      toast.loading(t('export.videoUploading'), { id: toastId });

      const submitted = await submitProject(built.zipBlob, (percent) => {
        if (run === activeRun) set({ status: 'uploading', percent });
      });
      if (run !== activeRun || !submitted.jobId) return;

      const jobId = submitted.jobId;
      const pollMs = Math.max(1000, submitted.pollIntervalMs ?? DEFAULT_POLL_MS);
      const startedAt = Date.now();
      set({ status: 'queued', percent: 0, jobId, etaMs: null });
      toast.loading(t('export.videoQueued'), { id: toastId });

      while (run === activeRun && Date.now() - startedAt < MAX_POLL_MS) {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
        if (run !== activeRun) return;
        pollController = new AbortController();
        activePoll = pollController;
        const response = await fetch(`/api/export-video/render/${encodeURIComponent(jobId)}`, {
          signal: pollController.signal,
          cache: 'no-store',
        });
        if (activePoll === pollController) activePoll = null;
        const data = (await response.json().catch(() => ({}))) as JobStatusResponse;
        if (!response.ok)
          throw new Error(data.error || `Status request failed (${response.status})`);

        const percent = Math.max(0, Math.min(100, Math.round((data.progress ?? 0) * 100)));
        const elapsed = Date.now() - startedAt;
        const etaMs = percent >= 3 && percent < 100 ? (elapsed / percent) * (100 - percent) : null;
        if (data.status === 'queued') {
          set({ status: 'queued', percent, etaMs: null });
          continue;
        }
        if (data.status === 'running') {
          set({
            status: 'rendering',
            percent,
            etaMs,
            framesRendered: data.framesRendered ?? null,
            totalFrames: data.totalFrames ?? null,
          });
          toast.loading(t('export.videoRendering'), { id: toastId });
          continue;
        }
        if (data.status === 'succeeded') {
          triggerNativeDownload(jobId, filename);
          set({ status: 'succeeded', percent: 100, etaMs: 0 });
          toast.success(t('export.videoMp4Success'), { id: toastId });
          activeToastId = null;
          if (built.missingCount > 0 || built.errorCount > 0) {
            toast.warning(
              t('export.videoWarnings', {
                assets: built.missingCount,
                diagnostics: built.errorCount,
              }),
            );
          }
          return;
        }
        if (data.status === 'cancelled') {
          set({ status: 'cancelled', etaMs: null });
          toast.info(t('export.videoCancelled'), { id: toastId });
          activeToastId = null;
          return;
        }
        if (data.status === 'failed') throw new Error(data.error || 'Render failed');
      }
      if (run === activeRun) throw new Error('Render status polling timed out');
    } catch (error) {
      if (run !== activeRun || (error instanceof DOMException && error.name === 'AbortError'))
        return;
      const message = error instanceof Error ? error.message : String(error);
      if (error instanceof NoScenesError) {
        toast.error(t('export.videoNoScenes'), { id: toastId });
      } else {
        log.error('Video render failed:', error);
        toast.error(t('export.videoFailed'), { id: toastId });
      }
      activeToastId = null;
      set({ status: 'failed', etaMs: null, error: message });
    } finally {
      if (activePoll === pollController) activePoll = null;
    }
  },
}));
