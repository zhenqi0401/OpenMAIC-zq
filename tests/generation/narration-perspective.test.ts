import { describe, expect, test } from 'vitest';
import { buildCourseContext } from '@/lib/generation/prompt-formatters';
import { loadPrompt, loadSnippet } from '@/lib/prompts';

describe('generated narration perspective', () => {
  test('opens the first page directly without greeting or speaker introduction', () => {
    const context = buildCourseContext({
      allTitles: ['三个业务痛点', '解决思路'],
      pageIndex: 1,
      totalPages: 2,
      previousSpeeches: [],
    });

    expect(context).toContain('Enter the topic directly');
    expect(context).toContain('Never introduce the speaker by name, title, role, or identity');
    expect(context).not.toContain('Open with a greeting and course introduction');
  });

  test('uses a shared first-person plural perspective for pain points', () => {
    const context = buildCourseContext({
      allTitles: ['共同挑战'],
      pageIndex: 1,
      totalPages: 1,
      previousSpeeches: [],
    });

    expect(context).toContain('Prefer first-person plural language');
    expect(context).toContain('"we", "our", and "us"');
    expect(context).toContain('Avoid addressing the audience as "you"');
  });

  test.each(['slide-actions', 'quiz-actions', 'interactive-actions', 'pbl-actions'] as const)(
    '%s applies the same identity and perspective rules',
    (promptId) => {
      const prompt = loadPrompt(promptId);
      expect(prompt).not.toBeNull();
      expect(prompt!.systemPrompt).toContain(
        'Never introduce the speaker by name, title, role, or identity',
      );
      expect(prompt!.systemPrompt).toContain('first-person plural language');
      expect(prompt!.systemPrompt).not.toContain('Open with a greeting');
      expect(prompt!.systemPrompt).not.toContain('open with a greeting');
    },
  );

  test('keeps the shared speech snippet aligned for future prompt reuse', () => {
    const guidelines = loadSnippet('speech-guidelines');
    expect(guidelines).toContain('Never introduce the speaker by name, title, role, or identity');
    expect(guidelines).toContain('prefer first-person plural language');
  });

  test('normal and interactive outline prompts require the minimal marked cover and reliable attribution', () => {
    for (const promptId of ['requirements-to-outlines', 'interactive-outlines'] as const) {
      const prompt = loadPrompt(promptId);
      expect(prompt?.systemPrompt).toContain('sceneRole: "cover"');
      expect(prompt?.systemPrompt).toContain('coverBrief.narrationPoints');
      expect(prompt?.systemPrompt).toContain('reliably established');
      expect(prompt?.systemPrompt.toLowerCase()).toContain('never invent');
      expect(prompt?.systemPrompt).toContain('PBL');
      expect(prompt?.systemPrompt).toContain('role-play');
    }
  });

  test('task-engine keeps the task briefing opening without a theory attribution contract', () => {
    const prompt = loadPrompt('task-engine-outlines');
    expect(prompt?.systemPrompt).toContain('task briefing / course overview');
    expect(prompt?.systemPrompt).not.toContain('coverBrief.attribution');
    expect(prompt?.systemPrompt).not.toContain('reliably established originator');
  });
});
