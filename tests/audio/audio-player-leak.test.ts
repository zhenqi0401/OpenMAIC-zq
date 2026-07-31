import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the IndexedDB layer so importing AudioPlayer doesn't pull in Dexie.
const getMock = vi.fn();
vi.mock('@/lib/utils/database', () => ({
  db: { audioFiles: { get: getMock } },
}));

/** Stub URL.createObjectURL/revokeObjectURL while keeping `new URL(...)` working. */
function stubObjectUrl() {
  const createObjectURL = vi.fn(() => 'blob:fake-url');
  const revokeObjectURL = vi.fn();
  class URLStub extends URL {}
  Object.assign(URLStub, { createObjectURL, revokeObjectURL });
  vi.stubGlobal('URL', URLStub);
  return { createObjectURL, revokeObjectURL };
}

function stubAudio(play: () => Promise<void>) {
  const audioInstances: AudioStub[] = [];

  class AudioStub {
    play = play;
    addEventListener = vi.fn();
    pause = vi.fn();
    volume = 1;
    defaultPlaybackRate = 1;
    preservesPitch = false;
    preload = '';
    src = '';
    currentTime = 0;
    playbackRateWrites: number[] = [];
    private currentPlaybackRate = 1;

    constructor() {
      audioInstances.push(this);
    }

    get playbackRate() {
      return this.currentPlaybackRate;
    }

    set playbackRate(value: number) {
      this.currentPlaybackRate = value;
      this.playbackRateWrites.push(value);
    }
  }
  vi.stubGlobal('Audio', AudioStub);
  return { getLatestAudio: () => audioInstances.at(-1) ?? null };
}

describe('AudioPlayer blob URL lifecycle', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    getMock.mockReset();
    getMock.mockResolvedValue({ blob: new Blob(['audio']) });
  });

  it('revokes the blob URL when play() rejects (no leak)', async () => {
    const { createObjectURL, revokeObjectURL } = stubObjectUrl();
    stubAudio(() => Promise.reject(new Error('NotAllowedError')));

    const { AudioPlayer } = await import('@/lib/utils/audio-player');

    await expect(new AudioPlayer().play('audio-1')).rejects.toThrow();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('does not revoke during a successful play() (revocation is deferred to "ended")', async () => {
    const { revokeObjectURL } = stubObjectUrl();
    stubAudio(() => Promise.resolve());

    const { AudioPlayer } = await import('@/lib/utils/audio-player');

    await expect(new AudioPlayer().play('audio-1')).resolves.toBe(true);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('configures 1.5x playback before play without rewriting the rate after playback starts', async () => {
    let resolvePlay!: () => void;
    const playPromise = new Promise<void>((resolve) => {
      resolvePlay = resolve;
    });
    const { getLatestAudio } = stubAudio(() => playPromise);

    const { AudioPlayer } = await import('@/lib/utils/audio-player');
    const player = new AudioPlayer();
    player.setPlaybackRate(1.5);

    const pending = player.play('audio-1', '/api/courses/course-1/audio/audio-1');
    await vi.waitFor(() => expect(getLatestAudio()).not.toBeNull());
    const audio = getLatestAudio();
    expect(audio?.preload).toBe('auto');
    expect(audio?.preservesPitch).toBe(true);
    expect(audio?.defaultPlaybackRate).toBe(1.5);
    expect(audio?.playbackRate).toBe(1.5);
    expect(audio?.playbackRateWrites).toEqual([1.5]);

    resolvePlay();
    await expect(pending).resolves.toBe(true);
    expect(audio?.playbackRateWrites).toEqual([1.5]);
  });
});
