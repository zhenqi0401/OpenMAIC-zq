import { describe, expect, test } from 'vitest';
import { generateSceneOutlinesFromRequirements } from '@/lib/generation/outline-generator';
import { generateSceneContent } from '@/lib/generation/scene-generator';
import type { SceneOutline, UserRequirements } from '@/lib/types/generation';
import type { AICallFn } from '@/lib/generation/pipeline-types';

describe('media prompt condition wiring', () => {
  test('outline generation passes media enable flags into conditional snippets', async () => {
    let capturedPrompt = '';
    const aiCall: AICallFn = async (system, user) => {
      capturedPrompt = `${system}\n${user}`;
      return JSON.stringify({
        languageDirective: 'Teach in English.',
        courseTitle: 'Evaporation',
        outlines: [],
      });
    };

    const requirements: UserRequirements = {
      requirement: 'Teach evaporation with an animation',
    };

    const result = await generateSceneOutlinesFromRequirements(
      requirements,
      undefined,
      undefined,
      aiCall,
      undefined,
      { imageGenerationEnabled: false, videoGenerationEnabled: true },
    );

    expect(result.success).toBe(true);
    expect(capturedPrompt).toContain('gen_vid_1');
    expect(capturedPrompt).not.toContain('gen_img_');
    expect(capturedPrompt).not.toContain('suggestedImageIds');
    expect(capturedPrompt).not.toContain('{{');
  });

  test('slide content generation exposes only media element rules backed by outline media', async () => {
    let capturedPrompt = '';
    const aiCall: AICallFn = async (system, user) => {
      capturedPrompt = `${system}\n${user}`;
      return JSON.stringify({
        background: { type: 'solid', color: '#ffffff' },
        elements: [
          {
            id: 'title',
            type: 'text',
            left: 60,
            top: 80,
            width: 880,
            height: 76,
            content: '<p style="font-size: 28px;">Evaporation</p>',
            defaultFontName: '',
            defaultColor: '#333333',
          },
        ],
      });
    };

    const outline: SceneOutline = {
      id: 'scene_1',
      type: 'slide',
      title: 'Evaporation Motion',
      description: 'Explain evaporation as a moving process',
      keyPoints: ['Molecules gain energy', 'Water changes into vapor'],
      order: 1,
      mediaGenerations: [
        {
          type: 'video',
          prompt: 'Animation of water molecules evaporating',
          elementId: 'gen_vid_unique1',
          aspectRatio: '16:9',
        },
      ],
    };

    const result = await generateSceneContent(outline, aiCall);

    expect(result).not.toBeNull();
    expect(capturedPrompt).toContain('VideoElement');
    expect(capturedPrompt).toContain('mediaRef');
    expect(capturedPrompt).toContain('gen_vid_unique1');
    expect(capturedPrompt).not.toContain('"src": "gen_vid_1"');
    expect(capturedPrompt).not.toContain('ImageElement');
    expect(capturedPrompt).not.toContain('gen_img_');
    expect(capturedPrompt).not.toContain('{{');
  });
});

describe('outline courseTitle parsing', () => {
  const baseRequirements: UserRequirements = { requirement: 'Teach photosynthesis' };

  async function runWith(raw: unknown) {
    const aiCall: AICallFn = async (_system, _user) => JSON.stringify(raw);
    return generateSceneOutlinesFromRequirements(baseRequirements, undefined, undefined, aiCall);
  }

  test('adopts a string courseTitle from the wrapper object', async () => {
    const result = await runWith({
      languageDirective: 'Teach in English.',
      courseTitle: 'Photosynthesis Basics',
      outlines: [],
    });

    expect(result.success).toBe(true);
    expect(result.data?.courseTitle).toBe('Photosynthesis Basics');
  });

  test('trims whitespace and caps overlong courseTitle defensively', async () => {
    const long = 'A '.repeat(80); // 160 chars
    const result = await runWith({
      languageDirective: 'Teach in English.',
      courseTitle: `  ${long}  `,
      outlines: [],
    });

    expect(result.success).toBe(true);
    expect(result.data?.courseTitle?.length).toBeLessThanOrEqual(120);
    // trimmed
    expect(result.data?.courseTitle?.startsWith(' ')).toBe(false);
  });

  test('returns undefined courseTitle when the field is missing (graceful fallback)', async () => {
    const result = await runWith({
      languageDirective: 'Teach in English.',
      outlines: [],
    });

    expect(result.success).toBe(true);
    expect(result.data?.courseTitle).toBeUndefined();
  });

  test('ignores a non-string / empty courseTitle', async () => {
    const result = await runWith({
      languageDirective: 'Teach in English.',
      courseTitle: '   ',
      outlines: [],
    });

    expect(result.success).toBe(true);
    expect(result.data?.courseTitle).toBeUndefined();
  });
});

describe('non-stream knowledge-cover enforcement', () => {
  test('rejects a marked cover with no required subtitle', async () => {
    const aiCall: AICallFn = async () =>
      JSON.stringify({
        languageDirective: 'Teach in English.',
        courseTitle: 'Photosynthesis',
        outlines: [
          {
            id: 'cover',
            type: 'slide',
            title: 'Photosynthesis',
            description: 'A knowledge cover.',
            keyPoints: [],
            order: 1,
            sceneRole: 'cover',
            coverBrief: {
              narrationPoints: ['Background', 'Problem addressed', 'Course route'],
            },
          },
        ],
      });

    const result = await generateSceneOutlinesFromRequirements(
      { requirement: 'Teach photosynthesis' },
      undefined,
      undefined,
      aiCall,
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('subtitle');
  });

  test('does not let an enhanced strategy replace the cover with a direct PBL opening', async () => {
    let capturedSystem = '';
    const aiCall: AICallFn = async (system) => {
      capturedSystem = system;
      return JSON.stringify({
        languageDirective: 'Teach in English.',
        courseTitle: 'Sales Practice',
        outlines: [
          {
            id: 'project',
            type: 'pbl',
            title: 'Customer role-play',
            description: 'Start directly in a customer situation.',
            keyPoints: ['Discover needs'],
            order: 1,
            pblConfig: {
              projectTopic: 'Customer discovery',
              projectDescription: 'Complete a sales role-play.',
              targetSkills: ['Questioning'],
            },
          },
        ],
      });
    };

    const result = await generateSceneOutlinesFromRequirements(
      { requirement: 'Skip the cover and start with role-play', trainingCourseType: 'sales' },
      undefined,
      undefined,
      aiCall,
    );

    expect(capturedSystem).toContain('Enhanced-training cover override');
    expect(result.success).toBe(false);
    expect(result.error).toContain('first cover slide');
  });
});
