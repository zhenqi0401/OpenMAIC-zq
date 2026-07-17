import type { Action, DiscussionAction, SpeechAction } from '@/lib/types/action';
import type { ManifestAction } from './classroom-zip-types';
import { db } from '@/lib/utils/database';
import type { AudioFileRecord, MediaFileRecord } from '@/lib/utils/database';
import type { Scene } from '@/lib/types/stage';

// ─── Export: Collect Media ─────────────────────────────────────

export interface CollectedAudio {
  zipPath: string;
  record: AudioFileRecord;
  source: 'indexeddb' | 'remote';
}

export interface MissingAudio {
  audioId: string;
  audioUrl?: string;
  reason: string;
}

export interface AudioCollectionResult {
  files: CollectedAudio[];
  missing: MissingAudio[];
}

type AudioFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface CollectAudioFilesOptions {
  getLocalAudio?: (audioId: string) => Promise<AudioFileRecord | undefined>;
  fetchImpl?: AudioFetch;
}

export interface CollectedMedia {
  zipPath: string;
  record: MediaFileRecord;
  elementId: string;
}

const AUDIO_MIME_EXTENSIONS: Record<string, string> = {
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/x-m4a': 'm4a',
  'audio/x-wav': 'wav',
};

function safeAudioExtension(value: string | undefined): string | undefined {
  const normalized = value?.trim().toLowerCase().replace(/^\./, '');
  return normalized && /^[a-z0-9]+$/.test(normalized) ? normalized : undefined;
}

export function resolveAudioFormat(
  contentType: string | null | undefined,
  audioUrl?: string,
): string {
  const mimeType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (mimeType && AUDIO_MIME_EXTENSIONS[mimeType]) return AUDIO_MIME_EXTENSIONS[mimeType];

  if (audioUrl) {
    try {
      const pathname = new URL(audioUrl, 'http://localhost').pathname;
      const extension = safeAudioExtension(pathname.match(/\.([a-z0-9]+)$/i)?.[1]);
      if (extension) return extension;
    } catch {
      // Ignore malformed URLs and use the established MP3 fallback below.
    }
  }

  return 'mp3';
}

export async function collectAudioFiles(
  scenes: Scene[],
  options: CollectAudioFilesOptions = {},
): Promise<AudioCollectionResult> {
  const audioSources = new Map<string, string | undefined>();
  for (const scene of scenes) {
    for (const action of scene.actions ?? []) {
      if (action.type === 'speech' && (action as SpeechAction).audioId) {
        const speech = action as SpeechAction;
        const audioId = speech.audioId!;
        const knownUrl = audioSources.get(audioId);
        audioSources.set(audioId, knownUrl || speech.audioUrl);
      }
    }
  }

  const getLocalAudio = options.getLocalAudio ?? ((audioId) => db.audioFiles.get(audioId));
  const fetchImpl = options.fetchImpl ?? fetch;
  const results = await Promise.all(
    [...audioSources].map(async ([audioId, audioUrl]): Promise<CollectedAudio | MissingAudio> => {
      try {
        const localRecord = await getLocalAudio(audioId);
        if (localRecord) {
          const format = safeAudioExtension(localRecord.format) ?? 'mp3';
          return {
            zipPath: `audio/${audioId}.${format}`,
            record: { ...localRecord, format },
            source: 'indexeddb',
          };
        }
      } catch (error) {
        if (!audioUrl) {
          return {
            audioId,
            reason: error instanceof Error ? error.message : 'IndexedDB audio lookup failed',
          };
        }
      }

      if (!audioUrl) {
        return { audioId, reason: 'Audio is not available in IndexedDB and has no remote URL' };
      }

      try {
        const response = await fetchImpl(audioUrl, { credentials: 'same-origin' });
        if (!response.ok) {
          return {
            audioId,
            audioUrl,
            reason: `Audio download failed with HTTP ${response.status}`,
          };
        }

        const blob = await response.blob();
        if (blob.size === 0) {
          return { audioId, audioUrl, reason: 'Audio download returned an empty file' };
        }

        const contentType = response.headers.get('content-type') || blob.type;
        const format = resolveAudioFormat(contentType, audioUrl);
        const record: AudioFileRecord = {
          id: audioId,
          blob,
          format,
          createdAt: Date.now(),
        };
        return {
          zipPath: `audio/${audioId}.${format}`,
          record,
          source: 'remote',
        };
      } catch (error) {
        return {
          audioId,
          audioUrl,
          reason: error instanceof Error ? error.message : 'Audio download failed',
        };
      }
    }),
  );

  const files: CollectedAudio[] = [];
  const missing: MissingAudio[] = [];
  for (const result of results) {
    if ('record' in result) {
      files.push(result);
    } else {
      missing.push(result);
    }
  }
  return { files, missing };
}

export async function collectMediaFiles(stageId: string): Promise<CollectedMedia[]> {
  const records = await db.mediaFiles.where('stageId').equals(stageId).toArray();
  const collected: CollectedMedia[] = [];
  for (const record of records) {
    const elementId = record.id.includes(':') ? record.id.split(':').slice(1).join(':') : record.id;
    const ext = record.mimeType?.split('/')[1] || 'jpg';
    collected.push({ zipPath: `media/${elementId}.${ext}`, record, elementId });
  }
  return collected;
}

// ─── Export: Action Serialization ──────────────────────────────

export function actionsToManifest(
  actions: Action[],
  audioIdToPath: Map<string, string>,
  agentIdToIndex: Map<string, number> = new Map(),
): ManifestAction[] {
  return actions.map((action) => {
    if (action.type === 'speech') {
      const speech = action as SpeechAction;
      const { audioId, audioUrl, ...rest } = speech;
      const audioRef = audioId ? audioIdToPath.get(audioId) : undefined;
      return {
        ...rest,
        ...(audioRef ? { audioRef } : {}),
        ...(!audioRef && audioUrl ? { audioUrl } : {}),
      } as ManifestAction;
    }
    if (action.type === 'discussion') {
      const discussion = action as DiscussionAction;
      const { agentId, ...rest } = discussion;
      const agentIndex = agentId ? agentIdToIndex.get(agentId) : undefined;
      return {
        ...rest,
        ...(agentIndex !== undefined ? { agentIndex } : agentId ? { agentId } : {}),
      } as ManifestAction;
    }
    return action as ManifestAction;
  });
}

// ─── Import: Reference Rewriting ───────────────────────────────

interface RewriteManifestActionOptions {
  agentIds?: string[];
  fallbackDiscussionAgentIndex?: number;
}

export function rewriteAudioRefsToIds(
  actions: ManifestAction[],
  audioRefMap: Record<string, string>,
  options: RewriteManifestActionOptions = {},
): Action[] {
  return actions.map((action) => {
    if (action.type === 'speech' && 'audioRef' in action) {
      const { audioRef, audioUrl, ...rest } = action as ManifestAction & { audioUrl?: string };
      const audioId = audioRef ? audioRefMap[audioRef] : undefined;
      return {
        ...rest,
        ...(audioId ? { audioId } : {}),
        ...(!audioId && audioUrl ? { audioUrl } : {}),
      } as Action;
    }
    if (action.type === 'discussion') {
      const {
        agentIndex,
        agentId: legacyAgentId,
        ...rest
      } = action as ManifestAction & { type: 'discussion'; agentIndex?: number; agentId?: string };
      const indexedAgentId =
        typeof agentIndex === 'number' ? options.agentIds?.[agentIndex] : undefined;
      const preservedLegacyAgentId =
        legacyAgentId && (!options.agentIds?.length || options.agentIds.includes(legacyAgentId))
          ? legacyAgentId
          : undefined;
      const fallbackAgentId =
        typeof options.fallbackDiscussionAgentIndex === 'number'
          ? options.agentIds?.[options.fallbackDiscussionAgentIndex]
          : undefined;

      return {
        ...rest,
        ...(indexedAgentId || preservedLegacyAgentId || fallbackAgentId
          ? { agentId: indexedAgentId || preservedLegacyAgentId || fallbackAgentId }
          : {}),
      } as Action;
    }
    return action as Action;
  });
}
