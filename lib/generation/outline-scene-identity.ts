import type { SceneOutline } from '@/lib/types/generation';
import type { Scene } from '@/lib/types/stage';

type SceneIdentity = Pick<Scene, 'outlineId' | 'order'>;
type OutlineIdentity = Pick<SceneOutline, 'id' | 'order'>;

/**
 * Match a materialized scene to its source outline.
 *
 * New scenes carry outlineId, which remains stable when Pro mode rewrites display order.
 * Legacy, imported, and manually authored scenes may not have one, so they retain the
 * historical order-based fallback. A present-but-different outlineId never falls back:
 * doing so would silently bind a reordered scene to the wrong outline.
 */
export function sceneMatchesOutline(scene: SceneIdentity, outline: OutlineIdentity): boolean {
  return scene.outlineId !== undefined
    ? scene.outlineId === outline.id
    : scene.order === outline.order;
}

export function findSceneForOutline<TScene extends SceneIdentity>(
  scenes: readonly TScene[],
  outline: OutlineIdentity,
): TScene | undefined {
  return scenes.find((scene) => sceneMatchesOutline(scene, outline));
}

export function findOutlineForScene<TOutline extends OutlineIdentity>(
  outlines: readonly TOutline[],
  scene: SceneIdentity,
): TOutline | undefined {
  return scene.outlineId !== undefined
    ? outlines.find((outline) => outline.id === scene.outlineId)
    : outlines.find((outline) => outline.order === scene.order);
}
