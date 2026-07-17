import JSZip from 'jszip';
import { describe, test, expect, vi } from 'vitest';
import {
  rewriteAudioRefsToIds,
  actionsToManifest,
  collectAudioFiles,
  resolveAudioFormat,
} from '@/lib/export/classroom-zip-utils';
import {
  CLASSROOM_ZIP_FORMAT_VERSION,
  type ClassroomManifest,
} from '@/lib/export/classroom-zip-types';
import type { DiscussionAction, SpeechAction, SpotlightAction } from '@/lib/types/action';
import type { AudioFileRecord } from '@/lib/utils/database';
import type { Scene } from '@/lib/types/stage';

function scenesWithSpeech(
  actions: Array<Pick<SpeechAction, 'id' | 'type' | 'text' | 'audioId' | 'audioUrl'>>,
): Scene[] {
  return [{ actions }] as unknown as Scene[];
}

// ─── collectAudioFiles ───────────────────────────────────────

describe('collectAudioFiles', () => {
  test('uses the IndexedDB record without fetching the remote URL', async () => {
    const localRecord: AudioFileRecord = {
      id: 'audio-local',
      blob: new Blob(['local-audio'], { type: 'audio/wav' }),
      format: 'wav',
      createdAt: 1,
    };
    const getLocalAudio = vi.fn(async () => localRecord);
    const fetchImpl = vi.fn();

    const result = await collectAudioFiles(
      scenesWithSpeech([
        {
          id: 'a1',
          type: 'speech',
          text: 'Hello',
          audioId: 'audio-local',
          audioUrl: '/api/courses/course-1/audio/audio-local',
        },
      ]),
      { getLocalAudio, fetchImpl },
    );

    expect(result.missing).toEqual([]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      zipPath: 'audio/audio-local.wav',
      source: 'indexeddb',
      record: { id: 'audio-local', format: 'wav' },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('downloads authenticated server audio when IndexedDB has no record', async () => {
    const getLocalAudio = vi.fn(async () => undefined);
    const fetchImpl = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2, 3, 4]), {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg; charset=binary' },
        }),
    );
    const audioUrl = '/api/courses/course-1/audio/tts-1';

    const result = await collectAudioFiles(
      scenesWithSpeech([{ id: 'a1', type: 'speech', text: 'Hello', audioId: 'tts-1', audioUrl }]),
      { getLocalAudio, fetchImpl },
    );

    expect(result.missing).toEqual([]);
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({
      zipPath: 'audio/tts-1.mp3',
      source: 'remote',
      record: { id: 'tts-1', format: 'mp3' },
    });
    expect(result.files[0].record.blob.size).toBe(4);
    expect(fetchImpl).toHaveBeenCalledWith(audioUrl, { credentials: 'same-origin' });
  });

  test('reports every unresolved audio reference instead of silently dropping it', async () => {
    const result = await collectAudioFiles(
      scenesWithSpeech([
        { id: 'a1', type: 'speech', text: 'One', audioId: 'missing-local' },
        {
          id: 'a2',
          type: 'speech',
          text: 'Two',
          audioId: 'missing-remote',
          audioUrl: '/api/courses/course-1/audio/missing-remote',
        },
      ]),
      {
        getLocalAudio: async () => undefined,
        fetchImpl: async () => new Response('forbidden', { status: 403 }),
      },
    );

    expect(result.files).toEqual([]);
    expect(result.missing).toHaveLength(2);
    expect(result.missing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ audioId: 'missing-local', reason: expect.any(String) }),
        expect.objectContaining({
          audioId: 'missing-remote',
          reason: 'Audio download failed with HTTP 403',
        }),
      ]),
    );
  });

  test('derives portable extensions from content type, then URL, then MP3 fallback', () => {
    expect(resolveAudioFormat('audio/x-wav')).toBe('wav');
    expect(resolveAudioFormat('application/octet-stream', 'https://cdn.test/voice.ogg?x=1')).toBe(
      'ogg',
    );
    expect(resolveAudioFormat('application/octet-stream', '/api/audio/no-extension')).toBe('mp3');
  });

  test('produces a ZIP with remote audio and a server-independent manifest reference', async () => {
    const actions = [
      {
        id: 'a1',
        type: 'speech' as const,
        text: 'Portable narration',
        audioId: 'tts-portable',
        audioUrl: '/api/courses/original/audio/tts-portable',
      } as SpeechAction,
    ];
    const collection = await collectAudioFiles(scenesWithSpeech(actions), {
      getLocalAudio: async () => undefined,
      fetchImpl: async () =>
        new Response(new Uint8Array([7, 8, 9]), {
          headers: { 'Content-Type': 'audio/ogg' },
        }),
    });
    const audioIdToPath = new Map(collection.files.map((file) => [file.record.id, file.zipPath]));
    const manifestActions = actionsToManifest(actions, audioIdToPath);
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify({ scenes: [{ actions: manifestActions }] }));
    // JSZip's Node test runtime does not recognize Node's Blob implementation;
    // browsers accept the Blob directly, while ArrayBuffer verifies identical bytes here.
    for (const file of collection.files) {
      zip.file(file.zipPath, await file.record.blob.arrayBuffer());
    }

    const bytes = await zip.generateAsync({ type: 'uint8array' });
    const restored = await JSZip.loadAsync(bytes);
    const manifest = JSON.parse(await restored.file('manifest.json')!.async('string')) as {
      scenes: Array<{ actions: Array<Record<string, unknown>> }>;
    };

    expect(restored.file('audio/tts-portable.ogg')).not.toBeNull();
    expect(manifest.scenes[0].actions[0]).toMatchObject({
      audioRef: 'audio/tts-portable.ogg',
    });
    expect(manifest.scenes[0].actions[0]).not.toHaveProperty('audioId');
    expect(manifest.scenes[0].actions[0]).not.toHaveProperty('audioUrl');
  });
});

// ─── rewriteAudioRefsToIds ────────────────────────────────────

describe('rewriteAudioRefsToIds', () => {
  test('replaces audioRef with new audioId in speech actions', () => {
    const actions = [
      { id: 'a1', type: 'speech' as const, text: 'Hello', audioRef: 'audio/abc.mp3' },
      { id: 'a2', type: 'spotlight' as const, elementId: 'el1' },
    ];
    const audioRefMap = { 'audio/abc.mp3': 'new-audio-id-1' };
    const result = rewriteAudioRefsToIds(actions, audioRefMap);
    expect(result[0]).toMatchObject({
      type: 'speech',
      text: 'Hello',
      audioId: 'new-audio-id-1',
    });
    expect(result[1]).toMatchObject({ type: 'spotlight', elementId: 'el1' });
  });

  test('skips speech actions without audioRef', () => {
    const actions = [
      { id: 'a1', type: 'speech' as const, text: 'Hello', audioUrl: 'https://example.com/a.mp3' },
    ];
    const result = rewriteAudioRefsToIds(actions, {});
    expect(result[0]).toMatchObject({
      type: 'speech',
      text: 'Hello',
      audioUrl: 'https://example.com/a.mp3',
    });
  });

  test('drops a legacy server URL when an imported audioRef resolves locally', () => {
    const actions = [
      {
        id: 'a1',
        type: 'speech' as const,
        text: 'Hello',
        audioRef: 'audio/abc.mp3',
        audioUrl: '/api/courses/original/audio/abc',
      },
    ];
    const result = rewriteAudioRefsToIds(actions, { 'audio/abc.mp3': 'new-audio-id-1' });

    expect(result[0]).toMatchObject({ audioId: 'new-audio-id-1' });
    expect(result[0]).not.toHaveProperty('audioUrl');
  });

  test('replaces discussion agentIndex with imported agentId', () => {
    const actions = [{ id: 'a1', type: 'discussion' as const, topic: 'Discuss', agentIndex: 1 }];
    const result = rewriteAudioRefsToIds(actions, {}, { agentIds: ['agent-1', 'agent-2'] });
    expect(result[0]).toMatchObject({
      type: 'discussion',
      topic: 'Discuss',
      agentId: 'agent-2',
    });
    expect(result[0]).not.toHaveProperty('agentIndex');
  });

  test('falls back to a valid imported agent when legacy discussion agentId is stale', () => {
    const actions = [
      { id: 'a1', type: 'discussion' as const, topic: 'Discuss', agentId: 'old-agent-id' },
    ];
    const result = rewriteAudioRefsToIds(
      actions,
      {},
      {
        agentIds: ['teacher-1', 'student-1'],
        fallbackDiscussionAgentIndex: 1,
      },
    );
    expect(result[0]).toMatchObject({
      type: 'discussion',
      topic: 'Discuss',
      agentId: 'student-1',
    });
  });

  test('preserves legacy discussion agentId when imported classroom has no generated agents', () => {
    const actions = [
      { id: 'a1', type: 'discussion' as const, topic: 'Discuss', agentId: 'default-2' },
    ];
    const result = rewriteAudioRefsToIds(actions, {}, { agentIds: [] });
    expect(result[0]).toMatchObject({
      type: 'discussion',
      topic: 'Discuss',
      agentId: 'default-2',
    });
  });
});

// ─── actionsToManifest ────────────────────────────────────────

describe('actionsToManifest', () => {
  test('converts audioId to audioRef for speech actions', () => {
    const actions = [
      {
        id: 'act1',
        type: 'speech' as const,
        text: 'Hello',
        audioId: 'audio-123',
        voice: 'alloy',
        speed: 1,
      } as SpeechAction,
      { id: 'act2', type: 'spotlight' as const, elementId: 'el1' } as SpotlightAction,
    ];
    const audioIdToPath = new Map([['audio-123', 'audio/audio-123.mp3']]);

    const result = actionsToManifest(actions, audioIdToPath);

    expect(result[0]).toMatchObject({
      type: 'speech',
      text: 'Hello',
      audioRef: 'audio/audio-123.mp3',
      voice: 'alloy',
    });
    expect(result[0]).not.toHaveProperty('audioId');
    expect(result[1]).toMatchObject({ type: 'spotlight', elementId: 'el1' });
  });

  test('preserves audioUrl when audioId is absent', () => {
    const actions = [
      {
        id: 'act1',
        type: 'speech' as const,
        text: 'Hi',
        audioUrl: 'https://cdn.example.com/hi.mp3',
      } as SpeechAction,
    ];
    const result = actionsToManifest(actions, new Map());
    expect(result[0]).toMatchObject({
      type: 'speech',
      text: 'Hi',
      audioUrl: 'https://cdn.example.com/hi.mp3',
    });
    expect(result[0]).not.toHaveProperty('audioRef');
  });

  test('removes the original server URL when audio was bundled', () => {
    const actions = [
      {
        id: 'act1',
        type: 'speech' as const,
        text: 'Hi',
        audioId: 'audio-123',
        audioUrl: '/api/courses/original/audio/audio-123',
      } as SpeechAction,
    ];
    const result = actionsToManifest(actions, new Map([['audio-123', 'audio/audio-123.mp3']]));

    expect(result[0]).toMatchObject({ audioRef: 'audio/audio-123.mp3' });
    expect(result[0]).not.toHaveProperty('audioUrl');
  });

  test('converts discussion agentId to agentIndex', () => {
    const actions = [
      {
        id: 'act1',
        type: 'discussion' as const,
        topic: 'What tradeoff would you make?',
        prompt: 'Argue for one compromise.',
        agentId: 'student-2',
      } as DiscussionAction,
    ];
    const result = actionsToManifest(actions, new Map(), new Map([['student-2', 2]]));
    expect(result[0]).toMatchObject({
      type: 'discussion',
      topic: 'What tradeoff would you make?',
      prompt: 'Argue for one compromise.',
      agentIndex: 2,
    });
    expect(result[0]).not.toHaveProperty('agentId');
  });

  test('preserves discussion agentId when no manifest agent index is available', () => {
    const actions = [
      {
        id: 'act1',
        type: 'discussion' as const,
        topic: 'Which viewpoint is stronger?',
        agentId: 'default-2',
      } as DiscussionAction,
    ];
    const result = actionsToManifest(actions, new Map(), new Map());
    expect(result[0]).toMatchObject({
      type: 'discussion',
      topic: 'Which viewpoint is stronger?',
      agentId: 'default-2',
    });
    expect(result[0]).not.toHaveProperty('agentIndex');
  });
});

// ─── Manifest round-trip ──────────────────────────────────────

describe('manifest round-trip', () => {
  test('manifest structure is valid JSON-serializable', () => {
    const manifest: ClassroomManifest = {
      formatVersion: CLASSROOM_ZIP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      stage: {
        name: 'Test Course',
        description: 'A test',
        language: 'en-US',
        style: 'professional',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      agents: [
        {
          name: 'Prof',
          role: 'lecturer',
          persona: 'Friendly professor',
          avatar: '👨‍🏫',
          color: '#4A90D9',
          priority: 1,
        },
        {
          name: 'Student',
          role: 'student',
          persona: 'Reflective student',
          avatar: '🧑‍🎓',
          color: '#FFB347',
          priority: 2,
        },
      ],
      scenes: [
        {
          type: 'slide',
          title: 'Intro',
          order: 0,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content: { type: 'slide', canvas: { id: 's1', elements: [] } } as any,
          actions: [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: 'a1', type: 'speech', text: 'Welcome', audioRef: 'audio/a1.mp3' } as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { id: 'a2', type: 'discussion', topic: 'Why does this matter?', agentIndex: 1 } as any,
          ],
        },
      ],
      mediaIndex: {
        'audio/a1.mp3': { type: 'audio', format: 'mp3', duration: 5.2 },
      },
    };

    const serialized = JSON.stringify(manifest);
    const deserialized = JSON.parse(serialized) as ClassroomManifest;

    expect(deserialized.formatVersion).toBe(CLASSROOM_ZIP_FORMAT_VERSION);
    expect(deserialized.stage.name).toBe('Test Course');
    expect(deserialized.agents).toHaveLength(2);
    expect(deserialized.scenes).toHaveLength(1);
    expect(deserialized.scenes[0].actions?.[0]).toMatchObject({
      type: 'speech',
      audioRef: 'audio/a1.mp3',
    });
    expect(deserialized.scenes[0].actions?.[1]).toMatchObject({
      type: 'discussion',
      topic: 'Why does this matter?',
      agentIndex: 1,
    });
    expect(deserialized.mediaIndex['audio/a1.mp3']).toMatchObject({
      type: 'audio',
      duration: 5.2,
    });
  });
});
