import type { Action, ActionType } from '@/lib/types/action';
import type { Scene } from '@/lib/types/stage';
import type { Diagnostic } from './ir';

const VIDEO_ACTION_TYPES = new Set<ActionType>(['speech', 'spotlight', 'laser', 'play_video']);

export interface VideoExportPreparationReport {
  inputSceneCount: number;
  exportedSceneCount: number;
  filteredSceneCount: number;
  filteredActionCount: number;
  diagnostics: Diagnostic[];
}

export interface PreparedVideoExport {
  scenes: Scene[];
  report: VideoExportPreparationReport;
}

/**
 * Create the isolated, deterministic scene set consumed by every later export
 * phase. Non-slide scenes and unsupported actions are removed before Dexie,
 * remote media or duration probes are consulted, so excluded course content
 * cannot leak into the archive or contribute time.
 */
export function prepareVideoExportScenes(input: readonly Scene[]): PreparedVideoExport {
  const diagnostics: Diagnostic[] = [];
  let filteredSceneCount = 0;
  let filteredActionCount = 0;

  const scenes = input
    .map((scene, inputIndex) => ({ scene, inputIndex }))
    .filter(({ scene }) => {
      const contentType = (scene.content as { type?: unknown } | undefined)?.type;
      if (scene.type !== contentType) {
        filteredSceneCount += 1;
        diagnostics.push({
          severity: 'warn',
          code: 'mismatched-scene-type',
          sceneId: scene.id,
          message:
            'Scene and content types do not match; the scene was excluded from video export.',
        });
        return false;
      }
      if (scene.type !== 'slide' || contentType !== 'slide') {
        filteredSceneCount += 1;
        diagnostics.push({
          severity: 'info',
          code: 'filtered-scene',
          sceneId: scene.id,
          message: 'Non-slide scene excluded from video export.',
        });
        return false;
      }
      return true;
    })
    .sort((left, right) => {
      const orderDiff = left.scene.order - right.scene.order;
      return orderDiff === 0 ? left.inputIndex - right.inputIndex : orderDiff;
    })
    .map(({ scene }) => {
      const actions: Action[] = [];
      for (const action of scene.actions ?? []) {
        if (VIDEO_ACTION_TYPES.has(action.type)) {
          actions.push(action);
        } else {
          filteredActionCount += 1;
          diagnostics.push({
            severity: 'info',
            code: 'filtered-action',
            sceneId: scene.id,
            actionId: action.id,
            message:
              'Unsupported slide action excluded from video export and assigned zero duration.',
          });
        }
      }

      return { ...scene, actions } as Scene;
    });

  return {
    scenes,
    report: {
      inputSceneCount: input.length,
      exportedSceneCount: scenes.length,
      filteredSceneCount,
      filteredActionCount,
      diagnostics,
    },
  };
}
