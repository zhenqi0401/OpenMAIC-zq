import { describe, expect, it } from 'vitest';

import {
  validateAndRepairSlideLayout,
  type SlideLayoutIssueCode,
} from '@/lib/generation/slide-layout-guard';
import type { GeneratedSlideData } from '@/lib/generation/pipeline-types';

type Element = GeneratedSlideData['elements'][number];

function text(overrides: Partial<Element> & { content?: string } = {}): Element {
  return {
    type: 'text',
    left: 100,
    top: 100,
    width: 200,
    height: 80,
    content: '<p style="font-size: 18px">短文本</p>',
    ...overrides,
  };
}

function shape(overrides: Partial<Element> = {}): Element {
  return {
    type: 'shape',
    left: 80,
    top: 80,
    width: 240,
    height: 120,
    path: 'M 0 0 L 1 0 L 1 1 L 0 1 Z',
    viewBox: [1, 1],
    fill: '#dbeafe',
    fixedRatio: false,
    ...overrides,
  };
}

function media(
  type: 'image' | 'video' | 'chart' | 'table' | 'latex' | 'code',
  overrides: Partial<Element> = {},
): Element {
  return { type, left: 400, top: 100, width: 200, height: 120, ...overrides };
}

function issueCodes(
  result: ReturnType<typeof validateAndRepairSlideLayout>,
): SlideLayoutIssueCode[] {
  return result.issues.map((issue) => issue.code);
}

describe('slide layout guard geometry', () => {
  it.each([
    [{ left: -20 }, { left: 0, top: 100 }],
    [{ left: 950 }, { left: 800, top: 100 }],
    [{ top: -15 }, { left: 100, top: 0 }],
    [{ top: 530 }, { left: 100, top: 482.5 }],
  ])('translates an element that only crosses a hard canvas boundary', (overrides, expected) => {
    const result = validateAndRepairSlideLayout([text(overrides)]);

    expect(result.elements[0]).toMatchObject(expected);
    expect(result.elements[0].width).toBe(200);
    expect(result.elements[0].height).toBe(80);
    expect(result.issues.find((issue) => issue.code === 'out_of_canvas')?.repaired).toBe(true);
  });

  it('is idempotent after translating an element', () => {
    const once = validateAndRepairSlideLayout([text({ left: -20 })]);
    const twice = validateAndRepairSlideLayout(once.elements);

    expect(twice.elements).toEqual(once.elements);
    expect(twice.issues.some((issue) => issue.code === 'out_of_canvas')).toBe(false);
  });

  it('keeps elements larger than the canvas and reports an unresolved issue', () => {
    const element = media('image', { left: -10, width: 1200 });
    const result = validateAndRepairSlideLayout([element]);

    expect(result.elements[0]).toEqual(element);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'out_of_canvas', repaired: false }),
    );
  });

  it.each([{ left: Number.NaN }, { top: Number.POSITIVE_INFINITY }, { width: -1 }, { height: 0 }])(
    'does not guess a repair for invalid geometry',
    (overrides) => {
      const result = validateAndRepairSlideLayout([media('chart', overrides)]);

      expect(result.elements[0]).toEqual(media('chart', overrides));
      expect(result.issues).toContainEqual(
        expect.objectContaining({ code: 'invalid_geometry', repaired: false }),
      );
    },
  );

  it('translates line start and end by the same amount', () => {
    const line: Element = {
      type: 'line',
      left: -20,
      top: 100,
      width: 120,
      height: 0,
      start: [-20, 100],
      end: [100, 100],
    };
    const result = validateAndRepairSlideLayout([line]);

    expect(result.elements[0].start).toEqual([0, 100]);
    expect(result.elements[0].end).toEqual([120, 100]);
    expect(result.elements[0].left).toBe(-20);
  });

  it('reports the 50px visual margin without moving in-canvas elements', () => {
    const element = text({ left: 20, top: 60 });
    const result = validateAndRepairSlideLayout([element]);

    expect(result.elements[0]).toEqual(element);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'unsafe_margin', repaired: false }),
    );
  });
});

describe('slide layout guard text height', () => {
  it('deterministically handles Chinese, multiple paragraphs, br, font sizes, and line heights', () => {
    const element = text({
      top: 60,
      width: 220,
      height: 40,
      lineHeight: 1.2,
      paragraphSpace: 8,
      content:
        '<p style="font-size: 20px; line-height: 1.4">这是第一段中文内容用于验证稳定换行<br>第二行继续补充细节</p>' +
        '<p><span style="font-size: 24px">第二段使用更大字号继续说明</span></p>',
    });

    const first = validateAndRepairSlideLayout([element]);
    const second = validateAndRepairSlideLayout([element]);

    expect(first.elements[0].height).toBeGreaterThan(40);
    expect(first.elements[0].height).toBe(second.elements[0].height);
    expect(first.issues).toContainEqual(
      expect.objectContaining({ code: 'text_height_insufficient', repaired: true }),
    );
  });

  it('expands only an unpaired text box when there is safe space below', () => {
    const result = validateAndRepairSlideLayout([
      text({
        height: 30,
        content:
          '<p style="font-size: 20px">这是一段会换成许多行的中文长内容用于测试安全扩高逻辑</p>',
      }),
    ]);

    expect(result.elements[0].height).toBeGreaterThan(30);
    expect(result.repairedElementCount).toBe(1);
  });

  it('expands a text box and its smallest containing rectangle together', () => {
    const elements = [
      shape({ height: 100 }),
      shape({ left: 60, top: 60, width: 300, height: 150 }),
      text({
        left: 100,
        top: 100,
        width: 200,
        height: 40,
        content:
          '<p style="font-size: 20px">双栏卡片中的中文要点实际换行多于模型估算并需要完整展示</p>',
      }),
    ];
    const result = validateAndRepairSlideLayout(elements);

    expect(result.elements[2].height).toBeGreaterThan(40);
    expect(result.elements[0].height).toBe(100 + (result.elements[2].height - 40));
    expect(result.elements[1].height).toBe(150);
    expect(result.repairedElementCount).toBe(2);
  });

  it.each([
    ['fixed-ratio background', shape({ fixedRatio: true })],
    ['non-rectangular background', shape({ path: 'M 1 0.5 A 0.5 0.5 0 1 1 0 0.5 Z' })],
  ])('keeps text and background unchanged for a %s', (_name, background) => {
    const elements = [
      background,
      text({
        height: 30,
        content:
          '<p style="font-size: 20px">这是一段需要多行展示并明显超过模型文本框高度的内容</p>',
      }),
    ];
    const result = validateAndRepairSlideLayout(elements);

    expect(result.elements).toEqual(elements);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'text_height_insufficient', repaired: false }),
    );
  });

  it('keeps a paired card unchanged when expansion would collide with lower content', () => {
    const elements = [
      shape({ height: 100 }),
      text({
        height: 30,
        content:
          '<p style="font-size: 20px">这是一段需要多行展示并明显超过模型文本框高度的内容</p>',
      }),
      media('image', { left: 70, top: 205, width: 300, height: 100 }),
    ];
    const result = validateAndRepairSlideLayout(elements);

    expect(result.elements).toEqual(elements);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'text_height_insufficient', repaired: false }),
    );
  });

  it('keeps a bottom text box unchanged when the required height exceeds the canvas', () => {
    const element = text({
      top: 480,
      height: 40,
      content: '<p style="font-size: 20px">底部空间不足时绝不能截断缩小或移动其他内容</p>',
    });
    const result = validateAndRepairSlideLayout([element]);

    expect(result.elements[0]).toEqual(element);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'text_height_insufficient', repaired: false }),
    );
  });

  it('expands text embedded in a resizable rectangular shape', () => {
    const element = shape({
      height: 30,
      text: {
        content: '<p style="font-size: 20px">形状内嵌文字也需要稳定地估算多行高度</p>',
        lineHeight: 1.5,
      },
    });
    const result = validateAndRepairSlideLayout([element]);

    expect(result.elements[0].height).toBeGreaterThan(30);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'text_height_insufficient', repaired: true }),
    );
  });
});

describe('slide layout guard overlap diagnostics', () => {
  it('reports text-text, text-media, and media-media overlaps without moving coordinates', () => {
    const elements = [
      text({ left: 100, top: 100, width: 200, height: 80 }),
      text({ left: 250, top: 120, width: 200, height: 80 }),
      media('image', { left: 260, top: 130, width: 200, height: 100 }),
      media('chart', { left: 400, top: 140, width: 200, height: 100 }),
    ];
    const result = validateAndRepairSlideLayout(elements, { mode: 'report' });

    expect(result.elements).toEqual(elements);
    expect(result.issues.filter((issue) => issue.code === 'element_overlap')).toHaveLength(5);
  });

  it('reports a line-label intersection but does not move either element', () => {
    const elements: Element[] = [
      {
        type: 'line',
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        start: [200, 80],
        end: [200, 260],
      },
      text({ left: 160, top: 140, width: 100, height: 50 }),
    ];
    const result = validateAndRepairSlideLayout(elements, { mode: 'report' });

    expect(result.elements).toEqual(elements);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'line_text_overlap',
        elementRefs: ['line[0]', 'text[1]'],
        repaired: false,
      }),
    );
  });

  it('does not treat a containing background shape as an element overlap', () => {
    const result = validateAndRepairSlideLayout([shape(), text()], { mode: 'report' });

    expect(issueCodes(result)).not.toContain('element_overlap');
  });

  it('does not report edges that only touch', () => {
    const result = validateAndRepairSlideLayout(
      [text({ left: 100, width: 100 }), media('image', { left: 200, top: 100 })],
      { mode: 'report' },
    );

    expect(issueCodes(result)).not.toContain('element_overlap');
  });
});

describe('slide layout guard modes and privacy', () => {
  it('report mode diagnoses but returns the original layout', () => {
    const element = text({ left: -20 });
    const result = validateAndRepairSlideLayout([element], { mode: 'report' });

    expect(result.elements).toEqual([element]);
    expect(result.repairedElementCount).toBe(0);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'out_of_canvas', repaired: false }),
    );
  });

  it('off mode skips checks entirely', () => {
    const elements = [text({ left: -20 })];
    const result = validateAndRepairSlideLayout(elements, { mode: 'off' });

    expect(result.elements).toBe(elements);
    expect(result.issues).toEqual([]);
  });

  it('never includes source text in issues or measurements', () => {
    const secret = 'PRIVATE-SOURCE-TEXT-SENTINEL';
    const result = validateAndRepairSlideLayout([
      text({ height: 20, content: `<p style="font-size: 20px">${secret.repeat(5)}</p>` }),
    ]);

    expect(JSON.stringify(result.issues)).not.toContain(secret);
  });
});
