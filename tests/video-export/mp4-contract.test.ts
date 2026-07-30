import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import type { Action } from '@/lib/types/action';
import type { Scene } from '@/lib/types/stage';
import {
  compileVideoTimeline,
  emitHyperframes,
  prepareVideoExportScenes,
  type AssetSource,
  type TimingProbe,
} from '@/lib/video-export';
import { packageVideoZip } from '@/lib/video-export-app/package-zip';

const NO_ASSETS: AssetSource = { audio: () => null, media: () => null };
const NO_TIMING: TimingProbe = { audioDurationMs: () => null, videoDurationMs: () => null };

function slide(id: string, order: number, actions: Action[] = []): Scene {
  return {
    id,
    stageId: 'stage-1',
    type: 'slide',
    title: id,
    order,
    actions,
    content: {
      type: 'slide',
      canvas: {
        id: `canvas-${id}`,
        viewportSize: 1000,
        viewportRatio: 0.5625,
        theme: {
          backgroundColor: '#fff',
          themeColors: [],
          fontColor: '#000',
          fontName: 'sans-serif',
        },
        elements: [],
      },
    },
  } as Scene;
}

function nonSlide(id: string, type: 'quiz' | 'interactive' | 'pbl', order: number): Scene {
  return {
    id,
    stageId: 'stage-1',
    type,
    title: id,
    order,
    actions: [{ id: `${id}-speech`, type: 'speech', text: `private-${id}` }],
    content: { type },
  } as unknown as Scene;
}

describe('prepareVideoExportScenes', () => {
  it('exports only double-validated slides, stably ordered, without mutating course data', () => {
    const unsupported = { id: 'wb', type: 'wb_open' } as Action;
    const input = [
      nonSlide('quiz', 'quiz', 0),
      slide('second', 2, [unsupported, { id: 's2', type: 'speech', text: 'two' }]),
      slide('first-a', 1, [{ id: 's1a', type: 'speech', text: 'one' }]),
      nonSlide('interactive', 'interactive', 3),
      slide('first-b', 1, [{ id: 'laser', type: 'laser', elementId: 'missing' }]),
      nonSlide('pbl', 'pbl', 4),
    ];
    const originalActions = input[1].actions;

    const prepared = prepareVideoExportScenes(input);

    expect(prepared.scenes.map((scene) => scene.id)).toEqual(['first-a', 'first-b', 'second']);
    expect(prepared.scenes[2].actions?.map((action) => action.type)).toEqual(['speech']);
    expect(input[1].actions).toBe(originalActions);
    expect(input[1].actions?.map((action) => action.type)).toEqual(['wb_open', 'speech']);
    expect(prepared.report).toMatchObject({
      inputSceneCount: 6,
      exportedSceneCount: 3,
      filteredSceneCount: 3,
      filteredActionCount: 1,
    });
  });

  it('excludes a scene when scene.type and content.type disagree', () => {
    const mismatched = slide('mismatch', 0);
    mismatched.type = 'quiz';
    const prepared = prepareVideoExportScenes([mismatched]);
    expect(prepared.scenes).toEqual([]);
    expect(prepared.report.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'mismatched-scene-type', sceneId: 'mismatch' }),
    );
  });
});

describe('subtitle-free MP4 project contract', () => {
  it('keeps non-slide scenes and unsupported actions out even for a direct compiler caller', () => {
    const source = slide('direct-slide', 1, [{ id: 'wb', type: 'wb_open' } as Action]);
    const ir = compileVideoTimeline(
      {
        stage: { id: 'stage-1', name: 'Course' },
        scenes: [nonSlide('direct-quiz', 'quiz', 0), source],
      },
      { timing: NO_TIMING, assets: NO_ASSETS },
    );

    expect(ir.scenes.map((scene) => scene.id)).toEqual(['direct-slide']);
    expect(ir.scenes[0].markers).toEqual([
      expect.objectContaining({ kind: 'empty-scene', durationMs: 2000 }),
    ]);
    expect(ir.totalDurationMs).toBe(2000);
    expect(ir.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'filtered-scene', sceneId: 'direct-quiz' }),
        expect.objectContaining({ code: 'unknown-action', actionId: 'wb' }),
      ]),
    );
  });

  it('keeps an empty slide for two seconds and skips missing video at zero duration', () => {
    const empty = slide('empty', 0);
    const video = slide('video', 1, [
      { id: 'clip-action', type: 'play_video', elementId: 'clip-element' },
    ]);
    const prepared = prepareVideoExportScenes([empty, video]);
    const ir = compileVideoTimeline(
      { stage: { id: 'stage-1', name: 'Course' }, scenes: prepared.scenes },
      { timing: NO_TIMING, assets: NO_ASSETS },
    );

    expect(ir.scenes[0].durationMs).toBe(2000);
    expect(ir.scenes[1].videos[0]).toMatchObject({ durationMs: 0, durationSource: 'skipped' });
    expect(ir.totalDurationMs).toBe(2000);
  });

  it('caps an available play_video clip at five minutes', () => {
    const source = slide('long-video', 0, [
      { id: 'clip-action', type: 'play_video', elementId: 'clip-element' },
    ]);
    const ir = compileVideoTimeline(
      { stage: { id: 'stage-1', name: 'Course' }, scenes: [source] },
      {
        timing: { ...NO_TIMING, videoDurationMs: () => 10 * 60 * 1000 },
        assets: {
          ...NO_ASSETS,
          media: () => ({ id: 'clip', present: true, mimeType: 'video/mp4' }),
        },
      },
    );

    expect(ir.scenes[0].videos[0]).toMatchObject({
      durationMs: 5 * 60 * 1000,
      durationSource: 'capped',
      present: true,
    });
    expect(ir.totalDurationMs).toBe(5 * 60 * 1000);
  });

  it('serializes no narration text, subtitle track, subtitle DOM, SRT or VTT', async () => {
    const secretNarration = 'DO_NOT_SERIALIZE_THIS_COMPLETE_NARRATION';
    const source = slide('slide', 0, [
      { id: 'speech-1', type: 'speech', text: secretNarration, audioId: 'missing-audio' },
    ]);
    const prepared = prepareVideoExportScenes([source]);
    const ir = compileVideoTimeline(
      {
        stage: { id: 'stage-1', name: 'Course' },
        scenes: prepared.scenes,
        diagnostics: prepared.report.diagnostics,
      },
      { timing: NO_TIMING, assets: NO_ASSETS },
    );
    const project = emitHyperframes(ir, { width: 1600, height: 900 });
    const manifest =
      project.files.find((file) => file.path.endsWith('manifest.json'))?.content ?? '';
    const html = project.files.find((file) => file.path === 'index.html')?.content ?? '';

    expect(ir).not.toHaveProperty('subtitles');
    expect(ir.scenes[0].narration[0]).not.toHaveProperty('text');
    expect(manifest).not.toContain(secretNarration);
    expect(html).not.toContain(secretNarration);
    expect(html.toLowerCase()).not.toContain('subtitle');
    expect(project.files.map((file) => file.path)).not.toContain('subtitles.srt');
    expect(project.files.map((file) => file.path)).not.toContain('subtitles.vtt');
    expect(JSON.stringify(ir.diagnostics)).not.toContain(secretNarration);

    const zipBlob = await packageVideoZip(project, new Map(), { gsapSource: 'window.gsap={};' });
    const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer());
    expect(Object.keys(zip.files).some((name) => /\.srt$|\.vtt$/i.test(name))).toBe(false);
    const zipManifest = await zip.file('openmaic-video-manifest.json')!.async('string');
    expect(zipManifest).not.toContain(secretNarration);
    expect(zipManifest).not.toContain('"subtitles"');
  });
});
