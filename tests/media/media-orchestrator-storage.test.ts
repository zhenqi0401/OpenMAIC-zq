import { beforeEach, describe, expect, test, vi, type Mock } from 'vitest';

const mocks = vi.hoisted(() => ({
  settingsState: vi.fn(),
  mediaPut: vi.fn(),
  enqueueTasks: vi.fn(),
  getTask: vi.fn(),
  markGenerating: vi.fn(),
  markDone: vi.fn(),
  markFailed: vi.fn(),
}));

vi.mock('@/lib/store/settings', () => ({
  useSettingsStore: {
    getState: mocks.settingsState,
  },
}));

vi.mock('@/lib/utils/database', () => ({
  db: {
    mediaFiles: {
      put: mocks.mediaPut,
      delete: vi.fn(),
    },
  },
  mediaFileKey: (stageId: string, elementId: string) => `${stageId}:${elementId}`,
}));

vi.mock('@/lib/store/media-generation', () => ({
  useMediaGenerationStore: {
    getState: () => ({
      enqueueTasks: mocks.enqueueTasks,
      getTask: mocks.getTask,
      markGenerating: mocks.markGenerating,
      markDone: mocks.markDone,
      markFailed: mocks.markFailed,
    }),
  },
}));

const mockFetch = vi.fn() as Mock;
vi.stubGlobal('fetch', mockFetch);
vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:generated-media');
vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('media orchestrator PostgreSQL storage', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    mocks.mediaPut.mockReset();
    mocks.enqueueTasks.mockReset();
    mocks.getTask.mockReset();
    mocks.markGenerating.mockReset();
    mocks.markDone.mockReset();
    mocks.markFailed.mockReset();
    mocks.settingsState.mockReturnValue({
      imageGenerationEnabled: true,
      videoGenerationEnabled: false,
      imageProviderId: 'image-provider',
      imageModelId: 'image-model',
      imageProvidersConfig: {
        'image-provider': {
          apiKey: 'image-key',
          baseUrl: 'https://image.example',
        },
      },
    });
  });

  test('uploads generated media blobs to PostgreSQL when a course target is provided', async () => {
    const { generateMediaForOutlines } = await import('@/lib/media/media-orchestrator');
    const imageBlob = new Blob(['image-data'], { type: 'image/png' });
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          result: { base64: Buffer.from('image-data').toString('base64') },
        }),
      )
      .mockResolvedValueOnce({ ok: true, blob: async () => imageBlob })
      .mockResolvedValueOnce(jsonResponse({ success: true, mediaFile: { mediaId: 'gen_img_1' } }));

    await generateMediaForOutlines(
      [
        {
          id: 'outline-1',
          type: 'slide',
          title: 'Intro',
          description: 'Intro',
          keyPoints: ['one'],
          order: 1,
          mediaGenerations: [
            { type: 'image', prompt: 'A concept image', elementId: 'gen_img_1' },
          ],
        },
      ],
      'stage-1',
      undefined,
      { courseId: 'course-1' },
    );

    expect(mockFetch).toHaveBeenLastCalledWith(
      '/api/storage/media',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: 'course-1',
          sceneKey: null,
          mediaId: 'gen_img_1',
          mediaType: 'image',
          mimeType: 'image/png',
          sizeBytes: imageBlob.size,
          prompt: 'A concept image',
          params: { aspectRatio: undefined, style: undefined },
          base64: Buffer.from('image-data').toString('base64'),
          posterBase64: null,
        }),
      }),
    );
  });
});
