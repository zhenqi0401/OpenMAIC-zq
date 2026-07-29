import { describe, expect, it } from 'vitest';

import { parseJsonResponse, stripLeadingReasoningBlocks } from '@/lib/generation/json-repair';

describe('json-repair targeted fixes', () => {
  it('strips complete leading thinking blocks before selecting the JSON payload', () => {
    const raw = `<think>I might return {"wrong": true} first.</think>
{"right": true}`;

    expect(parseJsonResponse<{ right: boolean }>(raw)).toEqual({ right: true });
  });

  it('strips repeated reasoning tag variants before a fenced JSON payload', () => {
    const raw = `<analysis>Plan [one] first.</analysis>
<reasoning>Then verify {two}.</reasoning>
\`\`\`json
{"ok": true}
\`\`\``;

    expect(parseJsonResponse<{ ok: boolean }>(raw)).toEqual({ ok: true });
  });

  it('preserves reasoning tags inside JSON strings and incomplete leading blocks', () => {
    expect(parseJsonResponse<{ text: string }>(`{"text":"<think>keep me</think>"}`)).toEqual({
      text: '<think>keep me</think>',
    });
    expect(stripLeadingReasoningBlocks('<think>unfinished {"value": true}')).toBe(
      '<think>unfinished {"value": true}',
    );
  });

  it('repairs quoted key-value fragments such as "height: 76"', () => {
    const raw = `{
  "background": {
    "type": "solid",
    "color": "#ffffff"
  },
  "elements": [
    {
      "id": "code_text",
      "type": "text",
      "left": 80,
      "top": 420,
      "width": 840,
      "height: 76",
      "content": "<p style=\\"font-size: 22px;\\">age = 25</p>",
      "defaultFontName": "",
      "defaultColor": "#333333"
    }
  ]
}`;

    const parsed = parseJsonResponse<{
      elements: Array<{ height: number; content: string }>;
    }>(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.elements[0]?.height).toBe(76);
    expect(parsed?.elements[0]?.content).toContain('age = 25');
  });

  it('repairs boolean property fragments without touching valid string values', () => {
    const raw = `{
  "elements": [
    {
      "id": "shape_1",
      "fixedRatio: false",
      "height: 58",
      "content": "<p>literal text: height: 58</p>"
    }
  ]
}`;

    const parsed = parseJsonResponse<{
      elements: Array<{ fixedRatio: boolean; height: number; content: string }>;
    }>(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.elements[0]?.fixedRatio).toBe(false);
    expect(parsed?.elements[0]?.height).toBe(58);
    expect(parsed?.elements[0]?.content).toBe('<p>literal text: height: 58</p>');
  });
});
