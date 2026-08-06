/**
 * Scene Outlines Streaming API (SSE)
 *
 * Streams outline generation via Server-Sent Events.
 * Emits individual outline objects as they're parsed from the LLM response,
 * so the frontend can display them incrementally.
 *
 * SSE events:
 *   { type: 'languageDirective', data: string }
 *   { type: 'courseTitle', data: string }
 *   { type: 'outline', data: SceneOutline, index: number }
 *   { type: 'done', outlines: SceneOutline[], languageDirective: string, courseTitle?: string }
 *   { type: 'error', error: string }
 */

import { NextRequest } from 'next/server';
import { streamLLM } from '@/lib/ai/llm';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';
import {
  formatImageDescription,
  formatImagePlaceholder,
  buildVisionUserContent,
  uniquifyMediaElementIds,
  formatTeacherPersonaForPrompt,
} from '@/lib/generation/generation-pipeline';
import type { AgentInfo } from '@/lib/generation/generation-pipeline';
import { DEFAULT_LANGUAGE_DIRECTIVE } from '@/lib/generation/outline-generator';
import { MAX_PDF_CONTENT_CHARS, MAX_VISION_IMAGES } from '@/lib/constants/generation';
import { nanoid } from 'nanoid';
import type {
  UserRequirements,
  PdfImage,
  SceneOutline,
  ImageMapping,
} from '@/lib/types/generation';
import { apiError } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import { resolveVocationalActive } from '@/lib/config/feature-flags';
import {
  buildOutlineFidelityPrompt,
  buildSourceCatalog,
  isEnhancedTrainingCourseType,
  isTrainingCourseType,
  normalizeFidelityOutline,
  satisfiesExplicitQuizRequirement,
  satisfiesManagementBCStructure,
  stripFidelityForStreaming,
} from '@/lib/generation/input-fidelity';
import {
  MANDATORY_ENHANCED_COVER_SYSTEM_CONTRACT,
  normalizeKnowledgeCoverFields,
  satisfiesKnowledgeCoverStructure,
} from '@/lib/generation/knowledge-cover';
import {
  createOutlineAttemptSignal,
  OUTLINE_ATTEMPT_TIMEOUT_MS,
} from '@/lib/generation/outline-stream-control';
const log = createLogger('Outlines Stream');

export const maxDuration = 300;

type OutlineErrorCode =
  | 'ATTEMPT_TIMEOUT'
  | 'OUTLINE_OUTPUT_INCOMPLETE'
  | 'STRUCTURE_REPAIR_FAILED'
  | 'OUTLINE_GENERATION_FAILED';

function minimumSceneCountFromRequirement(requirement: string): number | undefined {
  const match = requirement.match(/(?:不少于|至少|不低于)\s*(\d+)\s*(?:页|个场景|场景)/i);
  const count = match ? Number.parseInt(match[1], 10) : Number.NaN;
  return Number.isInteger(count) && count > 0 ? count : undefined;
}

function buildManagementRepairPrompt(
  requirement: string,
  outlines: SceneOutline[],
  internalConstraints: string,
  minimumSceneCount?: number,
): string {
  const compactOutlines = outlines.map((outline) => {
    const fidelityOutline = outline as SceneOutline & { sourceRefIds?: unknown };
    return {
      id: outline.id,
      order: outline.order,
      type: outline.type,
      title: outline.title,
      description: outline.description,
      keyPoints: outline.keyPoints,
      sceneRole: outline.sceneRole,
      coverBrief: outline.coverBrief,
      quizConfig: outline.quizConfig,
      widgetType: outline.widgetType,
      teachingBrief: outline.teachingBrief,
      sourceRefIds: fidelityOutline.sourceRefIds,
    };
  });
  return `
你正在基于一份已经部分生成成功的管理知识培训大纲继续生成。不要重新生成整门课程，不要改写、删除、替换或重复下列已有场景；从已有最后一个 order 之后继续，只输出为了让合并后的整份大纲完整满足管理策略所必需的后续场景，放入一个 JSON wrapper：{"outlines":[...]}。

原始用户要求：${requirement}

已有场景（这是继续生成的权威上下文，人物、团队、冲突线、理论进度和来源引用必须延续）：
${JSON.stringify(compactOutlines)}

以下是系统内部的完整策略与来源约束。它们约束“已有场景 + 本次新增场景”合并后的整份大纲，而不是只约束最后两页：
${internalConstraints}

继续生成要求：
1. 先判断已有场景已经完成到教学链路的哪一步，再补足仍然缺失的理论解释、案例贯穿、诊断回看、行动迁移和最终闭环；不得把修复简化成机械追加两个标题页。
2. 延续开篇同一人物、同一团队背景、同一组三个痛点和三项诊断决策。call back 必须逐项重审三项决策，结尾必须逐项形成“痛点 → 理论线索 → 管理动作”，不得换案例或泛化总结。
3. 所有必要的核心理论页必须位于 call back 之前；call back 之后可以有行动迁移或应用页，但最后一页必须是三组闭环总结 Slide。
4. 每个新增场景必须继续遵守 teachingBrief.mustCover、sourceRefIds、来源保真、叙事视角、场景类型和 Quiz 防泄题合同。
${minimumSceneCount ? `5. 用户要求不少于 ${minimumSceneCount} 页。这只是最低下限，不是停止条件；即使达到 ${minimumSceneCount} 页，只要完整策略链路尚未闭合，就必须继续生成到结构完整。` : '5. 场景数量由完整教学结构决定，不得为了缩短输出而省略策略要求。'}
6. 所有新增场景的 order 必须严格大于 ${outlines.at(-1)?.order ?? outlines.length} 并连续递增。

只返回继续生成所需的完整 SceneOutline 对象。不要输出解释、Markdown 代码围栏、已有场景或整门课程的重写版本。`;
}

/**
 * Extract the languageDirective from the streamed wrapper JSON.
 * Matches `"languageDirective":"<value>"` in partial JSON like:
 *   {"languageDirective":"用中文授课...","outlines":[...
 */
function extractLanguageDirective(buffer: string): string | null {
  // The directive is the first key of the wrapper object, so it can only ever
  // appear in the head of the buffer. Bound the scan to keep this O(1) per
  // streamed chunk — it is called on the full, growing buffer on every chunk,
  // which is otherwise O(n²) over the stream.
  const head = buffer.length > 8192 ? buffer.slice(0, 8192) : buffer;
  const match = head.match(/"languageDirective"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`);
  } catch {
    return match[1];
  }
}

/**
 * Extract the courseTitle from the streamed wrapper JSON.
 * Same head-bound scan as `extractLanguageDirective` — the title is a
 * top-level key near the start of the wrapper object, so it only appears in
 * the buffer head. Returns the decoded title, or null if not yet streamed.
 */
const COURSE_TITLE_RE = /"courseTitle"\s*:\s*"((?:[^"\\]|\\.)*)"/;

// Normalize a captured title identically to the non-streaming parser
// (lib/generation/outline-generator.ts): ignore whitespace-only titles and cap
// length defensively so a hallucinating model cannot push a blank or unbounded
// value into the stage name. Returning null lets callers fall back / keep scanning.
function normalizeStreamedTitle(raw: string): string | null {
  let title: string;
  try {
    title = JSON.parse(`"${raw}"`);
  } catch {
    title = raw;
  }
  const normalized = title.trim();
  return normalized ? normalized.slice(0, 120) : null;
}

function extractCourseTitle(buffer: string): string | null {
  const head = buffer.length > 8192 ? buffer.slice(0, 8192) : buffer;
  const match = head.match(COURSE_TITLE_RE);
  return match ? normalizeStreamedTitle(match[1]) : null;
}

/**
 * Full-buffer fallback, run once after the stream completes: recovers a title
 * the model emitted after the `outlines` array or beyond the 8KB head window —
 * cases the head-bound `extractCourseTitle` scan would miss. Only invoked when
 * the streaming scan produced nothing, so the extra full-buffer regex is paid once.
 */
function extractCourseTitleFromComplete(buffer: string): string | null {
  const match = buffer.match(COURSE_TITLE_RE);
  return match ? normalizeStreamedTitle(match[1]) : null;
}

/**
 * Incremental JSON array parser.
 * Extracts complete top-level objects from a partially-streamed JSON array,
 * resuming from `scanFrom` (an index into `buffer`) so the growing buffer is
 * scanned only ONCE across the whole stream — O(n) total instead of O(n²).
 * Supports both a flat array `[{...},{...}]` and a wrapper object
 * `{"languageDirective":"...","outlines":[{...},{...}]}`, with or without a
 * markdown ```json fence (the array is located by content, not by stripping).
 * Returns newly found objects plus the index to resume scanning from next time.
 */
function extractNewOutlines(
  buffer: string,
  scanFrom: number,
): { outlines: SceneOutline[]; scanFrom: number } {
  const results: SceneOutline[] = [];

  let i: number;
  if (scanFrom > 0) {
    // Resume just past the last fully-parsed object (between array elements,
    // so not inside a string and at brace depth 0).
    i = scanFrom;
  } else {
    // Locate the outlines array opening once.
    const outlinesKeyIdx = buffer.indexOf('"outlines"');
    const arrayStart =
      outlinesKeyIdx >= 0 ? buffer.indexOf('[', outlinesKeyIdx) : buffer.indexOf('[');
    if (arrayStart === -1) return { outlines: results, scanFrom: 0 };
    i = arrayStart + 1;
  }

  let depth = 0;
  let objectStart = -1;
  let inString = false;
  let escaped = false;
  let consumed = i; // index just past the last fully-parsed object

  for (; i < buffer.length; i++) {
    const char = buffer[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (char === '{') {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && objectStart >= 0) {
        try {
          results.push(JSON.parse(buffer.substring(objectStart, i + 1)));
        } catch {
          // Incomplete or invalid JSON — skip
        }
        objectStart = -1;
        consumed = i + 1;
      }
    }
  }

  return { outlines: results, scanFrom: consumed };
}

function normalizeTaskEngineProceduralOutline(
  outline: SceneOutline,
  requirement: string,
): SceneOutline {
  const widgetOutline = outline.widgetOutline ?? {};

  return {
    ...outline,
    type: 'interactive',
    widgetType: 'procedural-skill',
    widgetOutline: {
      ...widgetOutline,
      procedureType: widgetOutline.procedureType ?? 'inspection',
      task: widgetOutline.task || requirement,
      tools:
        widgetOutline.tools && widgetOutline.tools.length > 0
          ? widgetOutline.tools
          : ['required PPE', 'task checklist'],
      steps:
        widgetOutline.steps && widgetOutline.steps.length > 0
          ? widgetOutline.steps
          : ['Confirm task conditions', 'Select required tools', 'Complete safety check'],
      successCriteria:
        widgetOutline.successCriteria && widgetOutline.successCriteria.length > 0
          ? widgetOutline.successCriteria
          : ['Required checks completed', 'Unsafe conditions are not ignored'],
      errorConsequences:
        widgetOutline.errorConsequences && widgetOutline.errorConsequences.length > 0
          ? widgetOutline.errorConsequences
          : ['Unsafe or incorrect actions require stopping and rechecking'],
    },
  };
}

function normalizeTaskEngineSlideOutline(outline: SceneOutline): SceneOutline {
  const normalized: SceneOutline = {
    ...outline,
    type: 'slide',
  };
  delete normalized.widgetType;
  delete normalized.widgetOutline;
  delete normalized.interactiveConfig;
  return normalized;
}

const ORDINARY_WIDGET_TYPES = new Set(['simulation', 'diagram', 'code', 'game', 'visualization3d']);

function normalizeTaskEngineOutline(outline: SceneOutline, requirement: string): SceneOutline {
  if (outline.type === 'slide') {
    return normalizeTaskEngineSlideOutline(outline);
  }

  if (outline.type === 'interactive' && outline.widgetType === 'procedural-skill') {
    return normalizeTaskEngineProceduralOutline(outline, requirement);
  }

  if (
    outline.type === 'interactive' &&
    outline.widgetType &&
    ORDINARY_WIDGET_TYPES.has(outline.widgetType)
  ) {
    return outline;
  }

  return normalizeTaskEngineSlideOutline(outline);
}

function sanitizeNonTaskEngineOutline(outline: SceneOutline): SceneOutline {
  const coverNormalized = normalizeKnowledgeCoverFields(outline);
  if (coverNormalized.widgetType !== 'procedural-skill') {
    return coverNormalized;
  }

  const widgetOutline = { ...(coverNormalized.widgetOutline ?? {}) };
  delete widgetOutline.procedureType;
  delete widgetOutline.task;
  delete widgetOutline.tools;
  delete widgetOutline.steps;
  delete widgetOutline.successCriteria;
  delete widgetOutline.errorConsequences;

  // procedural-skill is gated behind taskEngineMode to protect ordinary MAIC generation.
  return {
    ...coverNormalized,
    type: 'interactive',
    widgetType: 'diagram',
    description: coverNormalized.description
      ? `${coverNormalized.description} Present this as a process or structure diagram.`
      : 'Present this topic as a process or structure diagram.',
    widgetOutline,
  };
}

function ensureUniqueOutlineId(outline: SceneOutline, usedIds: Set<string>): SceneOutline {
  const candidate = typeof outline.id === 'string' && outline.id.trim() ? outline.id : undefined;
  if (candidate && !usedIds.has(candidate)) {
    usedIds.add(candidate);
    return outline;
  }

  let id = nanoid();
  while (usedIds.has(id)) {
    id = nanoid();
  }
  usedIds.add(id);
  return { ...outline, id };
}

export async function POST(req: NextRequest) {
  let requirementSnippet: string | undefined;
  let resolvedModelString: string | undefined;
  let requestId = req.headers.get('x-request-id')?.trim() || nanoid();
  try {
    const body = await req.json();

    if (!body.requirements) {
      return apiError('MISSING_REQUIRED_FIELD', 400, 'Requirements are required');
    }
    if (
      body.requirements.trainingCourseType !== undefined &&
      !isTrainingCourseType(body.requirements.trainingCourseType)
    ) {
      return apiError('INVALID_REQUEST', 400, 'Unknown trainingCourseType');
    }

    // Get API configuration from request headers/body
    const {
      model: languageModel,
      modelInfo,
      modelString,
      thinkingConfig,
    } = await resolveModelFromRequest(req, body, 'scene-outlines-stream');
    resolvedModelString = modelString;

    const {
      requirements,
      pdfText,
      pdfFileName,
      pdfImages,
      imageMapping,
      researchContext,
      agents,
      generationRunId,
    } = body as {
      requirements: UserRequirements;
      pdfText?: string;
      pdfFileName?: string;
      pdfImages?: PdfImage[];
      imageMapping?: ImageMapping;
      researchContext?: string;
      agents?: AgentInfo[];
      generationRunId?: string;
    };
    if (typeof generationRunId === 'string' && generationRunId.trim()) {
      requestId = generationRunId.trim();
    }
    requirementSnippet = requirements?.requirement?.substring(0, 60);

    // Build user profile string for language inference context
    const userProfileText =
      requirements.userNickname || requirements.userBio
        ? `## Student Profile\n\nStudent: ${requirements.userNickname || 'Unknown'}${requirements.userBio ? ` — ${requirements.userBio}` : ''}\n\nConsider this student's background when designing the course. Adapt difficulty, examples, and teaching approach accordingly.\n\n---`
        : '';

    // Detect vision capability
    const hasVision = !!modelInfo?.capabilities?.vision;

    // Build prompt (same logic as generateSceneOutlinesFromRequirements)
    let availableImagesText = 'No images available';
    let visionImages: Array<{ id: string; src: string }> | undefined;

    if (pdfImages && pdfImages.length > 0) {
      if (hasVision && imageMapping) {
        // Vision mode: split into vision images (first N) and text-only (rest)
        const allWithSrc = pdfImages.filter((img) => imageMapping[img.id]);
        const visionSlice = allWithSrc.slice(0, MAX_VISION_IMAGES);
        const textOnlySlice = allWithSrc.slice(MAX_VISION_IMAGES);
        const noSrcImages = pdfImages.filter((img) => !imageMapping[img.id]);

        const visionDescriptions = visionSlice.map((img) => formatImagePlaceholder(img));
        const textDescriptions = [...textOnlySlice, ...noSrcImages].map((img) =>
          formatImageDescription(img),
        );
        availableImagesText = [...visionDescriptions, ...textDescriptions].join('\n');

        visionImages = visionSlice.map((img) => ({
          id: img.id,
          src: imageMapping[img.id],
          width: img.width,
          height: img.height,
        }));
      } else {
        // Text-only mode: full descriptions
        availableImagesText = pdfImages.map((img) => formatImageDescription(img)).join('\n');
      }
    }

    // Build media snippet conditions based on enabled flags.
    const imageGenerationEnabled = req.headers.get('x-image-generation-enabled') === 'true';
    const videoGenerationEnabled = req.headers.get('x-video-generation-enabled') === 'true';
    const mediaGenerationEnabled = imageGenerationEnabled || videoGenerationEnabled;
    const hasSourceImages = (pdfImages?.length ?? 0) > 0;

    // Build teacher context from agents (if available)
    const teacherContext = formatTeacherPersonaForPrompt(agents);

    // Check if Interactive Mode or server-enabled Task Engine mode is enabled.
    const interactiveMode = requirements.interactiveMode ?? false;
    const taskEngineMode = resolveVocationalActive(requirements);
    const promptId = taskEngineMode
      ? PROMPT_IDS.TASK_ENGINE_OUTLINES
      : interactiveMode
        ? PROMPT_IDS.INTERACTIVE_OUTLINES
        : PROMPT_IDS.REQUIREMENTS_TO_OUTLINES;

    const enhancedTrainingCourseType =
      !taskEngineMode &&
      !interactiveMode &&
      isEnhancedTrainingCourseType(requirements.trainingCourseType)
        ? requirements.trainingCourseType
        : undefined;
    const sourceCatalog = enhancedTrainingCourseType
      ? buildSourceCatalog({
          requirement: requirements.requirement,
          pdfText: pdfText?.substring(0, MAX_PDF_CONTENT_CHARS),
          pdfFileName,
        })
      : [];

    const prompts = buildPrompt(promptId, {
      requirement: requirements.requirement,
      pdfContent: pdfText ? pdfText.substring(0, MAX_PDF_CONTENT_CHARS) : 'None',
      availableImages: availableImagesText,
      researchContext: researchContext || 'None',
      hasSourceImages,
      imageEnabled: imageGenerationEnabled,
      videoEnabled: videoGenerationEnabled,
      mediaEnabled: mediaGenerationEnabled,
      teacherContext,
      userProfile: userProfileText,
    });

    if (!prompts) {
      return apiError('INTERNAL_ERROR', 500, 'Prompt template not found');
    }
    if (enhancedTrainingCourseType) {
      prompts.system += `\n\n${MANDATORY_ENHANCED_COVER_SYSTEM_CONTRACT}`;
      prompts.user += buildOutlineFidelityPrompt(enhancedTrainingCourseType, sourceCatalog);
    }

    log.info('Generating outlines', {
      requestId,
      phase: 'outline',
      requirement: requirements.requirement.substring(0, 50),
      model: modelString,
    });

    // Create SSE stream with heartbeat to prevent connection timeout
    const encoder = new TextEncoder();
    const HEARTBEAT_INTERVAL_MS = 15_000;
    const stream = new ReadableStream({
      async start(controller) {
        // Heartbeat: periodically send SSE comments to keep the connection alive.
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
        const startHeartbeat = () => {
          stopHeartbeat();
          heartbeatTimer = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(`:heartbeat\n\n`));
            } catch {
              stopHeartbeat();
            }
          }, HEARTBEAT_INTERVAL_MS);
        };
        const stopHeartbeat = () => {
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
        };

        const MAX_STREAM_RETRIES = 2;
        // Hard ceiling on the accumulated stream buffer. Legitimate outline
        // JSON is small (tens of KB); anything past this is a runaway/degenerate
        // generation and must not be allowed to grow the heap unbounded.
        const MAX_OUTLINE_STREAM_BYTES = 512 * 1024;

        try {
          startHeartbeat();

          const minimumSceneCount = minimumSceneCountFromRequirement(requirements.requirement);
          const makeStreamParams = (prompt: string, signal: AbortSignal) =>
            visionImages?.length
              ? {
                  model: languageModel,
                  system: prompts.system,
                  messages: [
                    {
                      role: 'user' as const,
                      content: buildVisionUserContent(prompt, visionImages),
                    },
                  ],
                  maxOutputTokens: modelInfo?.outputWindow,
                  abortSignal: signal,
                }
              : {
                  model: languageModel,
                  system: prompts.system,
                  prompt,
                  maxOutputTokens: modelInfo?.outputWindow,
                  abortSignal: signal,
                };

          let parsedOutlines: SceneOutline[] = [];
          let languageDirective: string | null = null;
          let courseTitle: string | null = null;
          let lastError: string | undefined;
          let fatalError: { code: OutlineErrorCode; message: string } | undefined;

          for (let attempt = 1; attempt <= MAX_STREAM_RETRIES + 1; attempt++) {
            const attemptControl = createOutlineAttemptSignal(req.signal);
            const attemptStartedAt = Date.now();
            try {
              let fullText = '';
              let scanFrom = 0;
              parsedOutlines = [];
              languageDirective = null;
              courseTitle = null;
              const usedOutlineIds = new Set<string>();
              const streamResult = streamLLM(
                makeStreamParams(prompts.user, attemptControl.signal),
                'scene-outlines-stream',
                thinkingConfig,
              );
              const textStream = streamResult.textStream;

              for await (const chunk of textStream) {
                // Stop doing work the moment the client goes away — otherwise
                // generation keeps running and buffering for a dead connection.
                if (req.signal?.aborted) {
                  stopHeartbeat();
                  return;
                }

                fullText += chunk;

                if (fullText.length > MAX_OUTLINE_STREAM_BYTES) {
                  log.warn(
                    `Outline stream exceeded ${MAX_OUTLINE_STREAM_BYTES} bytes (len=${fullText.length}); stopping read and finalizing with ${parsedOutlines.length} outline(s)`,
                  );
                  break;
                }

                // Try to extract language directive early
                if (!languageDirective) {
                  languageDirective = extractLanguageDirective(fullText);
                  if (languageDirective) {
                    const ldEvent = JSON.stringify({
                      type: 'languageDirective',
                      data: languageDirective,
                    });
                    controller.enqueue(encoder.encode(`data: ${ldEvent}\n\n`));
                  }
                }

                // Try to extract course title early (same pattern as languageDirective)
                if (!courseTitle) {
                  courseTitle = extractCourseTitle(fullText);
                  if (courseTitle) {
                    const ctEvent = JSON.stringify({
                      type: 'courseTitle',
                      data: courseTitle,
                    });
                    controller.enqueue(encoder.encode(`data: ${ctEvent}\n\n`));
                  }
                }

                // Try to extract new outlines from the accumulated text,
                // resuming the scan from where the previous chunk left off.
                const { outlines: newOutlines, scanFrom: nextScanFrom } = extractNewOutlines(
                  fullText,
                  scanFrom,
                );
                scanFrom = nextScanFrom;
                for (const outline of newOutlines) {
                  // Ensure ID and order
                  const enrichedBase = {
                    ...outline,
                    order: parsedOutlines.length + 1,
                  };
                  const modeNormalized = taskEngineMode
                    ? normalizeTaskEngineOutline(enrichedBase, requirements.requirement)
                    : sanitizeNonTaskEngineOutline(enrichedBase);
                  const normalized = enhancedTrainingCourseType
                    ? normalizeFidelityOutline(
                        modeNormalized as SceneOutline & { sourceRefIds?: unknown },
                        enhancedTrainingCourseType,
                        sourceCatalog,
                      )
                    : modeNormalized;
                  const enriched = ensureUniqueOutlineId(normalized, usedOutlineIds);
                  parsedOutlines.push(enriched);

                  const event = JSON.stringify({
                    type: 'outline',
                    data: enhancedTrainingCourseType
                      ? stripFidelityForStreaming(enriched)
                      : enriched,
                    index: parsedOutlines.length - 1,
                  });
                  controller.enqueue(encoder.encode(`data: ${event}\n\n`));
                }
              }

              const finishReason = await streamResult.finishReason;
              const durationMs = Date.now() - attemptStartedAt;
              attemptControl.cleanup();
              log.info('Outline attempt completed', {
                requestId,
                phase: 'outline',
                attempt,
                maxAttempts: MAX_STREAM_RETRIES + 1,
                durationMs,
                outlineCount: parsedOutlines.length,
                textLength: fullText.length,
                finishReason: finishReason ?? 'unknown',
              });

              if (attemptControl.didTimeout()) {
                fatalError = {
                  code: 'ATTEMPT_TIMEOUT',
                  message: `Outline model attempt exceeded ${OUTLINE_ATTEMPT_TIMEOUT_MS / 1000}s`,
                };
                log.error('Outline model attempt timed out', {
                  requestId,
                  code: fatalError.code,
                  phase: 'outline',
                  attempt,
                  durationMs,
                  outlineCount: parsedOutlines.length,
                  model: modelString,
                });
                break;
              }

              if (finishReason === 'length') {
                lastError = 'The outline model output ended before the JSON structure completed';
                log.warn('Outline model output ended at its limit', {
                  requestId,
                  code: 'OUTLINE_OUTPUT_INCOMPLETE',
                  phase: 'outline',
                  attempt,
                  durationMs,
                  outlineCount: parsedOutlines.length,
                  textLength: fullText.length,
                });
              }

              // Validate: got outlines?
              if (parsedOutlines.length > 0) {
                const missingRequiredEvidence =
                  !!enhancedTrainingCourseType &&
                  sourceCatalog.length > 0 &&
                  parsedOutlines.some(
                    (outline) =>
                      !Array.isArray(outline.sourceEvidence) || outline.sourceEvidence.length === 0,
                  );
                if (missingRequiredEvidence) {
                  lastError =
                    'The generated outline could not be linked to the supplied source evidence';
                  log.warn(
                    `Outlines attempt ${attempt} left enhanced scenes without source evidence; rejecting the attempt`,
                  );
                  parsedOutlines = [];
                  if (attempt <= MAX_STREAM_RETRIES) {
                    const retryEvent = JSON.stringify({
                      type: 'retry',
                      attempt,
                      maxAttempts: MAX_STREAM_RETRIES + 1,
                    });
                    controller.enqueue(encoder.encode(`data: ${retryEvent}\n\n`));
                  }
                  continue;
                }
                const missingRequiredQuiz =
                  !!enhancedTrainingCourseType &&
                  !satisfiesExplicitQuizRequirement(requirements.requirement, parsedOutlines);
                if (missingRequiredQuiz) {
                  lastError =
                    'The generated outline omitted a Quiz explicitly required by the user';
                  log.warn(
                    `Outlines attempt ${attempt} omitted an explicitly required Quiz; rejecting the attempt`,
                  );
                  parsedOutlines = [];
                  if (attempt <= MAX_STREAM_RETRIES) {
                    const retryEvent = JSON.stringify({
                      type: 'retry',
                      attempt,
                      maxAttempts: MAX_STREAM_RETRIES + 1,
                    });
                    controller.enqueue(encoder.encode(`data: ${retryEvent}\n\n`));
                  }
                  continue;
                }
                const missingKnowledgeCover =
                  !taskEngineMode &&
                  !satisfiesKnowledgeCoverStructure(parsedOutlines, {
                    allowDirectPblOpening: !enhancedTrainingCourseType,
                  });
                if (missingKnowledgeCover) {
                  lastError =
                    'The generated knowledge outline omitted the required first cover slide';
                  log.warn(
                    `Outlines attempt ${attempt} omitted the knowledge cover structure; rejecting the attempt`,
                  );
                  parsedOutlines = [];
                  if (attempt <= MAX_STREAM_RETRIES) {
                    const retryEvent = JSON.stringify({
                      type: 'retry',
                      attempt,
                      maxAttempts: MAX_STREAM_RETRIES + 1,
                    });
                    controller.enqueue(encoder.encode(`data: ${retryEvent}\n\n`));
                  }
                  continue;
                }
                const missingManagementBCStructure =
                  enhancedTrainingCourseType === 'management' &&
                  (!satisfiesManagementBCStructure(parsedOutlines) ||
                    (minimumSceneCount !== undefined && parsedOutlines.length < minimumSceneCount));
                if (missingManagementBCStructure) {
                  const repairEvent = JSON.stringify({
                    type: 'retry',
                    requestId,
                    strategy: 'targeted-structure-repair',
                    attempt,
                    missing: ['management_strategy_contract'],
                  });
                  controller.enqueue(encoder.encode(`data: ${repairEvent}\n\n`));
                  log.warn('Management B+C structure incomplete; starting targeted repair', {
                    requestId,
                    code: 'STRUCTURE_REPAIR_REQUIRED',
                    phase: 'outline-structure-repair',
                    attempt,
                    outlineCount: parsedOutlines.length,
                    minimumSceneCount,
                    model: modelString,
                  });

                  const repairControl = createOutlineAttemptSignal(req.signal);
                  const repairStartedAt = Date.now();
                  let repairText = '';
                  try {
                    const repairResult = streamLLM(
                      makeStreamParams(
                        buildManagementRepairPrompt(
                          requirements.requirement,
                          parsedOutlines,
                          buildOutlineFidelityPrompt('management', sourceCatalog),
                          minimumSceneCount,
                        ),
                        repairControl.signal,
                      ),
                      'scene-outlines-structure-repair',
                      thinkingConfig,
                    );
                    for await (const chunk of repairResult.textStream) {
                      if (req.signal?.aborted) {
                        stopHeartbeat();
                        return;
                      }
                      repairText += chunk;
                      if (repairText.length > MAX_OUTLINE_STREAM_BYTES) break;
                    }
                    const repairFinishReason = await repairResult.finishReason;
                    const repairDurationMs = Date.now() - repairStartedAt;
                    if (repairControl.didTimeout()) {
                      fatalError = {
                        code: 'ATTEMPT_TIMEOUT',
                        message: `Outline structure repair exceeded ${OUTLINE_ATTEMPT_TIMEOUT_MS / 1000}s`,
                      };
                      log.error('Outline structure repair timed out', {
                        requestId,
                        code: fatalError.code,
                        phase: 'outline-structure-repair',
                        attempt,
                        durationMs: repairDurationMs,
                        outlineCount: parsedOutlines.length,
                        model: modelString,
                      });
                      break;
                    }

                    const repairOutlines = extractNewOutlines(repairText, 0).outlines;
                    if (repairFinishReason === 'length' || repairOutlines.length === 0) {
                      fatalError = {
                        code: 'STRUCTURE_REPAIR_FAILED',
                        message:
                          'Targeted management B+C structure repair returned incomplete output',
                      };
                    } else {
                      const repaired = repairOutlines.map((outline, index) => {
                        const enrichedBase = {
                          ...outline,
                          // Repair is continuation-only: ignore model attempts to
                          // insert/reorder existing scenes and append after the
                          // last accepted outline in generation order.
                          order: parsedOutlines.length + index + 1,
                        };
                        const modeNormalized = sanitizeNonTaskEngineOutline(enrichedBase);
                        const normalized = normalizeFidelityOutline(
                          modeNormalized as SceneOutline & { sourceRefIds?: unknown },
                          'management',
                          sourceCatalog,
                        );
                        return ensureUniqueOutlineId(normalized, usedOutlineIds);
                      });
                      const repairedIds = new Set(repaired.map((outline) => outline.id));
                      parsedOutlines = [...parsedOutlines, ...repaired]
                        .sort((a, b) => a.order - b.order)
                        .map((outline, index) => ({ ...outline, order: index + 1 }));

                      for (const [index, outline] of parsedOutlines.entries()) {
                        if (!repairedIds.has(outline.id)) continue;
                        const event = JSON.stringify({
                          type: 'outline',
                          data: stripFidelityForStreaming(outline),
                          index,
                          repaired: true,
                        });
                        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
                      }

                      log.info('Management B+C targeted repair completed', {
                        requestId,
                        phase: 'outline-structure-repair',
                        attempt,
                        durationMs: repairDurationMs,
                        addedOutlineCount: repaired.length,
                        outlineCount: parsedOutlines.length,
                        finishReason: repairFinishReason ?? 'unknown',
                        model: modelString,
                      });
                      if (
                        !satisfiesManagementBCStructure(parsedOutlines) ||
                        (minimumSceneCount !== undefined &&
                          parsedOutlines.length < minimumSceneCount)
                      ) {
                        fatalError = {
                          code: 'STRUCTURE_REPAIR_FAILED',
                          message:
                            'Targeted repair did not produce the required management B+C structure',
                        };
                      }
                    }
                  } catch (error) {
                    if (repairControl.didTimeout()) {
                      fatalError = {
                        code: 'ATTEMPT_TIMEOUT',
                        message: `Outline structure repair exceeded ${OUTLINE_ATTEMPT_TIMEOUT_MS / 1000}s`,
                      };
                    } else {
                      fatalError = {
                        code: 'STRUCTURE_REPAIR_FAILED',
                        message: error instanceof Error ? error.message : String(error),
                      };
                    }
                    log.error('Management B+C targeted repair failed', {
                      requestId,
                      code: fatalError.code,
                      phase: 'outline-structure-repair',
                      attempt,
                      durationMs: Date.now() - repairStartedAt,
                      outlineCount: parsedOutlines.length,
                      model: modelString,
                      error,
                    });
                  } finally {
                    repairControl.cleanup();
                  }
                  break;
                }
                if (!courseTitle) {
                  // The head-bound streaming scan can miss a title the model
                  // placed after the outlines array or past the 8KB head window;
                  // recover it from the now-complete response before finalizing.
                  courseTitle = extractCourseTitleFromComplete(fullText);
                }
                break;
              }

              // Empty result — retry if we have attempts left
              lastError = fullText.trim()
                ? 'LLM response could not be parsed into outlines'
                : 'LLM returned empty response';
              log.warn(
                `Outlines attempt ${attempt} diagnostics: textLen=${fullText.length}, outlines=${parsedOutlines.length}, languageDirective=${languageDirective ? 'yes' : 'no'}, preview=${JSON.stringify(fullText.slice(0, 240))}`,
              );

              if (attempt <= MAX_STREAM_RETRIES) {
                log.warn(
                  `Empty outlines (attempt ${attempt}/${MAX_STREAM_RETRIES + 1}), retrying...`,
                );
                // Notify client a retry is happening
                const retryEvent = JSON.stringify({
                  type: 'retry',
                  attempt,
                  maxAttempts: MAX_STREAM_RETRIES + 1,
                });
                controller.enqueue(encoder.encode(`data: ${retryEvent}\n\n`));
              }
            } catch (error) {
              const durationMs = Date.now() - attemptStartedAt;
              attemptControl.cleanup();
              // Client disconnected (AbortError from the now-propagated signal):
              // stop immediately, don't burn retries re-running generation.
              if (req.signal?.aborted) {
                stopHeartbeat();
                return;
              }
              if (attemptControl.didTimeout()) {
                fatalError = {
                  code: 'ATTEMPT_TIMEOUT',
                  message: `Outline model attempt exceeded ${OUTLINE_ATTEMPT_TIMEOUT_MS / 1000}s`,
                };
                log.error('Outline model attempt timed out', {
                  requestId,
                  code: fatalError.code,
                  phase: 'outline',
                  attempt,
                  durationMs,
                  outlineCount: parsedOutlines.length,
                  model: modelString,
                  error,
                });
                break;
              }
              lastError = error instanceof Error ? error.message : String(error);
              log.warn(
                `Outlines stream error detail (attempt ${attempt}/${MAX_STREAM_RETRIES + 1}): ${lastError}`,
                {
                  requestId,
                  code: 'OUTLINE_GENERATION_FAILED',
                  phase: 'outline',
                  attempt,
                  durationMs,
                  outlineCount: parsedOutlines.length,
                  model: modelString,
                  error,
                },
              );

              if (attempt <= MAX_STREAM_RETRIES) {
                log.warn(
                  `Stream error (attempt ${attempt}/${MAX_STREAM_RETRIES + 1}), retrying...`,
                  error,
                );
                const retryEvent = JSON.stringify({
                  type: 'retry',
                  attempt,
                  maxAttempts: MAX_STREAM_RETRIES + 1,
                });
                controller.enqueue(encoder.encode(`data: ${retryEvent}\n\n`));
                continue;
              }
            }
          }

          if (fatalError) {
            log.error('Outline generation failed', {
              requestId,
              code: fatalError.code,
              phase: 'outline',
              model: modelString,
              outlineCount: parsedOutlines.length,
              error: fatalError.message,
            });
            const errorEvent = JSON.stringify({
              type: 'error',
              code: fatalError.code,
              requestId,
              error: fatalError.message,
            });
            controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
          } else if (parsedOutlines.length > 0) {
            // Replace sequential gen_img_N/gen_vid_N with globally unique IDs
            const uniquifiedOutlines = uniquifyMediaElementIds(parsedOutlines);
            // Send done event with all outlines
            const doneEvent = JSON.stringify({
              type: 'done',
              requestId,
              outlines: uniquifiedOutlines,
              languageDirective: languageDirective || DEFAULT_LANGUAGE_DIRECTIVE,
              courseTitle: courseTitle || undefined,
              taskEngineMode,
            });
            controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
          } else {
            // All retries exhausted, no outlines produced
            log.error('Outline generation failed after retries', {
              requestId,
              code: 'OUTLINE_GENERATION_FAILED',
              phase: 'outline',
              model: modelString,
              attempts: MAX_STREAM_RETRIES + 1,
              outlineCount: parsedOutlines.length,
              error: lastError || 'Failed to generate outlines',
            });
            const errorEvent = JSON.stringify({
              type: 'error',
              code: 'OUTLINE_GENERATION_FAILED' satisfies OutlineErrorCode,
              requestId,
              error: lastError || 'Failed to generate outlines',
            });
            controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
          }
        } catch (error) {
          log.error('Outline SSE stream failed', {
            requestId,
            code: 'OUTLINE_GENERATION_FAILED',
            phase: 'outline',
            model: modelString,
            error,
          });
          const errorEvent = JSON.stringify({
            type: 'error',
            code: 'OUTLINE_GENERATION_FAILED' satisfies OutlineErrorCode,
            requestId,
            error: error instanceof Error ? error.message : String(error),
          });
          controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
        } finally {
          stopHeartbeat();
          // The controller may already be closed if the client disconnected.
          try {
            controller.close();
          } catch {
            // already closed — ignore
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    log.error(
      `Outline streaming failed [requirement="${requirementSnippet ?? 'unknown'}...", model=${resolvedModelString ?? 'unknown'}]:`,
      { requestId },
      error,
    );
    return apiError('INTERNAL_ERROR', 500, error instanceof Error ? error.message : String(error));
  }
}
