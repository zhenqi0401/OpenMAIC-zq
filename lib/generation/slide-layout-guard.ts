import type { GeneratedSlideData } from './pipeline-types';

export type SlideLayoutIssueCode =
  | 'invalid_geometry'
  | 'out_of_canvas'
  | 'unsafe_margin'
  | 'text_height_insufficient'
  | 'element_overlap'
  | 'line_text_overlap';

export interface SlideLayoutIssue {
  code: SlideLayoutIssueCode;
  severity: 'warning' | 'error';
  elementRefs: string[];
  repaired: boolean;
  measurements?: Record<string, number>;
}

export interface SlideLayoutResult {
  elements: GeneratedSlideData['elements'];
  issues: SlideLayoutIssue[];
  repairedElementCount: number;
  unresolvedIssueCount: number;
}

export interface SlideLayoutGuardOptions {
  mode?: 'off' | 'report' | 'repair';
  canvasWidth?: number;
  canvasHeight?: number;
}

type Element = GeneratedSlideData['elements'][number];
type Rect = { left: number; top: number; width: number; height: number };

const DEFAULT_CANVAS_WIDTH = 1000;
const DEFAULT_CANVAS_HEIGHT = 562.5;
const SAFE_MARGIN = 50;
const ELEMENT_GAP = 12;
const DEFAULT_FONT_SIZE = 18;
const DEFAULT_LINE_HEIGHT = 1.5;
const DEFAULT_PARAGRAPH_SPACE = 5;
const TEXT_HORIZONTAL_PADDING = 20;
const TEXT_VERTICAL_PADDING = 20;

const CONTENT_TYPES = new Set(['text', 'image', 'video', 'chart', 'table', 'latex', 'code']);
const MEDIA_TYPES = new Set(['image', 'video', 'chart', 'table', 'latex', 'code']);

function cloneElements(elements: GeneratedSlideData['elements']): GeneratedSlideData['elements'] {
  return elements.map((element) => ({
    ...element,
    ...(Array.isArray(element.start) ? { start: [...element.start] } : {}),
    ...(Array.isArray(element.end) ? { end: [...element.end] } : {}),
    ...(element.text && typeof element.text === 'object'
      ? { text: { ...(element.text as Record<string, unknown>) } }
      : {}),
  }));
}

function ref(elements: GeneratedSlideData['elements'], index: number): string {
  return `${elements[index]?.type ?? 'element'}[${index}]`;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function rectFor(element: Element): Rect | null {
  if (
    !isFiniteNumber(element.left) ||
    !isFiniteNumber(element.top) ||
    !isFiniteNumber(element.width) ||
    !isFiniteNumber(element.height) ||
    element.width <= 0 ||
    element.height <= 0
  ) {
    return null;
  }
  return element;
}

function lineRect(element: Element): Rect | null {
  const start = element.start;
  const end = element.end;
  if (
    !Array.isArray(start) ||
    !Array.isArray(end) ||
    start.length !== 2 ||
    end.length !== 2 ||
    !start.every(isFiniteNumber) ||
    !end.every(isFiniteNumber)
  ) {
    return null;
  }
  const left = Math.min(start[0], end[0]);
  const top = Math.min(start[1], end[1]);
  return {
    left,
    top,
    width: Math.max(start[0], end[0]) - left,
    height: Math.max(start[1], end[1]) - top,
  };
}

function geometryFor(element: Element): Rect | null {
  return element.type === 'line' ? lineRect(element) : rectFor(element);
}

function isOutside(rect: Rect, canvasWidth: number, canvasHeight: number): boolean {
  return (
    rect.left < 0 ||
    rect.top < 0 ||
    rect.left + rect.width > canvasWidth ||
    rect.top + rect.height > canvasHeight
  );
}

function translateIntoCanvas(rect: Rect, canvasWidth: number, canvasHeight: number) {
  if (rect.width > canvasWidth || rect.height > canvasHeight) return null;
  const dx = Math.min(Math.max(rect.left, 0), canvasWidth - rect.width) - rect.left;
  const dy = Math.min(Math.max(rect.top, 0), canvasHeight - rect.height) - rect.top;
  return { dx, dy };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width &&
    a.left + a.width > b.left &&
    a.top < b.top + b.height &&
    a.top + a.height > b.top
  );
}

function conflictsWithGap(a: Rect, b: Rect): boolean {
  return !(
    a.left + a.width + ELEMENT_GAP <= b.left ||
    b.left + b.width + ELEMENT_GAP <= a.left ||
    a.top + a.height + ELEMENT_GAP <= b.top ||
    b.top + b.height + ELEMENT_GAP <= a.top
  );
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    outer.left <= inner.left &&
    outer.top <= inner.top &&
    outer.left + outer.width >= inner.left + inner.width &&
    outer.top + outer.height >= inner.top + inner.height
  );
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1]?.toLowerCase() === 'x';
      const codePoint = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isFinite(codePoint)) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return entity;
        }
      }
    }
    return named[body.toLowerCase()] ?? entity;
  });
}

function styleNumbers(html: string, property: 'font-size' | 'line-height'): number[] {
  const pattern = new RegExp(`${property}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)(px|%|em)?`, 'gi');
  const values: number[] = [];
  for (const match of html.matchAll(pattern)) {
    const number = Number(match[1]);
    if (Number.isFinite(number) && number > 0) {
      if (property === 'font-size' && (!match[2] || match[2].toLowerCase() === 'px')) {
        values.push(number);
      } else if (property === 'line-height') {
        const unit = match[2]?.toLowerCase();
        values.push(unit === '%' ? number / 100 : unit === 'px' ? -number : number);
      }
    }
  }
  return values;
}

interface TextMetricsSource {
  content: string;
  width: number;
  lineHeight?: unknown;
  paragraphSpace?: unknown;
}

function estimateRequiredTextHeight(source: TextMetricsSource): number {
  const paragraphMatches = [...source.content.matchAll(/<p\b[^>]*>[\s\S]*?<\/p\s*>/gi)];
  const rawParagraphs =
    paragraphMatches.length > 0 ? paragraphMatches.map((match) => match[0]) : [source.content];
  const elementLineHeight =
    isFiniteNumber(source.lineHeight) && source.lineHeight > 0
      ? source.lineHeight
      : DEFAULT_LINE_HEIGHT;
  const paragraphSpace =
    isFiniteNumber(source.paragraphSpace) && source.paragraphSpace >= 0
      ? source.paragraphSpace
      : DEFAULT_PARAGRAPH_SPACE;
  const usableWidth = Math.max(1, source.width - TEXT_HORIZONTAL_PADDING);

  let contentHeight = 0;
  for (const paragraph of rawParagraphs) {
    const fontSizes = styleNumbers(paragraph, 'font-size');
    const fontSize = fontSizes.length > 0 ? Math.max(...fontSizes) : DEFAULT_FONT_SIZE;
    const inlineLineHeights = styleNumbers(paragraph, 'line-height');
    const inlineLineHeight =
      inlineLineHeights.length > 0 ? Math.max(...inlineLineHeights) : undefined;
    const lineHeight =
      inlineLineHeight === undefined
        ? elementLineHeight
        : inlineLineHeight < 0
          ? -inlineLineHeight / fontSize
          : inlineLineHeight;
    const safeCharactersPerLine = Math.max(1, Math.floor((usableWidth / fontSize) * 0.75));
    const forcedLines = paragraph.split(/<br\s*\/?\s*>/gi);
    let lineCount = 0;
    for (const line of forcedLines) {
      const plainText = decodeHtmlEntities(line.replace(/<[^>]*>/g, ''));
      lineCount += Math.max(1, Math.ceil(Array.from(plainText).length / safeCharactersPerLine));
    }
    contentHeight += lineCount * fontSize * lineHeight;
  }

  return (
    Math.ceil(
      TEXT_VERTICAL_PADDING +
        contentHeight +
        Math.max(0, rawParagraphs.length - 1) * paragraphSpace,
    ) + 2
  );
}

function isAxisAlignedRectangle(element: Element): boolean {
  if (
    element.type !== 'shape' ||
    element.fixedRatio === true ||
    element.special === true ||
    element.pattern
  ) {
    return false;
  }
  if (typeof element.path !== 'string') return false;
  const commands = element.path.match(/[a-z]/gi)?.map((command) => command.toUpperCase());
  if (!commands || commands.join('') !== 'MLLLZ') return false;
  const numbers = element.path.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!numbers || numbers.length !== 8 || numbers.some((number) => !Number.isFinite(number))) {
    return false;
  }
  const [x0, y0, x1, y1, x2, y2, x3, y3] = numbers;
  return x0 === x3 && x1 === x2 && y0 === y1 && y2 === y3 && x0 !== x1 && y0 !== y2;
}

function findBackgroundShape(
  elements: GeneratedSlideData['elements'],
  textIndex: number,
  textRect: Rect,
): number | null {
  let bestIndex: number | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (let index = 0; index < textIndex; index += 1) {
    const candidate = elements[index];
    const rect = rectFor(candidate);
    if (!rect || candidate.type !== 'shape' || !contains(rect, textRect)) continue;
    const area = rect.width * rect.height;
    if (area < bestArea) {
      bestArea = area;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function contentBlockers(
  elements: GeneratedSlideData['elements'],
  excludedIndexes: Set<number>,
): Array<{ index: number; rect: Rect }> {
  return elements.flatMap((element, index) => {
    if (excludedIndexes.has(index) || !CONTENT_TYPES.has(element.type)) return [];
    const rect = rectFor(element);
    return rect ? [{ index, rect }] : [];
  });
}

function canExpandAgainstBlockers(
  rects: Rect[],
  elements: GeneratedSlideData['elements'],
  excludedIndexes: Set<number>,
): boolean {
  return contentBlockers(elements, excludedIndexes).every(({ rect: blocker }) =>
    rects.every((rect) => !conflictsWithGap(rect, blocker)),
  );
}

function applyGeometryChecks(
  elements: GeneratedSlideData['elements'],
  issues: SlideLayoutIssue[],
  repairedIndexes: Set<number>,
  mode: 'report' | 'repair',
  canvasWidth: number,
  canvasHeight: number,
): void {
  elements.forEach((element, index) => {
    const rect = geometryFor(element);
    if (!rect) {
      issues.push({
        code: 'invalid_geometry',
        severity: 'error',
        elementRefs: [ref(elements, index)],
        repaired: false,
      });
      return;
    }
    if (!isOutside(rect, canvasWidth, canvasHeight)) return;

    const translation = translateIntoCanvas(rect, canvasWidth, canvasHeight);
    const repaired = mode === 'repair' && translation !== null;
    if (repaired && translation) {
      if (element.type === 'line') {
        const start = element.start as [number, number];
        const end = element.end as [number, number];
        element.start = [start[0] + translation.dx, start[1] + translation.dy];
        element.end = [end[0] + translation.dx, end[1] + translation.dy];
      } else {
        element.left += translation.dx;
        element.top += translation.dy;
      }
      repairedIndexes.add(index);
    }
    issues.push({
      code: 'out_of_canvas',
      severity: 'error',
      elementRefs: [ref(elements, index)],
      repaired,
      measurements: {
        left: rect.left,
        top: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
      },
    });
  });
}

function applyTextHeightChecks(
  elements: GeneratedSlideData['elements'],
  issues: SlideLayoutIssue[],
  repairedIndexes: Set<number>,
  mode: 'report' | 'repair',
  canvasHeight: number,
): void {
  elements.forEach((element, index) => {
    const rect = rectFor(element);
    if (!rect) return;

    let content: unknown;
    let lineHeight: unknown;
    let paragraphSpace: unknown;
    if (element.type === 'text') {
      content = element.content;
      lineHeight = element.lineHeight;
      paragraphSpace = element.paragraphSpace;
    } else if (element.type === 'shape' && element.text && typeof element.text === 'object') {
      const shapeText = element.text as Record<string, unknown>;
      content = shapeText.content;
      lineHeight = shapeText.lineHeight;
      paragraphSpace = shapeText.paragraphSpace;
    } else {
      return;
    }
    if (typeof content !== 'string') return;

    const requiredHeight = estimateRequiredTextHeight({
      content,
      width: rect.width,
      lineHeight,
      paragraphSpace,
    });
    if (requiredHeight <= rect.height) return;

    const proposedTextRect = { ...rect, height: requiredHeight };
    let repaired = false;
    const refs = [ref(elements, index)];

    if (mode === 'repair' && proposedTextRect.top + proposedTextRect.height <= canvasHeight) {
      if (element.type === 'shape') {
        if (
          isAxisAlignedRectangle(element) &&
          canExpandAgainstBlockers([proposedTextRect], elements, new Set([index]))
        ) {
          element.height = requiredHeight;
          repaired = true;
          repairedIndexes.add(index);
        }
      } else {
        const backgroundIndex = findBackgroundShape(elements, index, rect);
        if (backgroundIndex === null) {
          if (canExpandAgainstBlockers([proposedTextRect], elements, new Set([index]))) {
            element.height = requiredHeight;
            repaired = true;
            repairedIndexes.add(index);
          }
        } else {
          const background = elements[backgroundIndex];
          const backgroundRect = rectFor(background);
          const delta = requiredHeight - rect.height;
          if (backgroundRect) {
            const proposedBackgroundRect = {
              ...backgroundRect,
              height: backgroundRect.height + delta,
            };
            refs.push(ref(elements, backgroundIndex));
            if (
              isAxisAlignedRectangle(background) &&
              proposedBackgroundRect.top + proposedBackgroundRect.height <= canvasHeight &&
              canExpandAgainstBlockers(
                [proposedTextRect, proposedBackgroundRect],
                elements,
                new Set([index, backgroundIndex]),
              )
            ) {
              element.height = requiredHeight;
              background.height = proposedBackgroundRect.height;
              repaired = true;
              repairedIndexes.add(index);
              repairedIndexes.add(backgroundIndex);
            }
          }
        }
      }
    } else if (element.type === 'text') {
      const backgroundIndex = findBackgroundShape(elements, index, rect);
      if (backgroundIndex !== null) refs.push(ref(elements, backgroundIndex));
    }

    issues.push({
      code: 'text_height_insufficient',
      severity: 'error',
      elementRefs: refs,
      repaired,
      measurements: { currentHeight: rect.height, requiredHeight },
    });
  });
}

function appendSafeMarginIssues(
  elements: GeneratedSlideData['elements'],
  issues: SlideLayoutIssue[],
  canvasWidth: number,
  canvasHeight: number,
): void {
  elements.forEach((element, index) => {
    const rect = geometryFor(element);
    if (!rect || isOutside(rect, canvasWidth, canvasHeight)) return;
    if (
      rect.left < SAFE_MARGIN ||
      rect.top < SAFE_MARGIN ||
      rect.left + rect.width > canvasWidth - SAFE_MARGIN ||
      rect.top + rect.height > canvasHeight - SAFE_MARGIN
    ) {
      issues.push({
        code: 'unsafe_margin',
        severity: 'warning',
        elementRefs: [ref(elements, index)],
        repaired: false,
        measurements: {
          left: rect.left,
          top: rect.top,
          right: rect.left + rect.width,
          bottom: rect.top + rect.height,
        },
      });
    }
  });
}

function appendOverlapIssues(
  elements: GeneratedSlideData['elements'],
  issues: SlideLayoutIssue[],
): void {
  for (let leftIndex = 0; leftIndex < elements.length; leftIndex += 1) {
    const leftElement = elements[leftIndex];
    const leftRect = geometryFor(leftElement);
    if (!leftRect) continue;

    for (let rightIndex = leftIndex + 1; rightIndex < elements.length; rightIndex += 1) {
      const rightElement = elements[rightIndex];
      const rightRect = geometryFor(rightElement);
      if (!rightRect) continue;

      const lineIndex =
        leftElement.type === 'line' ? leftIndex : rightElement.type === 'line' ? rightIndex : null;
      const textIndex =
        leftElement.type === 'text' ? leftIndex : rightElement.type === 'text' ? rightIndex : null;
      if (lineIndex !== null && textIndex !== null && rectsOverlap(leftRect, rightRect)) {
        issues.push({
          code: 'line_text_overlap',
          severity: 'warning',
          elementRefs: [ref(elements, lineIndex), ref(elements, textIndex)],
          repaired: false,
        });
        continue;
      }

      const isTextPair = leftElement.type === 'text' && rightElement.type === 'text';
      const isTextMediaPair =
        (leftElement.type === 'text' && MEDIA_TYPES.has(rightElement.type)) ||
        (rightElement.type === 'text' && MEDIA_TYPES.has(leftElement.type));
      const isMediaPair = MEDIA_TYPES.has(leftElement.type) && MEDIA_TYPES.has(rightElement.type);
      if ((isTextPair || isTextMediaPair || isMediaPair) && rectsOverlap(leftRect, rightRect)) {
        issues.push({
          code: 'element_overlap',
          severity: 'warning',
          elementRefs: [ref(elements, leftIndex), ref(elements, rightIndex)],
          repaired: false,
        });
      }
    }
  }
}

export function validateAndRepairSlideLayout(
  elements: GeneratedSlideData['elements'],
  options: SlideLayoutGuardOptions = {},
): SlideLayoutResult {
  const mode = options.mode ?? 'repair';
  if (mode === 'off') {
    return { elements, issues: [], repairedElementCount: 0, unresolvedIssueCount: 0 };
  }

  const canvasWidth = options.canvasWidth ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = options.canvasHeight ?? DEFAULT_CANVAS_HEIGHT;
  const workingElements = cloneElements(elements);
  const issues: SlideLayoutIssue[] = [];
  const repairedIndexes = new Set<number>();

  applyGeometryChecks(workingElements, issues, repairedIndexes, mode, canvasWidth, canvasHeight);
  applyTextHeightChecks(workingElements, issues, repairedIndexes, mode, canvasHeight);
  appendSafeMarginIssues(workingElements, issues, canvasWidth, canvasHeight);
  appendOverlapIssues(workingElements, issues);

  return {
    elements: workingElements,
    issues,
    repairedElementCount: repairedIndexes.size,
    unresolvedIssueCount: issues.filter((issue) => !issue.repaired).length,
  };
}
