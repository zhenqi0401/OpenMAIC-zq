import type { SceneOutline, UserRequirements, WidgetOutline } from '@/lib/types/generation';
import type { WidgetType } from '@/lib/types/widgets';

export const OUTLINE_AUDIT_STATUSES = [
  'idle',
  'running',
  'passed',
  'changes_proposed',
  'resolved',
  'failed',
  'stale',
  'skipped',
] as const;

export type OutlineAuditStatus = (typeof OUTLINE_AUDIT_STATUSES)[number];

export const OUTLINE_AUDIT_CATEGORIES = [
  'source_contradiction',
  'requirement_omission',
  'internal_conflict',
  'duplicate_scene',
  'sequence_error',
  'scene_configuration_error',
] as const;

export type OutlineAuditCategory = (typeof OUTLINE_AUDIT_CATEGORIES)[number];
export type OutlineAuditSeverity = 'error' | 'warning';

export interface OutlineAuditEvidence {
  sourceId: string;
  kind: 'requirement' | 'document' | 'web';
  label: string;
  excerpt: string;
}

export interface OutlineAuditSceneDraft {
  type: SceneOutline['type'];
  title: string;
  description: string;
  keyPoints: string[];
  teachingObjective?: string;
  estimatedDuration?: number;
  teachingBrief?: { mustCover: string[] };
  quizConfig?: SceneOutline['quizConfig'];
  widgetType?: Exclude<WidgetType, 'procedural-skill'>;
  widgetOutline?: WidgetOutline;
  pblConfig?: SceneOutline['pblConfig'];
}

export interface OutlineAuditTypeConfig {
  quizConfig?: SceneOutline['quizConfig'];
  widgetType?: Exclude<WidgetType, 'procedural-skill'>;
  widgetOutline?: WidgetOutline;
  pblConfig?: SceneOutline['pblConfig'];
}

export type OutlineAuditOperation =
  | {
      type: 'update_field';
      sceneId: string;
      field:
        | 'title'
        | 'description'
        | 'keyPoints'
        | 'teachingObjective'
        | 'estimatedDuration'
        | 'teachingBrief.mustCover';
      value: string | string[] | number;
      sourceRefIds?: string[];
    }
  | {
      type: 'insert_scene';
      afterSceneId: string | null;
      scene: OutlineAuditSceneDraft & { id: string };
      sourceRefIds?: string[];
    }
  | {
      type: 'delete_scene';
      sceneId: string;
    }
  | {
      type: 'move_scene';
      sceneId: string;
      afterSceneId: string | null;
    }
  | {
      type: 'change_scene_type';
      sceneId: string;
      newType: SceneOutline['type'];
      config?: OutlineAuditTypeConfig;
      sourceRefIds?: string[];
    };

export interface OutlineAuditFinding {
  id: string;
  severity: OutlineAuditSeverity;
  category: OutlineAuditCategory;
  relatedSceneIds: string[];
  reason: string;
  evidence: OutlineAuditEvidence[];
  before: string;
  after: string;
  operations: OutlineAuditOperation[];
}

export interface OutlineAuditResult {
  auditId: string;
  baseRevision: number;
  verdict: 'pass' | 'changes_proposed';
  summary: string;
  findings: OutlineAuditFinding[];
  providerId: 'deepseek';
  modelId: 'deepseek-v4-flash';
  completedAt: string;
}

export interface OutlineAuditRequest {
  outlineRevision: number;
  requirements: UserRequirements;
  outlines: SceneOutline[];
  courseTitle?: string;
  languageDirective?: string;
  pdfText?: string;
  pdfFileName?: string;
  researchContext?: string;
  researchSources?: Array<{ title: string; url: string }>;
  interactiveMode: boolean;
  taskEngineMode: boolean;
}

export type OutlineAuditErrorCode =
  | 'configuration_missing'
  | 'provider_mismatch'
  | 'missing_api_key'
  | 'rate_limited'
  | 'upstream_failed'
  | 'timeout'
  | 'invalid_response'
  | 'cancelled'
  | 'invalid_request';

export interface OutlineAuditSessionState {
  status: OutlineAuditStatus;
  baseRevision: number;
  result?: OutlineAuditResult;
  appliedFindingIds: string[];
  rejectedFindingIds: string[];
  error?: {
    code: OutlineAuditErrorCode;
    message: string;
    retryable: boolean;
  };
  startedAt?: string;
  completedAt?: string;
}
