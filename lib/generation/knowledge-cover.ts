import type { SceneOutline } from '@/lib/types/generation';

const MAX_ATTRIBUTION_CHARS = 160;
const MAX_NARRATION_POINTS = 8;
const MAX_NARRATION_POINT_CHARS = 500;

function normalizeText(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized && normalized.length <= max ? normalized : undefined;
}

/** Keep only the bounded cover fields accepted from a newly generated outline. */
export function normalizeKnowledgeCoverFields(outline: SceneOutline): SceneOutline {
  const next = { ...outline };
  if (outline.sceneRole !== 'cover') {
    delete next.sceneRole;
    delete next.coverBrief;
    return next;
  }

  const raw = outline.coverBrief as SceneOutline['coverBrief'] | undefined;
  const narrationPoints = Array.isArray(raw?.narrationPoints)
    ? raw.narrationPoints
        .map((point) => normalizeText(point, MAX_NARRATION_POINT_CHARS))
        .filter((point): point is string => !!point)
        .slice(0, MAX_NARRATION_POINTS)
    : [];
  const attribution = normalizeText(raw?.attribution, MAX_ATTRIBUTION_CHARS);
  next.coverBrief = {
    ...(attribution ? { attribution } : {}),
    narrationPoints,
  };
  return next;
}

export function isKnowledgeCover(outline: SceneOutline | undefined): boolean {
  return (
    !!outline &&
    outline.type === 'slide' &&
    outline.sceneRole === 'cover' &&
    Array.isArray(outline.coverBrief?.narrationPoints) &&
    outline.coverBrief.narrationPoints.length > 0
  );
}

/** A core project/role-play PBL may deliberately open in the project situation. */
export function isDirectPblOpening(outline: SceneOutline | undefined): boolean {
  return outline?.type === 'pbl';
}

export function satisfiesKnowledgeCoverStructure(outlines: SceneOutline[]): boolean {
  const first = outlines[0];
  return isDirectPblOpening(first) || isKnowledgeCover(first);
}
