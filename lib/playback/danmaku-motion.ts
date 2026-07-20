const DEFAULT_TRACK_WIDTH = 1_440;
const MIN_TRACK_WIDTH = 320;
const MIN_DURATION_MS = 9_000;
const MAX_DURATION_MS = 20_000;
const TARGET_SPEED_PX_PER_SECOND = 140;
const ITEM_HORIZONTAL_PADDING_PX = 28;
const MAX_ITEM_WIDTH_RATIO = 0.75;

function estimateGlyphWidth(character: string): number {
  if (/\s/.test(character)) return 5;
  if (/^[\u0000-\u00ff]$/.test(character)) return 8;
  return 16;
}

export function getDanmakuTrackWidth(): number {
  if (typeof window === 'undefined') return DEFAULT_TRACK_WIDTH;
  return Math.max(MIN_TRACK_WIDTH, document.documentElement.clientWidth || window.innerWidth);
}

export function estimateDanmakuItemWidth(content: string, trackWidth: number): number {
  const glyphWidth = Array.from(content).reduce(
    (total, character) => total + estimateGlyphWidth(character),
    0,
  );
  return Math.min(
    Math.max(ITEM_HORIZONTAL_PADDING_PX, glyphWidth + ITEM_HORIZONTAL_PADDING_PX),
    Math.max(ITEM_HORIZONTAL_PADDING_PX, trackWidth * MAX_ITEM_WIDTH_RATIO),
  );
}

export function getDanmakuDuration(content: string, trackWidth = getDanmakuTrackWidth()): number {
  const normalizedTrackWidth = Math.max(MIN_TRACK_WIDTH, trackWidth);
  const distance = normalizedTrackWidth + estimateDanmakuItemWidth(content, normalizedTrackWidth);
  const duration = Math.round((distance / TARGET_SPEED_PX_PER_SECOND) * 1_000);
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, duration));
}
