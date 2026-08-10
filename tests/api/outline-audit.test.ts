import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  callLLM: vi.fn(),
  resolveModel: vi.fn(),
  getStageRoute: vi.fn(),
  resolveVocationalActive: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('@/lib/ai/llm', () => ({ callLLM: mocks.callLLM }));
vi.mock('@/lib/server/resolve-model', () => ({ resolveModel: mocks.resolveModel }));
vi.mock('@/lib/server/model-routes', () => ({ getStageRoute: mocks.getStageRoute }));
vi.mock('@/lib/config/feature-flags', () => ({
  resolveVocationalActive: mocks.resolveVocationalActive,
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: mocks.logInfo, warn: mocks.logWarn }),
}));

import { POST } from '@/app/api/generate/outline-audit/route';

const PASS = JSON.stringify({
  verdict: 'pass',
  summary: 'No evidence-backed defect was found.',
  findings: [],
});

function body(overrides: Record<string, unknown> = {}) {
  return {
    outlineRevision: 1,
    requirements: { requirement: 'Create a concise ordinary course.', trainingCourseType: 'other' },
    outlines: [
      {
        id: 'scene-1',
        order: 1,
        type: 'slide',
        title: 'Introduction',
        description: 'Introduce the subject.',
        keyPoints: ['Core concept'],
      },
    ],
    courseTitle: 'Course',
    languageDirective: 'Teach in English.',
    interactiveMode: false,
    taskEngineMode: false,
    ...overrides,
  };
}

function request(payload = body(), headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/generate/outline-audit', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(payload),
  });
}

describe('POST /api/generate/outline-audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStageRoute.mockReturnValue({
      model: 'doubao:doubao-seed-evolving',
      thinking: { mode: 'enabled', effort: 'low', excludeReasoningOutput: true },
    });
    mocks.resolveVocationalActive.mockReturnValue(false);
    mocks.resolveModel.mockResolvedValue({
      model: { id: 'server-doubao-model' },
      modelInfo: {},
      modelString: 'doubao:doubao-seed-evolving',
      providerId: 'doubao',
      modelId: 'doubao-seed-evolving',
      apiKey: 'server-only-key',
      thinkingConfig: { mode: 'enabled', effort: 'low', excludeReasoningOutput: true },
    });
    mocks.callLLM.mockResolvedValue({ text: PASS });
  });

  it('requires the explicit fixed route instead of falling back to DEFAULT_MODEL', async () => {
    mocks.getStageRoute.mockReturnValue(undefined);
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      auditError: { code: 'configuration_missing', retryable: false },
    });
    expect(mocks.resolveModel).not.toHaveBeenCalled();

    mocks.getStageRoute.mockReturnValue({ model: 'openai:gpt-5.4' });
    const mismatch = await POST(request());
    expect(mismatch.status).toBe(503);
    expect(await mismatch.json()).toMatchObject({ auditError: { code: 'provider_mismatch' } });
  });

  it('ignores browser x-model credentials and resolves only the server audit stage', async () => {
    const response = await POST(
      request(body(), {
        'x-model': 'openai:gpt-5.4',
        'x-api-key': 'browser-key-must-not-be-used',
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.resolveModel).toHaveBeenCalledWith({ stage: 'outline-adversarial-review' });
    expect(mocks.callLLM).toHaveBeenCalledTimes(1);
    expect(mocks.callLLM.mock.calls[0]?.[3]).toEqual({
      mode: 'enabled',
      effort: 'low',
      excludeReasoningOutput: true,
    });
    const data = await response.json();
    expect(data.result).toMatchObject({
      baseRevision: 1,
      verdict: 'pass',
      providerId: 'doubao',
      modelId: 'doubao-seed-evolving',
    });
  });

  it('reports a missing server Doubao key without calling the model', async () => {
    mocks.resolveModel.mockResolvedValue({
      model: {},
      modelString: 'doubao:doubao-seed-evolving',
      providerId: 'doubao',
      modelId: 'doubao-seed-evolving',
      apiKey: '',
    });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ auditError: { code: 'missing_api_key' } });
    expect(mocks.callLLM).not.toHaveBeenCalled();
  });

  it('performs at most one internal contract repair and then fails closed with diagnostics', async () => {
    mocks.callLLM
      .mockResolvedValueOnce({ text: 'not json' })
      .mockResolvedValueOnce({ text: 'still no' });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      auditError: {
        code: 'invalid_response',
        auditId: expect.stringMatching(/^oa_/),
        phase: 'parse',
        reasonCode: 'json_unparseable',
      },
    });
    expect(mocks.callLLM).toHaveBeenCalledTimes(2);
    expect(mocks.callLLM.mock.calls[1][0].prompt).toContain(
      'CONTRACT REPAIR: The previous attempt failed the parse contract (json_unparseable)',
    );
  });

  it('repairs a parseable schema violation once and accepts a valid regenerated result', async () => {
    mocks.callLLM
      .mockResolvedValueOnce({ text: JSON.stringify({ verdict: 'pass', summary: '', findings: [] }) })
      .mockResolvedValueOnce({ text: PASS });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: { verdict: 'pass' } });
    expect(mocks.callLLM).toHaveBeenCalledTimes(2);
  });

  it('retries a parseable unsafe patch once and still fails closed', async () => {
    mocks.callLLM.mockResolvedValue({
      text: JSON.stringify({
        verdict: 'changes_proposed',
        summary: 'Unsafe suggestion.',
        findings: [
          {
            id: 'f1',
            severity: 'error',
            category: 'scene_configuration_error',
            relatedSceneIds: ['scene-1'],
            reason: 'Attempt to edit a protected field.',
            evidence: [],
            before: 'Order 1',
            after: 'Order 9',
            operations: [{ type: 'update_field', sceneId: 'scene-1', field: 'order', value: 9 }],
          },
        ],
      }),
    });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      auditError: {
        code: 'invalid_response',
        auditId: expect.stringMatching(/^oa_/),
        phase: 'schema',
        reasonCode: 'operation_not_allowed',
      },
    });
    expect(mocks.callLLM).toHaveBeenCalledTimes(2);
    const warning = mocks.logWarn.mock.calls.at(-1)?.[1];
    expect(warning).toMatchObject({ phase: 'schema', reasonCode: 'operation_not_allowed' });
    expect(JSON.stringify(warning)).not.toContain('Attempt to edit a protected field');
    expect(JSON.stringify(warning)).not.toContain('Core concept');
  });

  it('maps rate limits and skips excluded generation modes', async () => {
    mocks.callLLM.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }));
    const limited = await POST(request());
    expect(limited.status).toBe(429);
    expect(await limited.json()).toMatchObject({ auditError: { code: 'rate_limited' } });

    vi.clearAllMocks();
    mocks.resolveVocationalActive.mockReturnValue(false);
    const interactive = await POST(
      request(
        body({
          interactiveMode: true,
          requirements: { requirement: 'Interactive', interactiveMode: true },
        }),
      ),
    );
    expect(interactive.status).toBe(400);
    expect(await interactive.json()).toMatchObject({ auditError: { code: 'invalid_request' } });
    expect(mocks.resolveModel).not.toHaveBeenCalled();
    expect(mocks.callLLM).not.toHaveBeenCalled();
  });

  it('maps upstream failures and request cancellation without a fallback model', async () => {
    mocks.callLLM.mockRejectedValueOnce(Object.assign(new Error('upstream'), { status: 503 }));
    const upstream = await POST(request());
    expect(upstream.status).toBe(502);
    expect(await upstream.json()).toMatchObject({ auditError: { code: 'upstream_failed' } });

    const controller = new AbortController();
    mocks.callLLM.mockImplementationOnce(
      ({ abortSignal }: { abortSignal: AbortSignal }) =>
        new Promise((_, reject) => {
          abortSignal.addEventListener(
            'abort',
            () => reject(abortSignal.reason ?? new DOMException('Aborted', 'AbortError')),
            { once: true },
          );
        }),
    );
    const cancellable = new NextRequest('http://localhost/api/generate/outline-audit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body()),
      signal: controller.signal,
    });
    const pending = POST(cancellable);
    for (let index = 0; index < 20 && mocks.callLLM.mock.calls.length < 2; index += 1) {
      await Promise.resolve();
    }
    controller.abort();
    const cancelled = await pending;
    expect(cancelled.status).toBe(499);
    expect(await cancelled.json()).toMatchObject({ auditError: { code: 'cancelled' } });
    expect(mocks.resolveModel).toHaveBeenCalledTimes(2);
  });

  it('terminates a slow Doubao call with a distinguishable timeout', async () => {
    vi.useFakeTimers();
    try {
      mocks.callLLM.mockImplementationOnce(
        ({ abortSignal }: { abortSignal: AbortSignal }) =>
          new Promise((_, reject) => {
            abortSignal.addEventListener(
              'abort',
              () => reject(abortSignal.reason ?? new DOMException('Timed out', 'TimeoutError')),
              { once: true },
            );
          }),
      );
      const pending = POST(request());
      for (let index = 0; index < 20 && mocks.callLLM.mock.calls.length === 0; index += 1) {
        await Promise.resolve();
      }
      expect(mocks.callLLM).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(90_001);
      const response = await pending;
      expect(response.status).toBe(504);
      expect(await response.json()).toMatchObject({ auditError: { code: 'timeout' } });
    } finally {
      vi.useRealTimers();
    }
  });
});
