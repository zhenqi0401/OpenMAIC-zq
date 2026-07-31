import { describe, expect, it } from 'vitest';

import { buildCompleteScene } from '@/lib/generation/scene-builder';
import { generateSceneActions, generateSceneContent } from '@/lib/generation/scene-generator';
import type { AICallFn } from '@/lib/generation/pipeline-types';
import type { GeneratedQuizContent, SceneOutline } from '@/lib/types/generation';

function diagnosticOutline(): SceneOutline {
  return {
    id: 'diagnostic-1',
    type: 'quiz',
    title: '先锁定你的管理判断',
    description: '围绕同一位管理者面对的三个公平痛点作出第一步决策。',
    keyPoints: ['奖励投入不少仍觉得不公平', '新人认为没有机会', '相同标准仍被认为偏心'],
    order: 2,
    trainingCourseType: 'management',
    quizConfig: {
      mode: 'diagnostic',
      questionCount: 3,
      difficulty: 'medium',
      questionTypes: ['single'],
    },
  };
}

const modelQuestions = [1, 2, 3].map((index) => ({
  id: `q${index}`,
  type: 'single' as const,
  question: `如果你是李经理，面对痛点 ${index} 会先怎么做？`,
  options: ['先沟通了解判断依据', '先统一发布规则', '先调整资源安排'],
  answer: ['C'],
  analysis: '模型不应泄露的解释',
  points: 10,
  commentPrompt: '模型不应输出的评分要求',
}));

describe('diagnostic quiz generation contract', () => {
  it('uses the diagnostic prompt and strips all grading metadata', async () => {
    let systemPrompt = '';
    let userPrompt = '';
    const aiCall: AICallFn = async (system, user) => {
      systemPrompt = system;
      userPrompt = user;
      return JSON.stringify(modelQuestions);
    };

    const content = (await generateSceneContent(
      diagnosticOutline(),
      aiCall,
    )) as GeneratedQuizContent;

    expect(systemPrompt).toContain('non-graded management decision diagnostic');
    expect(userPrompt).toContain('exactly three non-graded management decision questions');
    expect(content.mode).toBe('diagnostic');
    expect(content.questions).toHaveLength(3);
    for (const question of content.questions) {
      expect(question.type).toBe('single');
      expect(question.options).toHaveLength(3);
      expect(question.hasAnswer).toBe(false);
      expect(question.answer).toBeUndefined();
      expect(question.analysis).toBeUndefined();
      expect(question.points).toBeUndefined();
      expect(question.commentPrompt).toBeUndefined();
    }
  });

  it('rejects a diagnostic quiz that is not exactly three 3-option single-choice questions', async () => {
    const malformed = modelQuestions.slice(0, 2);
    await expect(
      generateSceneContent(diagnosticOutline(), async () => JSON.stringify(malformed)),
    ).resolves.toBeNull();
  });

  it('keeps diagnostic narration away from scoring and theoretical answers', async () => {
    let userPrompt = '';
    const content: GeneratedQuizContent = {
      mode: 'diagnostic',
      questions: modelQuestions.map(
        ({
          answer: _answer,
          analysis: _analysis,
          points: _points,
          commentPrompt: _commentPrompt,
          ...question
        }) => ({
          ...question,
          options: question.options.map((label, index) => ({
            label,
            value: String.fromCharCode(65 + index),
          })),
          hasAnswer: false,
        }),
      ),
    };
    await generateSceneActions(diagnosticOutline(), content, async (_system, user) => {
      userPrompt = user;
      return '[]';
    });

    expect(userPrompt).toContain('non-graded diagnostic choice');
    expect(userPrompt).toContain('Do not imply or reveal a correct answer');
    expect(userPrompt).toContain('will be revisited after the theory section');
  });

  it('persists diagnostic mode into the completed scene content', () => {
    const content: GeneratedQuizContent = {
      mode: 'diagnostic',
      questions: [],
    };
    const scene = buildCompleteScene(diagnosticOutline(), content, [], 'stage-1');

    expect(scene?.content.type).toBe('quiz');
    if (scene?.content.type === 'quiz') {
      expect(scene.content.mode).toBe('diagnostic');
    }
  });
});
