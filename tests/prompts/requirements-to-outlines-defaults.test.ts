import { describe, expect, test } from 'vitest';
import { buildPrompt, PROMPT_IDS } from '@/lib/prompts';

function buildOutlinePrompt() {
  const prompt = buildPrompt(PROMPT_IDS.REQUIREMENTS_TO_OUTLINES, {
    requirement: 'Teach a topic without specifying a duration',
    pdfContent: 'None',
    availableImages: 'No images available',
    userProfile: '',
    researchContext: 'None',
    teacherContext: '',
    hasSourceImages: false,
    imageEnabled: false,
    videoEnabled: false,
    mediaEnabled: false,
  });
  expect(prompt).not.toBeNull();
  return prompt!;
}

describe('requirements-to-outlines defaults', () => {
  test('uses one 15-30 minute default in both system and user prompts', () => {
    const prompt = buildOutlinePrompt();

    expect(prompt.system).toContain('| Course Duration     | 15-30 minutes');
    expect(prompt.user).toContain('default 15-30 minutes if not specified');
    expect(`${prompt.system}\n${prompt.user}`).not.toContain('15-20 minutes');
  });
});
