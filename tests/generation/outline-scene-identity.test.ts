import { describe, expect, it } from 'vitest';

import {
  findOutlineForScene,
  findSceneForOutline,
  sceneMatchesOutline,
} from '@/lib/generation/outline-scene-identity';

const outlines = [
  { id: 'outline-a', order: 1 },
  { id: 'outline-b', order: 2 },
];

describe('outline-scene stable identity', () => {
  it('keeps a generated scene bound after display order changes', () => {
    const reorderedScene = { outlineId: 'outline-a', order: 2 };

    expect(sceneMatchesOutline(reorderedScene, outlines[0])).toBe(true);
    expect(sceneMatchesOutline(reorderedScene, outlines[1])).toBe(false);
    expect(findOutlineForScene(outlines, reorderedScene)).toBe(outlines[0]);
  });

  it('falls back to order only for legacy scenes without outlineId', () => {
    const legacyScene = { order: 2 };

    expect(findOutlineForScene(outlines, legacyScene)).toBe(outlines[1]);
    expect(findSceneForOutline([legacyScene], outlines[1])).toBe(legacyScene);
  });

  it('does not silently fall back when a present outlineId is unknown', () => {
    const mismatchedScene = { outlineId: 'deleted-outline', order: 1 };

    expect(findOutlineForScene(outlines, mismatchedScene)).toBeUndefined();
    expect(findSceneForOutline([mismatchedScene], outlines[0])).toBeUndefined();
  });
});
