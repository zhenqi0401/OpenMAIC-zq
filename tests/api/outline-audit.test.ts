import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  callLLM: vi.fn(),
  resolveModel: vi.fn(),
  getStageRoute: vi.fn(),
  resolveVocationalActive: vi.fn(),
}));

vi.mock('@/lib/ai/llm', () => ({ callLLM: mocks.callLLM }));
vi.mock('@/lib/server/resolve-model', () => ({ resolveModel: mocks.resolveModel }));
vi.mock('@/lib/server/model-routes', () => ({ getStageRoute: mocks.getStageRoute }));
vi.mock('@/lib/config/feature-flags', () => ({
  resolveVocationalActive: mocks.resolveVocationalActive,
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
      model: 'deepseek:deepseek-v4-flash',
      thinking: { mode: 'enabled', effort: 'high', excludeReasoningOutput: true },
    });
    mocks.resolveVocationalActive.mockReturnValue(false);
    mocks.resolveModel.mockResolvedValue({
      model: { id: 'server-deepseek-model' },
      modelInfo: {},
      modelString: 'deepseek:deepseek-v4-flash',
      providerId: 'deepseek',
      modelId: 'deepseek-v4-flash',
      apiKey: 'server-only-key',
      thinkingConfig: { mode: 'enabled', effort: 'high', excludeReasoningOutput: true },
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
    const data = await response.json();
    expect(data.result).toMatchObject({
      baseRevision: 1,
      verdict: 'pass',
      providerId: 'deepseek',
      modelId: 'deepseek-v4-flash',
    });
  });

  it('reports a missing server DeepSeek key without calling the model', async () => {
    mocks.resolveModel.mockResolvedValue({
      model: {},
      modelString: 'deepseek:deepseek-v4-flash',
      providerId: 'deepseek',
      modelId: 'deepseek-v4-flash',
      apiKey: '',
    });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ auditError: { code: 'missing_api_key' } });
    expect(mocks.callLLM).not.toHaveBeenCalled();
  });

  it('performs at most one internal format retry and then fails closed', async () => {
    mocks.callLLM
      .mockResolvedValueOnce({ text: 'not json' })
      .mockResolvedValueOnce({ text: 'still no' });
    const response = await POST(request());
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ auditError: { code: 'invalid_response' } });
    expect(mocks.callLLM).toHaveBeenCalledTimes(2);
  });

  it('rejects a parseable unsafe patch without retrying through another model', async () => {
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
    expect(await response.json()).toMatchObject({ auditError: { code: 'invalid_response' } });
    expect(mocks.callLLM).toHaveBeenCalledTimes(1);
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

  it('terminates a slow DeepSeek call with a distinguishable timeout', async () => {
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
