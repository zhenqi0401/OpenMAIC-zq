import { describe, expect, test, vi } from 'vitest';
import {
  createOutlineAttemptSignal,
  OUTLINE_ATTEMPT_TIMEOUT_MS,
} from '@/lib/generation/outline-stream-control';

const streamLLMMock = vi.hoisted(() => vi.fn());
const resolveModelFromRequestMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/ai/llm', () => ({ streamLLM: streamLLMMock }));
vi.mock('@/lib/server/resolve-model', () => ({
  resolveModelFromRequest: resolveModelFromRequestMock,
}));

interface TestSseEvent {
  type: string;
  strategy?: string;
  outlines?: Array<{ title: string }>;
}

function request(requirement: string) {
  return {
    json: async () => ({
      requirements: { requirement, trainingCourseType: 'management' },
      pdfText: '',
      pdfImages: [],
      imageMapping: {},
      researchContext: '',
    }),
    headers: { get: () => null },
  };
}

async function events(response: Response) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    text += decoder.decode(next.value, { stream: true });
  }
  return text
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => JSON.parse(line.slice(6)) as TestSseEvent);
}

function scene(order: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `scene_${order}`,
    type: 'slide',
    title: `理论页 ${order}`,
    description: '管理课程内容。',
    keyPoints: ['管理实践'],
    order,
    teachingBrief: { mustCover: ['管理实践'] },
    sourceRefIds: ['REQ-001'],
    ...overrides,
  };
}

describe('management outline targeted structure repair', () => {
  test('aborts each model attempt at the independent 300 second deadline', () => {
    vi.useFakeTimers();
    const control = createOutlineAttemptSignal(undefined);
    vi.advanceTimersByTime(OUTLINE_ATTEMPT_TIMEOUT_MS - 1);
    expect(control.didTimeout()).toBe(false);
    expect(control.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(control.didTimeout()).toBe(true);
    expect(control.signal.aborted).toBe(true);
    control.cleanup();
    vi.useRealTimers();
  });

  test('preserves the generated prefix and repairs only missing callback and closing scenes', async () => {
    vi.resetModules();
    streamLLMMock.mockReset();
    resolveModelFromRequestMock.mockResolvedValue({
      model: { provider: 'test', modelId: 'outline' },
      modelInfo: { outputWindow: 4096, capabilities: {} },
      modelString: 'test:outline',
      providerId: 'test',
      modelId: 'outline',
      thinkingConfig: undefined,
    });

    const requirement = '管理课程不少于15页，讲解管理者的招聘判断。';
    const first = [
      scene(1, {
        title: '管理招聘判断',
        sceneRole: 'cover',
        keyPoints: [],
        coverBrief: {
          subtitle: '看见冰山下的潜力',
          narrationPoints: ['背景', '问题', '课程入口'],
        },
      }),
      scene(2, { title: '案例：三个痛点' }),
      scene(3, {
        type: 'quiz',
        title: '诊断判断',
        quizConfig: {
          mode: 'diagnostic',
          questionCount: 3,
          difficulty: 'medium',
          questionTypes: ['single'],
        },
      }),
      ...Array.from({ length: 10 }, (_, index) => scene(index + 4)),
    ];
    const repair = [
      scene(14, {
        id: 'theory_continuation',
        title: '理论应用：从模型到行为证据',
        description: '补足理论到招聘行为证据的应用桥梁。',
        keyPoints: ['理论', '行为证据'],
      }),
      scene(15, {
        id: 'callback',
        title: '回到三个痛点重新判断',
        description: '用理论重新解释问题并决定下一步行动。',
        keyPoints: ['三个痛点', '理论', '行动'],
      }),
      scene(16, {
        id: 'closing',
        title: '总结：三组行动闭环',
        description: '形成开篇痛点、理论线索与管理动作闭环。',
        keyPoints: ['总结', '闭环', '行动'],
      }),
    ];
    const wrapper = (outlines: unknown[]) =>
      JSON.stringify({ languageDirective: '用中文授课。', courseTitle: '管理招聘判断', outlines });
    streamLLMMock
      .mockReturnValueOnce({
        textStream: (async function* () {
          yield wrapper(first);
        })(),
      })
      .mockReturnValueOnce({
        textStream: (async function* () {
          yield wrapper(repair);
        })(),
      });

    const { POST } = await import('@/app/api/generate/scene-outlines-stream/route');
    const response = await POST(request(requirement) as unknown as Parameters<typeof POST>[0]);
    const result = await events(response);
    const retry = result.find((event) => event.type === 'retry');
    const done = result.find((event) => event.type === 'done');

    expect(retry).toMatchObject({ strategy: 'targeted-structure-repair' });
    expect(done).toBeDefined();
    expect(done!.outlines).toHaveLength(16);
    expect(done!.outlines![0].title).toBe('管理招聘判断');
    expect(done!.outlines![13].title).toContain('理论应用');
    expect(done!.outlines![14].title).toContain('回到三个痛点');
    expect(done!.outlines![15].title).toContain('总结');
    expect(streamLLMMock).toHaveBeenCalledTimes(2);
    expect(streamLLMMock.mock.calls[1][1]).toBe('scene-outlines-structure-repair');
    expect((streamLLMMock.mock.calls[1][0] as { prompt: string }).prompt).toContain(
      '管理精品课 B+C 教学结构（强制）',
    );
    expect((streamLLMMock.mock.calls[1][0] as { prompt: string }).prompt).toContain(
      '最低下限，不是停止条件',
    );
  });
});
