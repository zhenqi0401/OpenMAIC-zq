import { afterEach, describe, expect, it } from 'vitest';

import { generateSceneContent } from '@/lib/generation/scene-generator';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { SceneOutline } from '@/lib/types/generation';

const originalMode = process.env.SLIDE_LAYOUT_GUARD_MODE;

function outline(type: SceneOutline['type'] = 'slide'): SceneOutline {
  return {
    id: 'layout-integration-scene',
    type,
    title: 'Layout integration',
    description: 'Verify post-processing order.',
    keyPoints: ['one'],
    order: 3,
  };
}

function slideResponse(left = -40): string {
  return JSON.stringify({
    elements: [
      {
        id: 'model-id-must-be-replaced',
        type: 'text',
        left,
        top: 100,
        width: 200,
        height: 80,
        content: '<p style="font-size: 18px">短文本</p>',
      },
    ],
  });
}

afterEach(() => {
  if (originalMode === undefined) delete process.env.SLIDE_LAYOUT_GUARD_MODE;
  else process.env.SLIDE_LAYOUT_GUARD_MODE = originalMode;
});

describe('slide layout guard generation integration', () => {
  it('repairs before final IDs are assigned and calls aiCall only once', async () => {
    process.env.SLIDE_LAYOUT_GUARD_MODE = 'repair';
    let calls = 0;
    const aiCall: AICallFn = async () => {
      calls += 1;
      return slideResponse();
    };

    const result = await generateSceneContent(outline(), aiCall);

    expect(calls).toBe(1);
    expect(result && 'elements' in result ? result.elements[0].left : undefined).toBe(0);
    expect(result && 'elements' in result ? result.elements[0].id : '').toMatch(/^text_[\w-]{8}$/);
    expect(result && 'elements' in result ? result.elements[0].id : '').not.toBe(
      'model-id-must-be-replaced',
    );
  });

  it.each([
    ['report', -40],
    ['off', -40],
    ['repair', 0],
  ] as const)('%s mode returns the expected geometry', async (mode, expectedLeft) => {
    process.env.SLIDE_LAYOUT_GUARD_MODE = mode;
    const result = await generateSceneContent(outline(), async () => slideResponse());

    expect(result && 'elements' in result ? result.elements[0].left : undefined).toBe(expectedLeft);
  });

  it('keeps generation successful when an oversized element cannot be repaired', async () => {
    process.env.SLIDE_LAYOUT_GUARD_MODE = 'repair';
    const response = JSON.stringify({
      elements: [
        {
          type: 'image',
          left: -10,
          top: 0,
          width: 1200,
          height: 300,
          src: 'https://example.com/image.png',
        },
      ],
    });

    const result = await generateSceneContent(outline(), async () => response);

    expect(result).not.toBeNull();
    expect(result && 'elements' in result ? result.elements[0].left : undefined).toBe(-10);
  });
});
