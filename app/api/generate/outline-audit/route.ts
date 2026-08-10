import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { callLLM } from '@/lib/ai/llm';
import { resolveVocationalActive } from '@/lib/config/feature-flags';
import {
  buildAuditSourceCatalog,
  normalizeOutlineAuditModelOutput,
  OutlineAuditValidationError,
} from '@/lib/generation/outline-audit';
import { buildOutlineAuditPrompts } from '@/lib/generation/outline-audit-prompt';
import type {
  OutlineAuditErrorCode,
  OutlineAuditRequest,
  OutlineAuditResult,
  OutlineAuditFailurePhase,
  OutlineAuditFailureReason,
} from '@/lib/generation/outline-audit-types';
import { parseJsonResponse } from '@/lib/generation/json-repair';
import { isTrainingCourseType } from '@/lib/generation/input-fidelity';
import { createLogger } from '@/lib/logger';
import { getStageRoute } from '@/lib/server/model-routes';
import { resolveModel } from '@/lib/server/resolve-model';

const log = createLogger('OutlineAudit');
const AUDIT_STAGE = 'outline-adversarial-review' as const;
const REQUIRED_MODEL = 'doubao:doubao-seed-evolving';
const AUDIT_TIMEOUT_MS = 90_000;

export const maxDuration = 120;

function auditError(
  code: OutlineAuditErrorCode,
  status: number,
  message: string,
  retryable: boolean,
  meta?: { auditId?: string; phase?: OutlineAuditFailurePhase; reasonCode?: OutlineAuditFailureReason },
) {
  return NextResponse.json(
    { success: false as const, auditError: { code, message, retryable, ...meta } },
    { status },
  );
}

function upstreamStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  const status = candidate.status ?? candidate.statusCode;
  return typeof status === 'number' ? status : undefined;
}

function createAuditSignal(requestSignal: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort(requestSignal.reason);
  if (requestSignal.aborted) onAbort();
  else requestSignal.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException('Outline audit timed out', 'TimeoutError'));
  }, AUDIT_TIMEOUT_MS);
  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      requestSignal.removeEventListener('abort', onAbort);
    },
  };
}

function validateRequest(value: unknown): OutlineAuditRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OutlineAuditValidationError('Request body must be an object');
  }
  const body = value as Partial<OutlineAuditRequest>;
  if (!Number.isInteger(body.outlineRevision) || (body.outlineRevision ?? 0) < 1) {
    throw new OutlineAuditValidationError('outlineRevision must be a positive integer');
  }
  if (!body.requirements?.requirement?.trim()) {
    throw new OutlineAuditValidationError('requirements.requirement is required');
  }
  if (
    body.requirements.trainingCourseType !== undefined &&
    !isTrainingCourseType(body.requirements.trainingCourseType)
  ) {
    throw new OutlineAuditValidationError('Unknown trainingCourseType');
  }
  if (!Array.isArray(body.outlines) || body.outlines.length === 0 || body.outlines.length > 100) {
    throw new OutlineAuditValidationError('outlines must contain 1 to 100 scenes');
  }
  if (typeof body.interactiveMode !== 'boolean' || typeof body.taskEngineMode !== 'boolean') {
    throw new OutlineAuditValidationError(
      'interactiveMode and taskEngineMode are required booleans',
    );
  }
  return body as OutlineAuditRequest;
}

async function runReviewerCall(input: {
  model: Awaited<ReturnType<typeof resolveModel>>;
  prompts: { system: string; prompt: string };
  signal: AbortSignal;
  repair?: { phase: OutlineAuditFailurePhase; reasonCode: OutlineAuditFailureReason };
}) {
  const prompt = input.repair
    ? `${input.prompts.prompt}\n\nCONTRACT REPAIR: The previous attempt failed the ${input.repair.phase} contract (${input.repair.reasonCode}). Regenerate the complete audit response from the input and exact schema. Return only one valid JSON object; do not mention this repair or add Markdown.`
    : input.prompts.prompt;
  return (
    await callLLM(
      {
        model: input.model.model,
        system: input.prompts.system,
        prompt,
        maxOutputTokens: 12_000,
        temperature: 0,
        abortSignal: input.signal,
      },
      AUDIT_STAGE,
      undefined,
      input.model.thinkingConfig,
    )
  ).text;
}

function looksLikeAuditEnvelope(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.verdict === 'pass' || record.verdict === 'changes_proposed') &&
    typeof record.summary === 'string' &&
    Array.isArray(record.findings)
  );
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const auditId = `oa_${nanoid(16)}`;
  let inputLength = 0;
  let responseLength = 0;
  let attemptCount = 0;
  let sceneCount = 0;
  let resolvedModel: Awaited<ReturnType<typeof resolveModel>> | undefined;
  let signalHandle: ReturnType<typeof createAuditSignal> | undefined;
  try {
    let body: OutlineAuditRequest;
    try {
      body = validateRequest(await req.json());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid audit request';
      return auditError('invalid_request', 400, message, false);
    }

    const effectiveInteractive = body.interactiveMode || body.requirements.interactiveMode === true;
    const effectiveTaskEngine =
      body.taskEngineMode || resolveVocationalActive(body.requirements) === true;
    if (effectiveInteractive || effectiveTaskEngine) {
      return auditError(
        'invalid_request',
        400,
        'Outline adversarial review is not available for Interactive or task-engine generation.',
        false,
      );
    }

    const route = getStageRoute(AUDIT_STAGE);
    if (!route) {
      return auditError(
        'configuration_missing',
        503,
        'Doubao Seed Evolving outline audit is not configured on the server.',
        false,
      );
    }
    if (route.model !== REQUIRED_MODEL) {
      return auditError(
        'provider_mismatch',
        503,
        `Outline audit must be routed to ${REQUIRED_MODEL}.`,
        false,
      );
    }

    resolvedModel = await resolveModel({ stage: AUDIT_STAGE });
    if (resolvedModel.providerId !== 'doubao' || resolvedModel.modelId !== 'doubao-seed-evolving') {
      return auditError(
        'provider_mismatch',
        503,
        `Outline audit must use ${REQUIRED_MODEL}.`,
        false,
      );
    }
    if (!resolvedModel.apiKey?.trim()) {
      return auditError(
        'missing_api_key',
        503,
        'The server Doubao API key is not configured.',
        false,
      );
    }

    const trustedSources = buildAuditSourceCatalog({
      requirement: body.requirements.requirement,
      pdfText: body.pdfText,
      pdfFileName: body.pdfFileName,
      ...(body.requirements.webSearch
        ? {
            researchContext: body.researchContext,
            researchSources: body.researchSources,
          }
        : {}),
    });
    const prompts = buildOutlineAuditPrompts(body, trustedSources);
    sceneCount = body.outlines.length;
    inputLength = prompts.system.length + prompts.prompt.length;
    signalHandle = createAuditSignal(req.signal);

    attemptCount = 1;
    let raw = await runReviewerCall({
      model: resolvedModel,
      prompts,
      signal: signalHandle.signal,
    });
    responseLength += raw.length;
    let parsed = parseJsonResponse<unknown>(raw, { suppressLogs: true });
    let normalized;
    let repair: { phase: OutlineAuditFailurePhase; reasonCode: OutlineAuditFailureReason } | undefined;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        if (!looksLikeAuditEnvelope(parsed)) {
          throw new OutlineAuditValidationError('invalid audit envelope', 'parse', 'json_unparseable');
        }
        normalized = normalizeOutlineAuditModelOutput(parsed, body.outlines, {
          requirements: body.requirements,
          trustedSources,
        });
        break;
      } catch (error) {
        if (!(error instanceof OutlineAuditValidationError) || attempt === 2) throw error;
        repair = { phase: error.phase, reasonCode: error.reasonCode };
        attemptCount = 2;
        raw = await runReviewerCall({ model: resolvedModel, prompts, signal: signalHandle.signal, repair });
        responseLength += raw.length;
        parsed = parseJsonResponse<unknown>(raw, { suppressLogs: true });
      }
    }
    if (!normalized) throw new OutlineAuditValidationError('audit normalization failed');
    const completedAt = new Date().toISOString();
    const result: OutlineAuditResult = {
      auditId,
      baseRevision: body.outlineRevision,
      verdict: normalized.verdict,
      summary: normalized.summary,
      findings: normalized.findings,
      providerId: 'doubao',
      modelId: 'doubao-seed-evolving',
      completedAt,
    };
    log.info('Outline audit completed', {
      auditId,
      model: resolvedModel.modelString,
      inputLength,
      responseLength,
      attempt: attemptCount,
      sceneCount,
      findingCount: result.findings.length,
      durationMs: Date.now() - startedAt,
      status: result.verdict,
    });
    return NextResponse.json({ success: true as const, result });
  } catch (error) {
    const status = upstreamStatus(error);
    let code: OutlineAuditErrorCode = 'upstream_failed';
    let httpStatus = 502;
    let message = 'Doubao Seed Evolving outline audit failed. Please retry.';
    const retryable = true;
    if (signalHandle?.didTimeOut()) {
      code = 'timeout';
      httpStatus = 504;
      message = 'Doubao Seed Evolving outline audit timed out. Please retry.';
    } else if (req.signal.aborted) {
      code = 'cancelled';
      httpStatus = 499;
      message = 'Outline audit was cancelled.';
    } else if (error instanceof OutlineAuditValidationError) {
      code = 'invalid_response';
      httpStatus = 502;
      message = 'Audit result failed the safety contract. No changes were applied; please retry or skip manually.';
    } else if (status === 429) {
      code = 'rate_limited';
      httpStatus = 429;
      message = 'Doubao is rate limited. Please retry shortly.';
    } else if (status && status >= 400) {
      code = 'upstream_failed';
      httpStatus = status >= 500 ? 502 : status;
    }
    log.warn('Outline audit failed', {
      auditId,
      model: resolvedModel?.modelString,
      inputLength,
      responseLength,
      attempt: attemptCount,
      sceneCount,
      findingCount: 0,
      durationMs: Date.now() - startedAt,
      status: code,
      phase: error instanceof OutlineAuditValidationError ? error.phase : undefined,
      reasonCode: error instanceof OutlineAuditValidationError ? error.reasonCode : undefined,
    });
    return auditError(code, httpStatus, message, retryable, {
      auditId,
      ...(error instanceof OutlineAuditValidationError
        ? { phase: error.phase, reasonCode: error.reasonCode }
        : {}),
    });
  } finally {
    signalHandle?.dispose();
  }
}
