import { nanoid } from 'nanoid';

import type {
  ClassroomManifest,
  ManifestAction,
  ManifestAgent,
  ManifestScene,
  MediaIndexEntry,
} from '@/lib/export/classroom-zip-types';
import type { Action } from '@/lib/types/action';

export const ENTERPRISE_COURSE_IMPORT_LIMITS = {
  archiveBytes: 200 * 1024 * 1024,
  entryCount: 2_000,
  expandedBytes: 500 * 1024 * 1024,
  manifestBytes: 5 * 1024 * 1024,
} as const;

export type EnterpriseCourseImportWarningKind = 'audio' | 'image' | 'video';

export interface EnterpriseCourseImportWarning {
  kind: EnterpriseCourseImportWarningKind;
  path: string;
  reason: string;
  message: string;
}

export interface EnterpriseCourseImportResult<Course = unknown> {
  course: Course;
  warnings: EnterpriseCourseImportWarning[];
}

export interface ImportedCourseBinary {
  kind: EnterpriseCourseImportWarningKind;
  path: string;
  mediaId: string;
  mimeType: string | null;
  prompt?: string | null;
  voice?: string | null;
  data: Uint8Array;
  posterData?: Uint8Array;
}

export interface PreparedEnterpriseCourseImport {
  stage: Record<string, unknown>;
  scenes: Array<Record<string, unknown>>;
  outlines: Array<Record<string, unknown>>;
  binaries: ImportedCourseBinary[];
  warnings: EnterpriseCourseImportWarning[];
}

export class EnterpriseCourseImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnterpriseCourseImportError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isSafeZipPath(path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('\\')) return false;
  if (/^[a-zA-Z]:[\\/]/.test(path)) return false;
  return !path.split(/[\\/]/).some((part) => part === '..' || part === '');
}

export function validateClassroomManifest(value: unknown): ClassroomManifest {
  if (!isRecord(value)) throw new EnterpriseCourseImportError('manifest.json 必须是 JSON 对象');
  const version = value.formatVersion;
  if (version !== undefined && (!Number.isInteger(version) || (version as number) < 1)) {
    throw new EnterpriseCourseImportError('课程包格式版本无效');
  }
  if (typeof version === 'number' && version > 1) {
    throw new EnterpriseCourseImportError(`不支持课程包格式版本 ${version}`);
  }
  if (!isRecord(value.stage) || !Array.isArray(value.scenes) || value.scenes.length === 0) {
    throw new EnterpriseCourseImportError('课程包缺少 stage 或 scenes');
  }
  if (!value.scenes.every(isRecord)) {
    throw new EnterpriseCourseImportError('课程包 scenes 结构无效');
  }
  if (value.agents !== undefined && !Array.isArray(value.agents)) {
    throw new EnterpriseCourseImportError('课程包 agents 结构无效');
  }
  if (value.mediaIndex !== undefined && !isRecord(value.mediaIndex)) {
    throw new EnterpriseCourseImportError('课程包 mediaIndex 结构无效');
  }

  const mediaIndex = (value.mediaIndex ?? {}) as Record<string, MediaIndexEntry>;
  const mediaIds = new Set<string>();
  for (const [path, entry] of Object.entries(mediaIndex)) {
    if (!isSafeZipPath(path) || !isRecord(entry)) {
      throw new EnterpriseCourseImportError(`非法媒体路径：${path}`);
    }
    const kind = entry.type;
    if (kind !== 'audio' && kind !== 'image' && kind !== 'generated') {
      throw new EnterpriseCourseImportError(`非法媒体类型：${path}`);
    }
    if (kind !== 'audio') {
      const mediaId = mediaIdFromPath(path);
      if (mediaIds.has(mediaId)) {
        throw new EnterpriseCourseImportError(`课程包包含重复媒体 ID：${mediaId}`);
      }
      mediaIds.add(mediaId);
    }
  }
  for (const scene of value.scenes as Array<Record<string, unknown>>) {
    const actions = Array.isArray(scene.actions) ? scene.actions : [];
    for (const action of actions) {
      if (!isRecord(action)) throw new EnterpriseCourseImportError('课程包 action 结构无效');
      if (action.type === 'speech' && typeof action.audioRef === 'string') {
        if (!isSafeZipPath(action.audioRef) || mediaIndex[action.audioRef]?.type !== 'audio') {
          throw new EnterpriseCourseImportError(`非法音频引用：${action.audioRef}`);
        }
      }
      if (
        action.type === 'discussion' &&
        action.agentIndex !== undefined &&
        (!Number.isInteger(action.agentIndex) ||
          (action.agentIndex as number) < 0 ||
          (action.agentIndex as number) >= (Array.isArray(value.agents) ? value.agents.length : 0))
      ) {
        throw new EnterpriseCourseImportError('discussion 包含非法 Agent 引用');
      }
    }
    if (isRecord(scene.multiAgent) && Array.isArray(scene.multiAgent.agentIndices)) {
      if (
        scene.multiAgent.agentIndices.some(
          (index) =>
            !Number.isInteger(index) ||
            (index as number) < 0 ||
            (index as number) >= (Array.isArray(value.agents) ? value.agents.length : 0),
        )
      ) {
        throw new EnterpriseCourseImportError('multi-agent 包含非法 Agent 引用');
      }
    }
  }

  return {
    formatVersion: typeof version === 'number' ? version : 1,
    exportedAt: typeof value.exportedAt === 'string' ? value.exportedAt : '',
    appVersion: typeof value.appVersion === 'string' ? value.appVersion : '',
    stage: value.stage as unknown as ClassroomManifest['stage'],
    agents: (Array.isArray(value.agents) ? value.agents : []) as ManifestAgent[],
    scenes: value.scenes as unknown as ManifestScene[],
    mediaIndex,
  };
}

export function mediaIdFromPath(path: string): string {
  const filename = path.split('/').at(-1) ?? path;
  return filename.replace(/\.poster\.[^.]+$/i, '').replace(/\.[^.]+$/, '');
}

function rewriteActions(
  actions: ManifestAction[] | undefined,
  audioIds: ReadonlyMap<string, string>,
  agentIds: readonly string[],
  fallbackAgentIndex: number | undefined,
): Action[] | undefined {
  if (!actions) return undefined;
  return actions.map((action) => {
    if (action.type === 'speech') {
      const {
        audioRef,
        audioUrl: _discardedUrl,
        audioId: _discardedId,
        ...rest
      } = action as ManifestAction & { audioId?: string; audioUrl?: string };
      const audioId = audioRef ? audioIds.get(audioRef) : undefined;
      return { ...rest, ...(audioId ? { audioId } : {}) } as Action;
    }
    if (action.type === 'discussion') {
      const {
        agentIndex,
        agentId: _legacyId,
        ...rest
      } = action as ManifestAction & {
        agentId?: string;
      };
      const resolvedIndex = typeof agentIndex === 'number' ? agentIndex : fallbackAgentIndex;
      const agentId = resolvedIndex === undefined ? undefined : agentIds[resolvedIndex];
      return { ...rest, ...(agentId ? { agentId } : {}) } as Action;
    }
    return action as Action;
  });
}

export function prepareManifestForEnterpriseImport(
  manifestValue: unknown,
  availablePaths: ReadonlySet<string>,
  binaryByPath: ReadonlyMap<string, { data: Uint8Array; posterData?: Uint8Array }> = new Map(),
): PreparedEnterpriseCourseImport {
  const manifest = validateClassroomManifest(manifestValue);
  const stageId = nanoid();
  const now = Date.now();
  const agents = manifest.agents ?? [];
  const agentIds = agents.map(() => nanoid());
  const generatedAgentConfigs = agents.map((agent, index) => ({
    id: agentIds[index],
    name: agent.name,
    role: agent.role,
    persona: agent.persona,
    avatar: agent.avatar,
    color: agent.color,
    priority: agent.priority,
  }));
  const fallbackAgentIndex = (() => {
    const student = agents.findIndex((agent) => agent.role === 'student');
    if (student >= 0) return student;
    const nonTeacher = agents.findIndex((agent) => agent.role !== 'teacher');
    return nonTeacher >= 0 ? nonTeacher : undefined;
  })();

  const warnings: EnterpriseCourseImportWarning[] = [];
  const binaries: ImportedCourseBinary[] = [];
  const audioIds = new Map<string, string>();
  for (const [path, entry] of Object.entries(manifest.mediaIndex ?? {})) {
    const mediaType =
      entry.type === 'audio' ? 'audio' : entry.mimeType?.startsWith('video/') ? 'video' : 'image';
    const binary = binaryByPath.get(path);
    if (entry.missing || !availablePaths.has(path) || !binary || binary.data.byteLength === 0) {
      warnings.push({
        kind: mediaType,
        path,
        reason: entry.missing
          ? 'manifest_marked_missing'
          : !availablePaths.has(path)
            ? 'file_missing'
            : 'file_empty',
        message: `${mediaType === 'audio' ? '音频' : mediaType === 'video' ? '视频' : '图片'}资源缺失：${path}`,
      });
      continue;
    }
    const mediaId = entry.type === 'audio' ? nanoid() : mediaIdFromPath(path);
    if (entry.type === 'audio') audioIds.set(path, mediaId);
    binaries.push({
      kind: mediaType,
      path,
      mediaId,
      mimeType:
        entry.mimeType ??
        (entry.format ? `audio/${entry.format === 'mp3' ? 'mpeg' : entry.format}` : null),
      prompt: entry.prompt ?? null,
      voice: entry.voice ?? null,
      data: binary.data,
      posterData: binary.posterData,
    });
  }

  const scenes = [...manifest.scenes]
    .map((scene, sourceIndex) => ({ scene, sourceIndex }))
    .sort(
      (left, right) =>
        (left.scene.order ?? left.sourceIndex) - (right.scene.order ?? right.sourceIndex),
    )
    .map(({ scene }, index) => {
      const id = nanoid();
      return {
        id,
        stageId,
        type: scene.type,
        title: scene.title || `Scene ${index + 1}`,
        order: index,
        content: scene.content,
        actions: rewriteActions(scene.actions, audioIds, agentIds, fallbackAgentIndex),
        whiteboards: scene.whiteboards,
        ...(scene.multiAgent?.enabled
          ? {
              multiAgent: {
                enabled: true,
                agentIds: scene.multiAgent.agentIndices
                  .map((agentIndex) => agentIds[agentIndex])
                  .filter(Boolean),
                directorPrompt: scene.multiAgent.directorPrompt,
              },
            }
          : {}),
        createdAt: now,
        updatedAt: now,
      } satisfies Record<string, unknown>;
    });

  for (const scene of scenes) {
    for (const action of (scene.actions as Action[] | undefined) ?? []) {
      if (action.type === 'speech' && !action.audioId) {
        const original = manifest.scenes
          .find((candidate) => candidate.title === scene.title)
          ?.actions?.find(
            (candidate) => candidate.id === action.id && candidate.type === 'speech',
          ) as (ManifestAction & { audioRef?: string; audioUrl?: string }) | undefined;
        if (original?.audioUrl && !original.audioRef) {
          warnings.push({
            kind: 'audio',
            path: `legacy-audio/${action.id}`,
            reason: 'remote_audio_not_portable',
            message: `旧课程动作 ${action.id} 仅引用远程音频，导入过程不会访问该地址`,
          });
        }
      }
    }
  }

  const stage = {
    ...manifest.stage,
    id: stageId,
    name: manifest.stage.name || 'Imported Classroom',
    createdAt: typeof manifest.stage.createdAt === 'number' ? manifest.stage.createdAt : now,
    updatedAt: now,
    agentIds: agentIds.length ? agentIds : undefined,
    generatedAgentConfigs: generatedAgentConfigs.length ? generatedAgentConfigs : undefined,
  };
  const outlines = scenes.map((scene, index) => ({
    id: nanoid(),
    stageId,
    sceneId: scene.id,
    title: scene.title,
    type: scene.type,
    order: index,
  }));
  return { stage, scenes, outlines, binaries, warnings };
}
