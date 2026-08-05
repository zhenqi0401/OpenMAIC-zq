import { nanoid } from 'nanoid';
import { changeOutlineType } from '@/lib/generation/outline-type';
import {
  buildSourceCatalog,
  isEnhancedTrainingCourseType,
  requiresExplicitQuizScene,
  satisfiesManagementBCStructure,
} from '@/lib/generation/input-fidelity';
import { isKnowledgeCover } from '@/lib/generation/knowledge-cover';
import type {
  OutlineAuditCategory,
  OutlineAuditEvidence,
  OutlineAuditFinding,
  OutlineAuditOperation,
  OutlineAuditRequest,
  OutlineAuditSceneDraft,
  OutlineAuditTypeConfig,
} from '@/lib/generation/outline-audit-types';
import type { SceneOutline, SourceEvidence } from '@/lib/types/generation';
import type { WidgetType } from '@/lib/types/widgets';

const MAX_FINDINGS = 24;
const MAX_OPERATIONS_PER_FINDING = 8;
const MAX_TEXT = 2_000;
const MAX_SHORT_TEXT = 500;
const MAX_LIST_ITEMS = 20;

const CATEGORIES = new Set<OutlineAuditCategory>([
  'source_contradiction',
  'requirement_omission',
  'internal_conflict',
  'duplicate_scene',
  'sequence_error',
  'scene_configuration_error',
]);
const SCENE_TYPES = new Set<SceneOutline['type']>(['slide', 'quiz', 'interactive', 'pbl']);
const WIDGET_TYPES = new Set<Exclude<WidgetType, 'procedural-skill'>>([
  'simulation',
  'diagram',
  'code',
  'game',
  'visualization3d',
]);
const UPDATE_FIELDS = new Set<Extract<OutlineAuditOperation, { type: 'update_field' }>['field']>([
  'title',
  'description',
  'keyPoints',
  'teachingObjective',
  'estimatedDuration',
  'teachingBrief.mustCover',
  'coverBrief.narrationPoints',
]);

export type AuditTrustedSource = OutlineAuditEvidence;

export interface OutlineAuditValidationContext {
  requirements: OutlineAuditRequest['requirements'];
  trustedSources: AuditTrustedSource[];
}

export class OutlineAuditValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutlineAuditValidationError';
  }
}

function fail(message: string): never {
  throw new OutlineAuditValidationError(message);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: readonly string[], label: string) {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedSet.has(key));
  if (unknown.length > 0)
    fail(`${label} contains protected or unknown fields: ${unknown.join(', ')}`);
}

function boundedString(value: unknown, label: string, max = MAX_TEXT): string {
  if (typeof value !== 'string') fail(`${label} must be a string`);
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (!normalized) fail(`${label} must not be empty`);
  if (normalized.length > max) fail(`${label} exceeds ${max} characters`);
  return normalized;
}

function boundedStringArray(
  value: unknown,
  label: string,
  options: { maxItems?: number; maxChars?: number; allowEmpty?: boolean } = {},
): string[] {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  const maxItems = options.maxItems ?? MAX_LIST_ITEMS;
  if (value.length > maxItems) fail(`${label} exceeds ${maxItems} items`);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    const normalized = boundedString(
      item,
      `${label}[${index}]`,
      options.maxChars ?? MAX_SHORT_TEXT,
    );
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  if (!options.allowEmpty && result.length === 0) fail(`${label} must not be empty`);
  return result;
}

function optionalBoundedString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  return boundedString(value, label);
}

function positiveDuration(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 86_400) {
    fail(`${label} must be a positive number no greater than 86400`);
  }
  return Math.round(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build the only source IDs the reviewer is allowed to cite. */
export function buildAuditSourceCatalog(input: {
  requirement: string;
  pdfText?: string;
  pdfFileName?: string;
  researchContext?: string;
  researchSources?: Array<{ title: string; url: string }>;
}): AuditTrustedSource[] {
  const localSources = buildSourceCatalog({
    requirement: input.requirement.slice(0, 12_000),
    pdfText: input.pdfText?.slice(0, 50_000),
    pdfFileName: input.pdfFileName,
  }).map((source) => ({
    sourceId: source.id,
    kind: source.kind,
    label: source.label,
    excerpt: source.excerpt,
  })) satisfies AuditTrustedSource[];

  if (!input.researchContext?.trim() || !input.researchSources?.length) return localSources;
  const context = input.researchContext.slice(0, 30_000);
  const webSources: AuditTrustedSource[] = [];
  for (const [index, source] of input.researchSources.slice(0, 20).entries()) {
    const title = source.title?.replace(/\s+/g, ' ').trim().slice(0, 300);
    const url = source.url?.trim().slice(0, 2_000);
    if (!title || !url) continue;
    const line = context
      .split('\n')
      .find((candidate) =>
        new RegExp(`\\]\\(${escapeRegExp(url)}\\):`, 'i').test(candidate.trim()),
      );
    // Search-result titles and URLs without the server-returned excerpt are not
    // sufficient evidence for a factual patch, so omit them rather than inventing it.
    if (!line) continue;
    const excerpt = line
      .replace(/^\s*-\s*/, '')
      .slice(0, 700)
      .trim();
    if (!excerpt) continue;
    webSources.push({
      sourceId: `WEB-${String(index + 1).padStart(3, '0')}`,
      kind: 'web',
      label: title,
      excerpt,
    });
  }
  return [...localSources, ...webSources];
}

function normalizeSourceRefIds(
  value: unknown,
  label: string,
  catalog: Map<string, AuditTrustedSource>,
): string[] | undefined {
  if (value === undefined) return undefined;
  const ids = boundedStringArray(value, label, { maxItems: 12, maxChars: 32, allowEmpty: true });
  for (const id of ids) {
    if (!/^(?:REQ|DOC|WEB)-\d{3}$/.test(id) || !catalog.has(id)) {
      fail(`${label} cites an unknown source ID: ${id}`);
    }
  }
  return ids;
}

function normalizeQuizConfig(
  value: unknown,
  label: string,
): NonNullable<SceneOutline['quizConfig']> {
  const config = asRecord(value, label);
  assertOnlyKeys(config, ['questionCount', 'difficulty', 'questionTypes', 'mode'], label);
  const questionCount = config.questionCount;
  if (
    typeof questionCount !== 'number' ||
    !Number.isInteger(questionCount) ||
    questionCount < 1 ||
    questionCount > 20
  ) {
    fail(`${label}.questionCount must be an integer from 1 to 20`);
  }
  if (!['easy', 'medium', 'hard'].includes(String(config.difficulty))) {
    fail(`${label}.difficulty is invalid`);
  }
  if (!Array.isArray(config.questionTypes) || config.questionTypes.length === 0) {
    fail(`${label}.questionTypes must not be empty`);
  }
  const questionTypes = [...new Set(config.questionTypes)];
  if (questionTypes.some((item) => !['single', 'multiple', 'text'].includes(String(item)))) {
    fail(`${label}.questionTypes contains an invalid type`);
  }
  if (config.mode !== undefined && !['graded', 'diagnostic'].includes(String(config.mode))) {
    fail(`${label}.mode is invalid`);
  }
  return {
    questionCount,
    difficulty: config.difficulty as 'easy' | 'medium' | 'hard',
    questionTypes: questionTypes as ('single' | 'multiple' | 'text')[],
    ...(config.mode ? { mode: config.mode as 'graded' | 'diagnostic' } : {}),
  };
}

function normalizeWidgetOutline(value: unknown, label: string) {
  const outline = asRecord(value, label);
  assertOnlyKeys(
    outline,
    [
      'concept',
      'keyVariables',
      'diagramType',
      'language',
      'gameType',
      'visualizationType',
      'objects',
      'interactions',
      'challenge',
      'playerControls',
      'nodeCount',
      'challengeType',
    ],
    label,
  );
  const result: Record<string, unknown> = {};
  for (const field of ['concept', 'challenge', 'challengeType'] as const) {
    const normalized = optionalBoundedString(outline[field], `${label}.${field}`);
    if (normalized !== undefined) result[field] = normalized;
  }
  for (const field of ['keyVariables', 'objects', 'interactions', 'playerControls'] as const) {
    if (outline[field] !== undefined) {
      result[field] = boundedStringArray(outline[field], `${label}.${field}`, {
        maxItems: 20,
        maxChars: 200,
        allowEmpty: true,
      });
    }
  }
  const enumFields = {
    diagramType: ['flowchart', 'mindmap', 'hierarchy', 'system'],
    language: ['python', 'javascript', 'typescript', 'java', 'cpp'],
    gameType: ['quiz', 'puzzle', 'strategy', 'card', 'action'],
    visualizationType: ['molecular', 'solar', 'anatomy', 'geometry', 'physics', 'custom'],
  } as const;
  for (const [field, allowed] of Object.entries(enumFields)) {
    if (outline[field] !== undefined) {
      if (!(allowed as readonly unknown[]).includes(outline[field]))
        fail(`${label}.${field} is invalid`);
      result[field] = outline[field];
    }
  }
  if (outline.nodeCount !== undefined) {
    if (
      typeof outline.nodeCount !== 'number' ||
      !Number.isInteger(outline.nodeCount) ||
      outline.nodeCount < 1 ||
      outline.nodeCount > 100
    ) {
      fail(`${label}.nodeCount must be an integer from 1 to 100`);
    }
    result.nodeCount = outline.nodeCount;
  }
  return result;
}

function normalizePblConfig(value: unknown, label: string): NonNullable<SceneOutline['pblConfig']> {
  const config = asRecord(value, label);
  assertOnlyKeys(
    config,
    [
      'projectTopic',
      'projectDescription',
      'targetSkills',
      'issueCount',
      'scenarioRoleplay',
      'scenarioBrief',
    ],
    label,
  );
  const result: NonNullable<SceneOutline['pblConfig']> = {
    projectTopic: boundedString(config.projectTopic, `${label}.projectTopic`),
    projectDescription: boundedString(config.projectDescription, `${label}.projectDescription`),
    targetSkills: boundedStringArray(config.targetSkills, `${label}.targetSkills`, {
      maxItems: 12,
    }),
  };
  if (config.issueCount !== undefined) {
    if (
      typeof config.issueCount !== 'number' ||
      !Number.isInteger(config.issueCount) ||
      config.issueCount < 1 ||
      config.issueCount > 20
    ) {
      fail(`${label}.issueCount must be an integer from 1 to 20`);
    }
    result.issueCount = config.issueCount;
  }
  if (config.scenarioRoleplay !== undefined) {
    if (typeof config.scenarioRoleplay !== 'boolean') fail(`${label}.scenarioRoleplay is invalid`);
    result.scenarioRoleplay = config.scenarioRoleplay;
  }
  const scenarioBrief = optionalBoundedString(config.scenarioBrief, `${label}.scenarioBrief`);
  if (scenarioBrief !== undefined) result.scenarioBrief = scenarioBrief;
  return result;
}

function normalizeTypeConfig(
  value: unknown,
  newType: SceneOutline['type'],
  label: string,
): OutlineAuditTypeConfig | undefined {
  if (value === undefined) return undefined;
  const config = asRecord(value, label);
  assertOnlyKeys(config, ['quizConfig', 'widgetType', 'widgetOutline', 'pblConfig'], label);
  if (newType === 'quiz') {
    if (config.quizConfig === undefined) fail(`${label}.quizConfig is required for quiz`);
    return { quizConfig: normalizeQuizConfig(config.quizConfig, `${label}.quizConfig`) };
  }
  if (newType === 'interactive') {
    if (!WIDGET_TYPES.has(config.widgetType as Exclude<WidgetType, 'procedural-skill'>)) {
      fail(`${label}.widgetType is invalid or forbidden`);
    }
    if (config.widgetOutline === undefined)
      fail(`${label}.widgetOutline is required for interactive`);
    return {
      widgetType: config.widgetType as Exclude<WidgetType, 'procedural-skill'>,
      widgetOutline: normalizeWidgetOutline(config.widgetOutline, `${label}.widgetOutline`),
    };
  }
  if (newType === 'pbl') {
    if (config.pblConfig === undefined) fail(`${label}.pblConfig is required for pbl`);
    return { pblConfig: normalizePblConfig(config.pblConfig, `${label}.pblConfig`) };
  }
  if (Object.keys(config).length > 0) fail(`${label} must be empty for slide`);
  return undefined;
}

function applyConfig(outline: SceneOutline, config?: OutlineAuditTypeConfig): SceneOutline {
  if (!config) return outline;
  if (outline.type === 'quiz' && config.quizConfig)
    return { ...outline, quizConfig: config.quizConfig };
  if (outline.type === 'interactive' && config.widgetType && config.widgetOutline) {
    return { ...outline, widgetType: config.widgetType, widgetOutline: config.widgetOutline };
  }
  if (outline.type === 'pbl' && config.pblConfig)
    return { ...outline, pblConfig: config.pblConfig };
  return outline;
}

function rebuildAsType(
  outline: SceneOutline,
  newType: SceneOutline['type'],
  config?: OutlineAuditTypeConfig,
): SceneOutline {
  // changeOutlineType deliberately no-ops when the type is unchanged. Give it a
  // synthetic different source type so a same-type configuration repair also
  // strips stale foreign configuration before the validated config is overlaid.
  const sourceType: SceneOutline['type'] = newType === 'slide' ? 'quiz' : 'slide';
  const rebuilt = changeOutlineType({ ...outline, type: sourceType }, newType);
  return applyConfig(rebuilt, config);
}

function normalizeSceneDraft(
  value: unknown,
  label: string,
  trainingCourseType: OutlineAuditRequest['requirements']['trainingCourseType'],
): OutlineAuditSceneDraft {
  const scene = asRecord(value, label);
  assertOnlyKeys(
    scene,
    [
      'type',
      'title',
      'description',
      'keyPoints',
      'teachingObjective',
      'estimatedDuration',
      'teachingBrief',
      'quizConfig',
      'widgetType',
      'widgetOutline',
      'pblConfig',
    ],
    label,
  );
  if (!SCENE_TYPES.has(scene.type as SceneOutline['type'])) fail(`${label}.type is invalid`);
  const type = scene.type as SceneOutline['type'];
  const base: OutlineAuditSceneDraft = {
    type,
    title: boundedString(scene.title, `${label}.title`),
    description: boundedString(scene.description, `${label}.description`),
    keyPoints: boundedStringArray(scene.keyPoints, `${label}.keyPoints`, { maxItems: 12 }),
  };
  const teachingObjective = optionalBoundedString(
    scene.teachingObjective,
    `${label}.teachingObjective`,
  );
  if (teachingObjective !== undefined) base.teachingObjective = teachingObjective;
  if (scene.estimatedDuration !== undefined) {
    base.estimatedDuration = positiveDuration(
      scene.estimatedDuration,
      `${label}.estimatedDuration`,
    );
  }
  if (scene.teachingBrief !== undefined) {
    if (!isEnhancedTrainingCourseType(trainingCourseType)) {
      fail(`${label}.teachingBrief is forbidden for the other strategy`);
    }
    const brief = asRecord(scene.teachingBrief, `${label}.teachingBrief`);
    assertOnlyKeys(brief, ['mustCover'], `${label}.teachingBrief`);
    base.teachingBrief = {
      mustCover: boundedStringArray(brief.mustCover, `${label}.teachingBrief.mustCover`, {
        maxItems: 8,
        maxChars: 500,
      }),
    };
  }
  const config = normalizeTypeConfig(
    {
      ...(scene.quizConfig !== undefined ? { quizConfig: scene.quizConfig } : {}),
      ...(scene.widgetType !== undefined ? { widgetType: scene.widgetType } : {}),
      ...(scene.widgetOutline !== undefined ? { widgetOutline: scene.widgetOutline } : {}),
      ...(scene.pblConfig !== undefined ? { pblConfig: scene.pblConfig } : {}),
    },
    type,
    `${label}.config`,
  );
  return { ...base, ...config };
}

function normalizeOperation(
  value: unknown,
  label: string,
  outlinesById: Map<string, SceneOutline>,
  context: OutlineAuditValidationContext,
): OutlineAuditOperation {
  const operation = asRecord(value, label);
  const type = operation.type;
  const catalog = new Map(context.trustedSources.map((source) => [source.sourceId, source]));
  if (type === 'update_field') {
    assertOnlyKeys(operation, ['type', 'sceneId', 'field', 'value', 'sourceRefIds'], label);
    const sceneId = boundedString(operation.sceneId, `${label}.sceneId`, 128);
    if (!outlinesById.has(sceneId)) fail(`${label} references a missing scene: ${sceneId}`);
    if (!UPDATE_FIELDS.has(operation.field as never)) fail(`${label}.field is not editable`);
    const field = operation.field as Extract<
      OutlineAuditOperation,
      { type: 'update_field' }
    >['field'];
    if (
      field === 'teachingBrief.mustCover' &&
      !isEnhancedTrainingCourseType(context.requirements.trainingCourseType)
    ) {
      fail(`${label} cannot add fidelity fields to the other strategy`);
    }
    let normalizedValue: string | string[] | number;
    if (field === 'coverBrief.narrationPoints' && !isKnowledgeCover(outlinesById.get(sceneId))) {
      fail(`${label} can update narration points only on the protected cover scene`);
    }
    if (
      field === 'keyPoints' ||
      field === 'teachingBrief.mustCover' ||
      field === 'coverBrief.narrationPoints'
    ) {
      normalizedValue = boundedStringArray(operation.value, `${label}.value`, {
        maxItems: field === 'keyPoints' ? 12 : 8,
        maxChars: 500,
      });
    } else if (field === 'estimatedDuration') {
      normalizedValue = positiveDuration(operation.value, `${label}.value`);
    } else {
      normalizedValue = boundedString(operation.value, `${label}.value`);
    }
    const sourceRefIds = normalizeSourceRefIds(
      operation.sourceRefIds,
      `${label}.sourceRefIds`,
      catalog,
    );
    if (
      field === 'teachingBrief.mustCover' &&
      !(sourceRefIds ?? []).some((id) => id.startsWith('REQ-') || id.startsWith('DOC-'))
    ) {
      fail(
        `${label} cannot update must-cover content without trusted requirement or document evidence`,
      );
    }
    if (field === 'coverBrief.narrationPoints' && !(sourceRefIds ?? []).length) {
      fail(`${label} cannot update cover narration points without trusted evidence`);
    }
    return {
      type,
      sceneId,
      field,
      value: normalizedValue,
      sourceRefIds,
    };
  }
  if (type === 'insert_scene') {
    assertOnlyKeys(operation, ['type', 'afterSceneId', 'scene', 'sourceRefIds'], label);
    const afterSceneId =
      operation.afterSceneId === null
        ? null
        : boundedString(operation.afterSceneId, `${label}.afterSceneId`, 128);
    if (afterSceneId !== null && !outlinesById.has(afterSceneId)) {
      fail(`${label} references a missing insertion anchor: ${afterSceneId}`);
    }
    const sourceRefIds = normalizeSourceRefIds(
      operation.sourceRefIds,
      `${label}.sourceRefIds`,
      catalog,
    );
    if (
      isEnhancedTrainingCourseType(context.requirements.trainingCourseType) &&
      !(sourceRefIds ?? []).some((id) => id.startsWith('REQ-') || id.startsWith('DOC-'))
    ) {
      fail(
        `${label} cannot insert an enhanced scene without trusted requirement or document evidence`,
      );
    }
    return {
      type,
      afterSceneId,
      scene: {
        id: `audit_${nanoid(12)}`,
        ...normalizeSceneDraft(
          operation.scene,
          `${label}.scene`,
          context.requirements.trainingCourseType,
        ),
      },
      sourceRefIds,
    };
  }
  if (type === 'delete_scene') {
    assertOnlyKeys(operation, ['type', 'sceneId'], label);
    const sceneId = boundedString(operation.sceneId, `${label}.sceneId`, 128);
    if (!outlinesById.has(sceneId)) fail(`${label} references a missing scene: ${sceneId}`);
    return { type, sceneId };
  }
  if (type === 'move_scene') {
    assertOnlyKeys(operation, ['type', 'sceneId', 'afterSceneId'], label);
    const sceneId = boundedString(operation.sceneId, `${label}.sceneId`, 128);
    const afterSceneId =
      operation.afterSceneId === null
        ? null
        : boundedString(operation.afterSceneId, `${label}.afterSceneId`, 128);
    if (!outlinesById.has(sceneId)) fail(`${label} references a missing scene: ${sceneId}`);
    if (afterSceneId !== null && !outlinesById.has(afterSceneId)) {
      fail(`${label} references a missing move anchor: ${afterSceneId}`);
    }
    if (sceneId === afterSceneId) fail(`${label} cannot move a scene after itself`);
    return { type, sceneId, afterSceneId };
  }
  if (type === 'change_scene_type') {
    assertOnlyKeys(operation, ['type', 'sceneId', 'newType', 'config', 'sourceRefIds'], label);
    const sceneId = boundedString(operation.sceneId, `${label}.sceneId`, 128);
    if (!outlinesById.has(sceneId)) fail(`${label} references a missing scene: ${sceneId}`);
    if (!SCENE_TYPES.has(operation.newType as SceneOutline['type']))
      fail(`${label}.newType is invalid`);
    const newType = operation.newType as SceneOutline['type'];
    return {
      type,
      sceneId,
      newType,
      config: normalizeTypeConfig(operation.config, newType, `${label}.config`),
      sourceRefIds: normalizeSourceRefIds(operation.sourceRefIds, `${label}.sourceRefIds`, catalog),
    };
  }
  fail(`${label}.type is invalid`);
}

function validateOperationConflicts(findings: OutlineAuditFinding[]) {
  const owners = new Map<string, string>();
  const deleted = new Map<string, string>();
  const anchors: Array<{ sceneId: string; findingId: string }> = [];
  const claim = (key: string, findingId: string) => {
    const owner = owners.get(key);
    if (owner) fail(`findings ${owner} and ${findingId} conflict on ${key}`);
    owners.set(key, findingId);
  };
  for (const finding of findings) {
    for (const operation of finding.operations) {
      if (operation.type === 'delete_scene') deleted.set(operation.sceneId, finding.id);
      if (operation.type === 'update_field')
        claim(`${operation.sceneId}:${operation.field}`, finding.id);
      if (operation.type === 'move_scene') {
        claim(`${operation.sceneId}:position`, finding.id);
        if (operation.afterSceneId)
          anchors.push({ sceneId: operation.afterSceneId, findingId: finding.id });
      }
      if (operation.type === 'change_scene_type') claim(`${operation.sceneId}:type`, finding.id);
      if (operation.type === 'insert_scene' && operation.afterSceneId) {
        anchors.push({ sceneId: operation.afterSceneId, findingId: finding.id });
      }
    }
  }
  for (const [sceneId, findingId] of deleted) {
    for (const [key, owner] of owners) {
      if (key.startsWith(`${sceneId}:`)) {
        fail(`findings ${findingId} and ${owner} delete and modify the same scene ${sceneId}`);
      }
    }
    const anchored = anchors.find((anchor) => anchor.sceneId === sceneId);
    if (anchored) fail(`finding ${anchored.findingId} uses deleted scene ${sceneId} as an anchor`);
  }
}

/** Convert untrusted model JSON into a safe, executable finding set. */
export function normalizeOutlineAuditModelOutput(
  value: unknown,
  outlines: SceneOutline[],
  context: OutlineAuditValidationContext,
): { verdict: 'pass' | 'changes_proposed'; summary: string; findings: OutlineAuditFinding[] } {
  const root = asRecord(value, 'audit response');
  assertOnlyKeys(root, ['verdict', 'summary', 'findings'], 'audit response');
  if (root.verdict !== 'pass' && root.verdict !== 'changes_proposed') {
    fail('audit response verdict is invalid');
  }
  const summary = boundedString(root.summary, 'audit response summary');
  if (!Array.isArray(root.findings) || root.findings.length > MAX_FINDINGS) {
    fail(`audit response findings must be an array with at most ${MAX_FINDINGS} items`);
  }
  const outlinesById = new Map(outlines.map((outline) => [outline.id, outline]));
  if (outlinesById.size !== outlines.length) fail('base outline IDs are not unique');
  const catalog = new Map(context.trustedSources.map((source) => [source.sourceId, source]));
  const findingIds = new Set<string>();
  const findings = root.findings.map((rawFinding, index): OutlineAuditFinding => {
    const label = `findings[${index}]`;
    const finding = asRecord(rawFinding, label);
    assertOnlyKeys(
      finding,
      [
        'id',
        'severity',
        'category',
        'relatedSceneIds',
        'reason',
        'evidence',
        'before',
        'after',
        'operations',
      ],
      label,
    );
    const id = boundedString(finding.id, `${label}.id`, 96);
    if (findingIds.has(id)) fail(`duplicate finding ID: ${id}`);
    findingIds.add(id);
    if (finding.severity !== 'error' && finding.severity !== 'warning') {
      fail(`${label}.severity is invalid`);
    }
    if (!CATEGORIES.has(finding.category as OutlineAuditCategory))
      fail(`${label}.category is invalid`);
    const relatedSceneIds = boundedStringArray(
      finding.relatedSceneIds,
      `${label}.relatedSceneIds`,
      {
        maxItems: 20,
        maxChars: 128,
        allowEmpty: true,
      },
    );
    for (const sceneId of relatedSceneIds) {
      if (!outlinesById.has(sceneId))
        fail(`${label} references a missing related scene: ${sceneId}`);
    }
    if (!Array.isArray(finding.evidence) || finding.evidence.length > 12) {
      fail(`${label}.evidence must be an array with at most 12 items`);
    }
    const evidence = finding.evidence.map((rawEvidence, evidenceIndex) => {
      const evidenceRecord = asRecord(rawEvidence, `${label}.evidence[${evidenceIndex}]`);
      assertOnlyKeys(evidenceRecord, ['sourceId'], `${label}.evidence[${evidenceIndex}]`);
      const sourceId = boundedString(
        evidenceRecord.sourceId,
        `${label}.evidence[${evidenceIndex}].sourceId`,
        32,
      );
      const trusted = catalog.get(sourceId);
      if (!trusted) fail(`${label} cites an unknown source ID: ${sourceId}`);
      return trusted;
    });
    if (
      (finding.category === 'source_contradiction' ||
        finding.category === 'requirement_omission') &&
      evidence.length === 0
    ) {
      fail(`${label} requires trusted evidence`);
    }
    if (
      !Array.isArray(finding.operations) ||
      finding.operations.length > MAX_OPERATIONS_PER_FINDING
    ) {
      fail(`${label}.operations must be an array with at most ${MAX_OPERATIONS_PER_FINDING} items`);
    }
    const operations = finding.operations.map((operation, operationIndex) =>
      normalizeOperation(
        operation,
        `${label}.operations[${operationIndex}]`,
        outlinesById,
        context,
      ),
    );
    return {
      id,
      severity: finding.severity,
      category: finding.category as OutlineAuditCategory,
      relatedSceneIds,
      reason: boundedString(finding.reason, `${label}.reason`),
      evidence,
      before: boundedString(finding.before, `${label}.before`),
      after: boundedString(finding.after, `${label}.after`),
      operations,
    };
  });
  if (root.verdict === 'pass' && findings.length > 0)
    fail('pass verdict must not include findings');
  if (root.verdict === 'changes_proposed' && findings.length === 0) {
    fail('changes_proposed verdict must include findings');
  }
  validateOperationConflicts(findings);
  // Prove that both the base outline and the complete suggestion set are valid
  // and executable before the result reaches the browser.
  applyAuditFindings(
    outlines,
    findings,
    findings.map((finding) => finding.id),
    context,
  );
  return { verdict: root.verdict, summary, findings };
}

function trustedEvidenceForRefs(
  refs: string[] | undefined,
  context: OutlineAuditValidationContext,
): SourceEvidence[] {
  if (!refs?.length) return [];
  const catalog = new Map(context.trustedSources.map((source) => [source.sourceId, source]));
  return refs
    .map((id) => catalog.get(id))
    .filter(
      (source): source is AuditTrustedSource & { kind: 'requirement' | 'document' } =>
        !!source && (source.kind === 'requirement' || source.kind === 'document'),
    )
    .map((source) => ({
      id: source.sourceId,
      kind: source.kind,
      label: source.label,
      excerpt: source.excerpt,
    }));
}

function mergeTrustedEvidence(
  outline: SceneOutline,
  refs: string[] | undefined,
  context: OutlineAuditValidationContext,
): SceneOutline {
  if (!isEnhancedTrainingCourseType(context.requirements.trainingCourseType)) return outline;
  const trusted = new Map(
    context.trustedSources
      .filter((source) => source.kind === 'requirement' || source.kind === 'document')
      .map((source) => [source.sourceId, source]),
  );
  const evidence = new Map<string, SourceEvidence>();
  for (const existing of outline.sourceEvidence ?? []) {
    const source = trusted.get(existing.id);
    if (!source || source.kind === 'web') continue;
    evidence.set(source.sourceId, {
      id: source.sourceId,
      kind: source.kind,
      label: source.label,
      excerpt: source.excerpt,
    });
  }
  for (const source of trustedEvidenceForRefs(refs, context)) evidence.set(source.id, source);
  return {
    ...outline,
    trainingCourseType: context.requirements.trainingCourseType,
    teachingBrief: outline.teachingBrief ?? { mustCover: [] },
    sourceEvidence: [...evidence.values()],
  };
}

function normalizeOrders(outlines: SceneOutline[]): SceneOutline[] {
  return outlines.map((outline, index) => ({ ...outline, order: index + 1 }));
}

function validateFinalOutlines(
  outlines: SceneOutline[],
  context: OutlineAuditValidationContext,
  protectedCover?: Pick<SceneOutline, 'id' | 'sceneRole' | 'type' | 'coverBrief'>,
) {
  if (outlines.length === 0) fail('an audit patch cannot delete the final scene');
  const ids = new Set<string>();
  for (const [index, outline] of outlines.entries()) {
    if (!outline.id || ids.has(outline.id))
      fail('audit patch produced duplicate or empty scene IDs');
    ids.add(outline.id);
    if (outline.order !== index + 1) fail('audit patch produced non-contiguous scene order');
    if (!SCENE_TYPES.has(outline.type)) fail(`scene ${outline.id} has an invalid type`);
    if (
      !outline.title?.trim() ||
      !outline.description?.trim() ||
      !Array.isArray(outline.keyPoints)
    ) {
      fail(`scene ${outline.id} is missing required content fields`);
    }
    if (outline.type === 'quiz')
      normalizeQuizConfig(outline.quizConfig, `scene ${outline.id}.quizConfig`);
    if (outline.type === 'interactive') {
      if (
        !outline.widgetType ||
        outline.widgetType === 'procedural-skill' ||
        !outline.widgetOutline
      ) {
        fail(`scene ${outline.id} has an invalid ordinary interactive configuration`);
      }
      if (!WIDGET_TYPES.has(outline.widgetType))
        fail(`scene ${outline.id} has an invalid widget type`);
      normalizeWidgetOutline(outline.widgetOutline, `scene ${outline.id}.widgetOutline`);
    }
    if (outline.type === 'pbl')
      normalizePblConfig(outline.pblConfig, `scene ${outline.id}.pblConfig`);
    if (!isEnhancedTrainingCourseType(context.requirements.trainingCourseType)) {
      if (outline.trainingCourseType || outline.teachingBrief || outline.sourceEvidence) {
        fail('the other strategy must not gain input-fidelity fields');
      }
    } else if (!outline.sourceEvidence?.length) {
      fail(`enhanced scene ${outline.id} has no trusted source evidence`);
    } else {
      const trusted = new Map(
        context.trustedSources
          .filter((source) => source.kind === 'requirement' || source.kind === 'document')
          .map((source) => [source.sourceId, source]),
      );
      for (const evidence of outline.sourceEvidence) {
        const source = trusted.get(evidence.id);
        if (
          !source ||
          source.kind !== evidence.kind ||
          source.label !== evidence.label ||
          source.excerpt !== evidence.excerpt
        ) {
          fail(`enhanced scene ${outline.id} contains untrusted source evidence`);
        }
      }
    }
  }
  if (protectedCover) {
    const first = outlines[0];
    if (first.id !== protectedCover.id || first.type !== 'slide' || first.sceneRole !== 'cover') {
      fail('audit patch cannot delete, move, or change the type of the first knowledge cover');
    }
    if (first.coverBrief?.attribution !== protectedCover.coverBrief?.attribution) {
      fail('audit patch cannot rewrite the protected cover attribution');
    }
  }
  if (
    context.requirements.trainingCourseType === 'management' &&
    !satisfiesManagementBCStructure(outlines)
  ) {
    fail(
      'audit patch cannot break the management cover, case, diagnostic, callback, or closing loop',
    );
  }
  if (
    requiresExplicitQuizScene(context.requirements.requirement) &&
    !outlines.some((outline) => outline.type === 'quiz')
  ) {
    fail('audit patch cannot delete the last explicitly required Quiz scene');
  }
}

/** Atomically apply any selected, already-normalized findings and revalidate the final outline. */
export function applyAuditFindings(
  outlines: SceneOutline[],
  findings: OutlineAuditFinding[],
  selectedFindingIds: string[],
  context: OutlineAuditValidationContext,
): SceneOutline[] {
  const protectedCover = isKnowledgeCover(outlines[0])
    ? {
        id: outlines[0].id,
        type: outlines[0].type,
        sceneRole: outlines[0].sceneRole,
        coverBrief: outlines[0].coverBrief
          ? JSON.parse(JSON.stringify(outlines[0].coverBrief))
          : undefined,
      }
    : undefined;
  const selected = new Set(selectedFindingIds);
  if (selected.size !== selectedFindingIds.length) fail('selected finding IDs must be unique');
  const findingsById = new Map(findings.map((finding) => [finding.id, finding]));
  for (const id of selected) if (!findingsById.has(id)) fail(`unknown selected finding ID: ${id}`);
  const selectedFindings = findings.filter((finding) => selected.has(finding.id));
  validateOperationConflicts(selectedFindings);
  let next = outlines.map((outline) => JSON.parse(JSON.stringify(outline)) as SceneOutline);
  for (const finding of selectedFindings) {
    for (const operation of finding.operations) {
      if (operation.type === 'update_field') {
        const index = next.findIndex((outline) => outline.id === operation.sceneId);
        if (index < 0) fail(`scene ${operation.sceneId} no longer exists`);
        const outline = { ...next[index] };
        if (operation.field === 'teachingBrief.mustCover') {
          outline.teachingBrief = { mustCover: operation.value as string[] };
        } else if (operation.field === 'coverBrief.narrationPoints') {
          outline.coverBrief = {
            ...(outline.coverBrief?.attribution
              ? { attribution: outline.coverBrief.attribution }
              : {}),
            narrationPoints: operation.value as string[],
          };
        } else {
          Object.assign(outline, { [operation.field]: operation.value });
        }
        next[index] = mergeTrustedEvidence(outline, operation.sourceRefIds, context);
      } else if (operation.type === 'insert_scene') {
        const base: SceneOutline = {
          id: operation.scene.id,
          type: 'slide',
          title: operation.scene.title,
          description: operation.scene.description,
          keyPoints: operation.scene.keyPoints,
          order: 0,
          ...(operation.scene.teachingObjective
            ? { teachingObjective: operation.scene.teachingObjective }
            : {}),
          ...(operation.scene.estimatedDuration
            ? { estimatedDuration: operation.scene.estimatedDuration }
            : {}),
          ...(operation.scene.teachingBrief
            ? { teachingBrief: operation.scene.teachingBrief }
            : {}),
        };
        const config: OutlineAuditTypeConfig = {
          ...(operation.scene.quizConfig ? { quizConfig: operation.scene.quizConfig } : {}),
          ...(operation.scene.widgetType ? { widgetType: operation.scene.widgetType } : {}),
          ...(operation.scene.widgetOutline
            ? { widgetOutline: operation.scene.widgetOutline }
            : {}),
          ...(operation.scene.pblConfig ? { pblConfig: operation.scene.pblConfig } : {}),
        };
        const inserted = mergeTrustedEvidence(
          rebuildAsType(
            base,
            operation.scene.type,
            Object.keys(config).length ? config : undefined,
          ),
          operation.sourceRefIds,
          context,
        );
        const anchorIndex =
          operation.afterSceneId === null
            ? -1
            : next.findIndex((outline) => outline.id === operation.afterSceneId);
        if (operation.afterSceneId !== null && anchorIndex < 0) {
          fail(`insertion anchor ${operation.afterSceneId} no longer exists`);
        }
        const insertIndex = anchorIndex + 1;
        next.splice(insertIndex, 0, inserted);
      } else if (operation.type === 'delete_scene') {
        const index = next.findIndex((outline) => outline.id === operation.sceneId);
        if (index < 0) fail(`scene ${operation.sceneId} no longer exists`);
        next.splice(index, 1);
      } else if (operation.type === 'move_scene') {
        const index = next.findIndex((outline) => outline.id === operation.sceneId);
        if (index < 0) fail(`scene ${operation.sceneId} no longer exists`);
        const [moved] = next.splice(index, 1);
        const anchorIndex =
          operation.afterSceneId === null
            ? -1
            : next.findIndex((outline) => outline.id === operation.afterSceneId);
        if (operation.afterSceneId !== null && anchorIndex < 0) {
          fail(`move anchor ${operation.afterSceneId} no longer exists`);
        }
        const targetIndex = anchorIndex + 1;
        next.splice(targetIndex, 0, moved);
      } else if (operation.type === 'change_scene_type') {
        const index = next.findIndex((outline) => outline.id === operation.sceneId);
        if (index < 0) fail(`scene ${operation.sceneId} no longer exists`);
        next[index] = mergeTrustedEvidence(
          rebuildAsType(next[index], operation.newType, operation.config),
          operation.sourceRefIds,
          context,
        );
      }
    }
  }
  next = normalizeOrders(next);
  validateFinalOutlines(next, context, protectedCover);
  return next;
}
