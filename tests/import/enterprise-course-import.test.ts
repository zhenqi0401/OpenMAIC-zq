import JSZip from 'jszip';
import { describe, expect, test } from 'vitest';

import {
  EnterpriseCourseImportError,
  prepareManifestForEnterpriseImport,
  validateClassroomManifest,
} from '@/lib/import/enterprise-course-import';
import { parseEnterpriseCourseZip } from '@/lib/import/enterprise-course-zip';

function manifest(formatVersion: number | undefined = 1) {
  return {
    ...(formatVersion === undefined ? {} : { formatVersion }),
    exportedAt: '2026-08-03T00:00:00.000Z',
    appVersion: '0.3.0',
    stage: { name: 'Portable Course', description: 'Imported', createdAt: 1, updatedAt: 1 },
    agents: [
      { name: 'Teacher', role: 'teacher', persona: 'T', avatar: '', color: '#111', priority: 1 },
      { name: 'Student', role: 'student', persona: 'S', avatar: '', color: '#222', priority: 2 },
    ],
    scenes: [
      {
        type: 'slide',
        title: 'Second',
        order: 2,
        content: { type: 'slide', canvas: { elements: [] } },
        actions: [
          {
            id: 'speech-1',
            type: 'speech',
            text: 'Hello',
            audioRef: 'audio/voice.mp3',
            audioUrl: 'https://old.invalid/voice.mp3',
          },
          { id: 'discussion-1', type: 'discussion', agentIndex: 1, prompt: 'Discuss' },
        ],
        multiAgent: { enabled: true, agentIndices: [0, 1], directorPrompt: 'Direct' },
      },
      {
        type: 'slide',
        title: 'First',
        order: 1,
        content: {
          type: 'slide',
          canvas: { elements: [{ id: 'gen_img_1', type: 'image', src: 'gen_img_1' }] },
        },
      },
    ],
    mediaIndex: {
      'audio/voice.mp3': { type: 'audio', format: 'mp3', voice: 'v1' },
      'media/gen_img_1.png': { type: 'generated', mimeType: 'image/png', prompt: 'diagram' },
      'media/gen_vid_1.mp4': { type: 'generated', mimeType: 'video/mp4', prompt: 'demo' },
    },
  };
}

describe('enterprise course ZIP import', () => {
  test.each([1, undefined])('accepts current and legacy manifests (version %s)', (version) => {
    expect(validateClassroomManifest(manifest(version)).formatVersion).toBe(1);
  });

  test('rewrites stage, scene, audio and Agent references without retaining remote audio URLs', () => {
    const value = manifest();
    const binaries = new Map([
      ['audio/voice.mp3', { data: new Uint8Array([1]) }],
      ['media/gen_img_1.png', { data: new Uint8Array([2]) }],
      ['media/gen_vid_1.mp4', { data: new Uint8Array([3]), posterData: new Uint8Array([4]) }],
    ]);
    const prepared = prepareManifestForEnterpriseImport(value, new Set(binaries.keys()), binaries);

    expect(prepared.scenes.map((scene) => scene.title)).toEqual(['First', 'Second']);
    expect(prepared.stage).toMatchObject({
      name: 'Portable Course',
      agentIds: [expect.any(String), expect.any(String)],
      generatedAgentConfigs: [
        expect.objectContaining({ id: expect.any(String), role: 'teacher' }),
        expect.objectContaining({ id: expect.any(String), role: 'student' }),
      ],
    });
    const actions = prepared.scenes[1].actions as Array<Record<string, unknown>>;
    expect(actions[0]).toMatchObject({ type: 'speech', audioId: expect.any(String) });
    expect(actions[0]).not.toHaveProperty('audioUrl');
    expect(actions[1]).toMatchObject({ type: 'discussion', agentId: expect.any(String) });
    expect(prepared.scenes[1].multiAgent).toMatchObject({
      enabled: true,
      agentIds: [expect.any(String), expect.any(String)],
    });
    expect(prepared.binaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'image', mediaId: 'gen_img_1' }),
        expect.objectContaining({
          kind: 'video',
          mediaId: 'gen_vid_1',
          posterData: expect.any(Uint8Array),
        }),
      ]),
    );
  });

  test('turns missing and empty resources into warnings while retaining the course', () => {
    const prepared = prepareManifestForEnterpriseImport(
      manifest(),
      new Set(['audio/voice.mp3', 'media/gen_img_1.png']),
      new Map([
        ['audio/voice.mp3', { data: new Uint8Array() }],
        ['media/gen_img_1.png', { data: new Uint8Array([1]) }],
      ]),
    );
    expect(prepared.scenes).toHaveLength(2);
    expect(prepared.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'audio', path: 'audio/voice.mp3', reason: 'file_empty' }),
        expect.objectContaining({
          kind: 'video',
          path: 'media/gen_vid_1.mp4',
          reason: 'file_missing',
        }),
      ]),
    );
  });

  test('rejects future versions, traversal, duplicate media IDs and illegal references', () => {
    expect(() => validateClassroomManifest(manifest(2))).toThrow(EnterpriseCourseImportError);
    const traversal = manifest();
    traversal.mediaIndex = { '../voice.mp3': { type: 'audio', format: 'mp3' } };
    expect(() => validateClassroomManifest(traversal)).toThrow('非法媒体路径');
    const duplicate = manifest();
    duplicate.mediaIndex = {
      'a/gen_img_1.png': { type: 'image', mimeType: 'image/png' },
      'b/gen_img_1.jpg': { type: 'image', mimeType: 'image/jpeg' },
    };
    expect(() => validateClassroomManifest(duplicate)).toThrow('重复媒体 ID');
    const badRef = manifest();
    (badRef.scenes[0].actions![0] as { audioRef: string }).audioRef = 'audio/not-indexed.mp3';
    expect(() => validateClassroomManifest(badRef)).toThrow('非法音频引用');
  });

  test('parses a real ZIP and preserves video poster bytes', async () => {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest()));
    zip.file('audio/voice.mp3', new Uint8Array([1]));
    zip.file('media/gen_img_1.png', new Uint8Array([2]));
    zip.file('media/gen_vid_1.mp4', new Uint8Array([3]));
    zip.file('media/gen_vid_1.poster.jpg', new Uint8Array([4]));
    const bytes = await zip.generateAsync({ type: 'uint8array' });

    const parsed = await parseEnterpriseCourseZip(bytes);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.binaries.find((binary) => binary.kind === 'video')?.posterData).toEqual(
      new Uint8Array([4]),
    );
  });

  test('rejects malformed JSON and empty manifests', async () => {
    const invalid = new JSZip();
    invalid.file('manifest.json', '{');
    await expect(
      parseEnterpriseCourseZip(await invalid.generateAsync({ type: 'uint8array' })),
    ).rejects.toThrow('有效 JSON');
    expect(() => validateClassroomManifest({ stage: {}, scenes: [] })).toThrow('缺少 stage');
  });
});
