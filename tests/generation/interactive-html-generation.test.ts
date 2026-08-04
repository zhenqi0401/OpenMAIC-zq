import { describe, expect, it, vi } from 'vitest';
import type { SceneOutline } from '@/lib/types/generation';
import {
  extractHtml,
  generateWidgetContent,
  InteractiveHtmlParseError,
} from '@/lib/generation/scene-generator';

const completeHtml = '<!DOCTYPE html><html><body>ok</body></html>';

const outline: SceneOutline = {
  id: 'interactive-1',
  type: 'interactive',
  title: 'Interactive HTML',
  description: 'Generate a complete page',
  keyPoints: ['complete output'],
  order: 1,
  widgetType: 'diagram',
  widgetOutline: { concept: 'completeness', diagramType: 'flowchart' },
};

describe('interactive HTML extraction', () => {
  it.each([
    ['raw HTML', completeHtml, completeHtml],
    ['fenced HTML', `\`\`\`html\n${completeHtml}\n\`\`\``, completeHtml],
    [
      'case-insensitive tags',
      '<!doctype HTML><HTML><body>ok</body></HTML>',
      '<!doctype HTML><HTML><body>ok</body></HTML>',
    ],
    ['surrounding prose', `Here is the page:\n${completeHtml}\nDone.`, completeHtml],
    ['unterminated outer fence with complete HTML', `\`\`\`html\n${completeHtml}`, completeHtml],
  ])('extracts %s only when </html> is present', (_name, response, expected) => {
    expect(extractHtml(response)).toEqual({ ok: true, html: expected });
  });

  it.each([
    ['empty_response', '   '],
    ['missing_html_start', 'This is not HTML'],
    ['missing_html_end', '<html><body>truncated'],
    ['missing_html_end', '<!DOCTYPE html><html><body>truncated'],
    ['unterminated_code_fence', '```html\n<html><body>truncated'],
  ] as const)('classifies %s without returning partial HTML', (reason, response) => {
    expect(extractHtml(response)).toEqual({ ok: false, reason });
  });
});

describe('interactive HTML targeted repair', () => {
  it('uses one model call when the first response is complete', async () => {
    const aiCall = vi.fn().mockResolvedValue(completeHtml);
    const result = await generateWidgetContent(outline, aiCall);

    expect(result?.html).toContain('</html>');
    expect(aiCall).toHaveBeenCalledTimes(1);
  });

  it('repairs one incomplete response with exactly one targeted second call', async () => {
    const aiCall = vi
      .fn()
      .mockResolvedValueOnce('<html><body>cut')
      .mockResolvedValueOnce(completeHtml);
    const result = await generateWidgetContent(outline, aiCall);

    expect(result?.html).toContain('</html>');
    expect(aiCall).toHaveBeenCalledTimes(2);
    expect(aiCall.mock.calls[1][1]).toContain(
      'Your previous response was incomplete or was not a complete HTML document.',
    );
    expect(aiCall.mock.calls[1][1]).toContain('The final non-whitespace content must be </html>.');
  });

  it('throws a classification-only error after two invalid responses', async () => {
    const aiCall = vi.fn().mockResolvedValue('<html><body>cut');

    await expect(generateWidgetContent(outline, aiCall)).rejects.toMatchObject({
      name: 'InteractiveHtmlParseError',
      reason: 'missing_html_end',
    } satisfies Partial<InteractiveHtmlParseError>);
    expect(aiCall).toHaveBeenCalledTimes(2);
  });

  it('does not start the repair call after cancellation', async () => {
    const controller = new AbortController();
    const aiCall = vi.fn().mockImplementation(async () => {
      controller.abort();
      return '<html><body>cut';
    });

    await expect(
      generateWidgetContent(outline, aiCall, undefined, { abortSignal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(aiCall).toHaveBeenCalledTimes(1);
  });
});
