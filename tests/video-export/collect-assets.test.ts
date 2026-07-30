import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VideoTimeline } from '@/lib/video-export';
import type { Scene } from '@/lib/types/stage';
import { collectVideoAssets } from '@/lib/video-export-app/collect';
import type { VideoTimelineRecords } from '@/lib/video-export-app/timeline-deps';

const slideToPng = vi.hoisted(() => vi.fn());

vi.mock('@openmaic/renderer/snapshot', () => ({ slideToPng }));

function fixture() {
  const scene = {
    id: 'scene-1',
    stageId: 'stage-1',
    type: 'slide',
    title: 'Slide',
    order: 0,
    actions: [],
    content: {
      type: 'slide',
      canvas: {
        id: 'canvas-1',
        viewportSize: 1000,
        viewportRatio: 0.5625,
        theme: {
          backgroundColor: '#fff',
          themeColors: [],
          fontColor: '#000',
          fontName: 'sans-serif',
        },
        elements: [
          {
            id: 'image-1',
            type: 'image',
            src: 'media://image-1',
            left: 0,
            top: 0,
            width: 100,
            height: 100,
          },
        ],
      },
    },
  } as unknown as Scene;
  const ir = {
    assets: {
      entries: [
        {
          assetId: 'frame:scene-1',
          kind: 'frame',
          path: 'frames/001-slide.png',
          present: true,
        },
      ],
    },
  } as VideoTimeline;
  const records: VideoTimelineRecords = {
    audioById: new Map(),
    mediaByElementId: new Map([
      [
        'image-1',
        {
          id: 'image-asset',
          type: 'image',
          blob: new Blob(['image'], { type: 'image/png' }),
          mimeType: 'image/png',
        },
      ],
    ]),
    videoDurationMsByElementId: new Map(),
  };
  return { scene, ir, records };
}

afterEach(() => {
  vi.restoreAllMocks();
  slideToPng.mockReset();
});

describe('collectVideoAssets object URL lifecycle', () => {
  it('replaces media for the slide-only snapshot and revokes its URL after success', async () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:resolved-image');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    slideToPng.mockResolvedValue(new Blob(['png'], { type: 'image/png' }));
    const { scene, ir, records } = fixture();

    const result = await collectVideoAssets(ir, [scene], records);

    expect(result.missing).toEqual([]);
    expect(result.blobs.get('frames/001-slide.png')?.type).toBe('image/png');
    expect(createUrl).toHaveBeenCalledTimes(1);
    expect(slideToPng).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [expect.objectContaining({ id: 'image-1', src: 'blob:resolved-image' })],
      }),
      expect.objectContaining({ width: 1920, format: 'blob' }),
    );
    expect(revokeUrl).toHaveBeenCalledWith('blob:resolved-image');
  });

  it('revokes temporary URLs when snapshot rendering fails', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed-image');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    slideToPng.mockRejectedValue(new Error('snapshot failed'));
    const { scene, ir, records } = fixture();

    const result = await collectVideoAssets(ir, [scene], records);

    expect(result.blobs.size).toBe(0);
    expect(result.missing).toEqual(['frames/001-slide.png']);
    expect(revokeUrl).toHaveBeenCalledWith('blob:failed-image');
  });
});
