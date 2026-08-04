import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { SceneOutline } from '@/lib/types/generation';

const mocks = vi.hoisted(() => ({
  getCurrentModelConfig: vi.fn(),
  settingsState: vi.fn(),
  audioPut: vi.fn(),
  isTTSProviderEnabled: vi.fn(),
  pickNarratorAgent: vi.fn(),
  resolveAgentVoiceOptions: vi.fn(),
  listAgents: vi.fn(),
}));

vi.mock('@/lib/utils/model-config', () => ({
  getCurrentModelConfig: mocks.getCurrentModelConfig,
}));

vi.mock('@/lib/store/settings', () => ({
  useSettingsStore: {
    getState: mocks.settingsState,
  },
}));

vi.mock('@/lib/utils/database', () => ({
  db: {
    audioFiles: {
      put: mocks.audioPut,
    },
  },
}));

vi.mock('@/lib/audio/provider-enablement', () => ({
  isTTSProviderEnabled: mocks.isTTSProviderEnabled,
}));

vi.mock('@/lib/audio/agent-voice', () => ({
  pickNarratorAgent: mocks.pickNarratorAgent,
  resolveAgentVoiceOptions: mocks.resolveAgentVoiceOptions,
}));

vi.mock('@/lib/orchestration/registry/store', () => ({
  useAgentRegistry: {
    getState: () => ({
      listAgents: mocks.listAgents,
    }),
  },
}));

const mockFetch = vi.fn() as Mock;
vi.stubGlobal('fetch', mockFetch);

const outline = {
  id: 'outline-1',
  type: 'slide',
  title: 'Retry Scene',
  description: 'Retry transient failures',
  keyPoints: ['retry'],
  order: 2,
} as SceneOutline;

const retryOptions = {
  maxRetries: 1,
  sleep: async () => undefined,
  random: () => 0,
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 429 ? 'Too Many Requests' : status === 401 ? 'Unauthorized' : 'OK',
    json: async () => body,
  };
}

describe('browser scene generation retry wrappers', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mocks.audioPut.mockReset();
    mocks.getCurrentModelConfig.mockReturnValue({});
    mocks.settingsState.mockReturnValue({
      imageProviderId: '',
      imageProvidersConfig: {},
      imageGenerationEnabled: false,
      videoProviderId: '',
      videoProvidersConfig: {},
      videoGenerationEnabled: false,
      ttsProviderId: 'server-tts',
      ttsProvidersConfig: {
        'server-tts': {
          apiKey: 'tts-key',
          modelId: 'tts-model',
        },
      },
      ttsVoice: 'narrator',
      ttsSpeed: 1,
    });
    mocks.isTTSProviderEnabled.mockReturnValue(true);
    mocks.pickNarratorAgent.mockReturnValue(undefined);
    mocks.resolveAgentVoiceOptions.mockResolvedValue({});
    mocks.listAgents.mockReturnValue([]);
  });

  it('retries transient scene content HTTP failures before returning success', async () => {
    const { fetchSceneContent } = await import('@/lib/hooks/use-scene-generator');
    mockFetch
      .mockResolvedValueOnce(jsonResponse(429, { error: 'rate limited' }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, content: { elements: [] } }));

    const result = await fetchSceneContent(
      {
        outline,
        allOutlines: [outline],
        stageId: 'stage-1',
        stageInfo: { name: 'Retry Course' },
      },
      undefined,
      retryOptions,
    );

    expect(result).toMatchObject({ success: true, content: { elements: [] } });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('limits interactive transport failures to one retry even when the caller requests more', async () => {
    const { fetchSceneContent } = await import('@/lib/hooks/use-scene-generator');
    const interactiveOutline = { ...outline, type: 'interactive' as const };
    mockFetch.mockResolvedValue(jsonResponse(429, { error: 'rate limited' }));

    const result = await fetchSceneContent(
      {
        outline: interactiveOutline,
        allOutlines: [interactiveOutline],
        stageId: 'stage-1',
        stageInfo: { name: 'Retry Course' },
      },
      undefined,
      { ...retryOptions, maxRetries: 5 },
    );

    expect(result.success).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('preserves PARSE_FAILED and does not retry an interactive 422 response', async () => {
    const { fetchSceneContent } = await import('@/lib/hooks/use-scene-generator');
    const interactiveOutline = { ...outline, type: 'interactive' as const };
    mockFetch.mockResolvedValue(
      jsonResponse(422, {
        success: false,
        errorCode: 'PARSE_FAILED',
        error: 'Interactive HTML response was incomplete',
      }),
    );

    const result = await fetchSceneContent(
      {
        outline: interactiveOutline,
        allOutlines: [interactiveOutline],
        stageId: 'stage-1',
        stageInfo: { name: 'Retry Course' },
      },
      undefined,
      retryOptions,
    );

    expect(result).toMatchObject({ success: false, errorCode: 'PARSE_FAILED' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not apply the generic 409 retry rule to interactive content', async () => {
    const { fetchSceneContent } = await import('@/lib/hooks/use-scene-generator');
    const interactiveOutline = { ...outline, type: 'interactive' as const };
    mockFetch.mockResolvedValue(jsonResponse(409, { error: 'conflict' }));

    const result = await fetchSceneContent(
      {
        outline: interactiveOutline,
        allOutlines: [interactiveOutline],
        stageId: 'stage-1',
        stageInfo: { name: 'Retry Course' },
      },
      undefined,
      retryOptions,
    );

    expect(result.success).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry permanent scene action HTTP failures', async () => {
    const { fetchSceneActions } = await import('@/lib/hooks/use-scene-generator');
    mockFetch.mockResolvedValue(jsonResponse(401, { error: 'unauthorized' }));

    const result = await fetchSceneActions(
      {
        outline,
        allOutlines: [outline],
        content: { elements: [] },
        stageId: 'stage-1',
      },
      undefined,
      retryOptions,
    );

    expect(result).toMatchObject({ success: false, error: 'unauthorized' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rethrows an aborted scene content request', async () => {
    const { fetchSceneContent } = await import('@/lib/hooks/use-scene-generator');
    const abort = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    mockFetch.mockRejectedValueOnce(abort);

    await expect(
      fetchSceneContent(
        {
          outline,
          allOutlines: [outline],
          stageId: 'stage-1',
          stageInfo: { name: 'Retry Course' },
        },
        undefined,
        retryOptions,
      ),
    ).rejects.toBe(abort);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rethrows an aborted scene actions request', async () => {
    const { fetchSceneActions } = await import('@/lib/hooks/use-scene-generator');
    const abort = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    mockFetch.mockRejectedValueOnce(abort);

    await expect(
      fetchSceneActions(
        {
          outline,
          allOutlines: [outline],
          content: { elements: [] },
          stageId: 'stage-1',
        },
        undefined,
        retryOptions,
      ),
    ).rejects.toBe(abort);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries transient TTS failures before storing audio', async () => {
    const { generateAndStoreTTS } = await import('@/lib/hooks/use-scene-generator');
    mockFetch
      .mockResolvedValueOnce(jsonResponse(503, { error: 'provider overloaded' }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          base64: btoa('audio-data'),
          format: 'wav',
        }),
      );

    await generateAndStoreTTS('tts_s2_action_1', 'Hello class', 'English', undefined, retryOptions);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mocks.audioPut).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tts_s2_action_1',
        format: 'wav',
      }),
    );
  });

  it('uploads generated TTS audio to PostgreSQL when a course target is provided', async () => {
    const { generateAndStoreTTS } = await import('@/lib/hooks/use-scene-generator');
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          base64: btoa('audio-data'),
          format: 'mp3',
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, audio: { audioId: 'tts-1' } }));

    await generateAndStoreTTS('tts-1', 'Hello class', 'English', undefined, retryOptions, {
      courseId: 'course-1',
      sceneKey: 'scene-1',
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/storage/audio',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: 'course-1',
          sceneKey: 'scene-1',
          audioId: 'tts-1',
          base64: btoa('audio-data'),
          format: 'mp3',
          mimeType: 'audio/mp3',
        }),
      }),
    );
  });

  it('builds stable scene-scoped TTS ids for first and later generated scenes', async () => {
    const { buildSceneTtsAudioId } = await import('@/lib/hooks/use-scene-generator');

    expect(buildSceneTtsAudioId(0, 'action_1')).toBe('tts_s0_action_1');
    expect(buildSceneTtsAudioId(3, 'action_1')).toBe('tts_s3_action_1');
  });

  it('generates one scene TTS with a fixed concurrency of two while preserving action order', async () => {
    const { generateTTSForSpeechActions, TTS_GENERATION_CONCURRENCY } =
      await import('@/lib/hooks/use-scene-generator');
    const pending: Array<() => void> = [];
    let active = 0;
    let maxActive = 0;
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          pending.push(() => {
            active -= 1;
            resolve(
              jsonResponse(200, {
                success: true,
                base64: btoa('audio-data'),
                format: 'mp3',
              }),
            );
          });
        }),
    );
    const actions: Array<{
      id: string;
      type: 'speech';
      text: string;
      audioId?: string;
    }> = ['a1', 'a2', 'a3'].map((id) => ({
      id,
      type: 'speech',
      text: id,
    }));

    const resultPromise = generateTTSForSpeechActions(actions, {
      sceneOrder: 4,
      sceneKey: 'scene-4',
      language: 'Chinese',
    });
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(TTS_GENERATION_CONCURRENCY).toBe(2);
    expect(maxActive).toBe(2);

    pending.shift()?.();
    await vi.waitFor(() => expect(pending).toHaveLength(2));
    expect(maxActive).toBe(2);
    pending.splice(0).forEach((resolve) => resolve());

    await expect(resultPromise).resolves.toEqual({
      success: true,
      failedCount: 0,
      error: undefined,
    });
    expect(actions.map((action) => action.audioId)).toEqual([
      'tts_s4_a1',
      'tts_s4_a2',
      'tts_s4_a3',
    ]);
    expect(mocks.audioPut.mock.calls.map(([audio]) => audio.id).sort()).toEqual([
      'tts_s4_a1',
      'tts_s4_a2',
      'tts_s4_a3',
    ]);
  });
});
