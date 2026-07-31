/**
 * Audio Player - Audio player interface
 *
 * Handles audio playback, pause, stop, and other operations
 * Loads pre-generated TTS audio files from IndexedDB
 *
 */

import { db } from '@/lib/utils/database';
import { createLogger } from '@/lib/logger';

const log = createLogger('AudioPlayer');

/**
 * Audio player implementation
 */
export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private onEndedCallback: (() => void) | null = null;
  private muted: boolean = false;
  private volume: number = 1;
  private playbackRate: number = 1;

  /**
   * Configure a fresh media element before playback starts.
   *
   * Reconfiguring compressed speech immediately after play() starts can create
   * an audible discontinuity in the browser's time-stretch pipeline. Apply the
   * requested rate while the element is loading, and only write the live
   * playbackRate when the browser has actually changed/reset it.
   */
  private configurePlayback(audio: HTMLAudioElement): void {
    audio.defaultPlaybackRate = this.playbackRate;
    audio.preservesPitch = true;

    // Older Safari/Firefox releases exposed vendor-prefixed pitch controls.
    const legacyAudio = audio as HTMLAudioElement & {
      mozPreservesPitch?: boolean;
      webkitPreservesPitch?: boolean;
    };
    if ('mozPreservesPitch' in legacyAudio) legacyAudio.mozPreservesPitch = true;
    if ('webkitPreservesPitch' in legacyAudio) legacyAudio.webkitPreservesPitch = true;

    if (audio.playbackRate !== this.playbackRate) {
      audio.playbackRate = this.playbackRate;
    }
  }

  private createConfiguredAudio(src: string): HTMLAudioElement {
    this.stop();

    const audio = new Audio();
    this.audio = audio;
    audio.preload = 'auto';
    audio.src = src;
    audio.volume = this.muted ? 0 : this.volume;
    this.configurePlayback(audio);

    // Some browsers reset playbackRate while loading metadata. Re-apply only
    // if a reset really happened, and do it before playback becomes audible.
    const restorePlaybackConfiguration = () => {
      if (this.audio === audio) this.configurePlayback(audio);
    };
    audio.addEventListener('loadedmetadata', restorePlaybackConfiguration, { once: true });
    audio.addEventListener('canplay', restorePlaybackConfiguration, { once: true });

    return audio;
  }

  /**
   * Play audio (from URL or IndexedDB pre-generated cache)
   * @param audioId Audio ID
   * @param audioUrl Optional server-generated audio URL (takes priority over IndexedDB)
   * @returns true if audio started playing, false if no audio (TTS disabled or not generated)
   */
  public async play(audioId: string, audioUrl?: string): Promise<boolean> {
    try {
      // 1. Try audioUrl first (server-generated TTS)
      if (audioUrl) {
        const audio = this.createConfiguredAudio(audioUrl);
        audio.addEventListener('ended', () => {
          this.onEndedCallback?.();
        });
        await audio.play();
        return true;
      }

      // 2. Fall back to IndexedDB (client-generated TTS)
      const audioRecord = await db.audioFiles.get(audioId);

      if (!audioRecord) {
        // Pre-generated audio does not exist (generation failed), skip silently
        return false;
      }

      // Set audio source
      const blobUrl = URL.createObjectURL(audioRecord.blob);
      const audio = this.createConfiguredAudio(blobUrl);

      // Set ended callback
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(blobUrl);
        this.onEndedCallback?.();
      });

      // Play. If play() rejects (autoplay policy, decode error, interrupted
      // load) the 'ended' listener never fires, so revoke the blob URL here to
      // avoid leaking it for the lifetime of the document.
      try {
        await audio.play();
      } catch (playError) {
        URL.revokeObjectURL(blobUrl);
        throw playError;
      }
      return true;
    } catch (error) {
      log.error('Failed to play audio:', error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  public pause(): void {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  /**
   * Stop playback
   */
  public stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    // Note: onEndedCallback intentionally NOT cleared here because play()
    // calls stop() internally — clearing would break the callback chain.
    // Stale callbacks are harmless: engine mode check prevents processNext().
  }

  /**
   * Resume playback
   */
  public resume(): void {
    if (this.audio?.paused) {
      this.configurePlayback(this.audio);
      this.audio.play().catch((error) => {
        log.error('Failed to resume audio:', error);
      });
    }
  }

  /**
   * Get current playback status (actively playing, not paused)
   */
  public isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused;
  }

  /**
   * Whether there is active audio (playing or paused, but not ended)
   * Used to decide whether to resume playback or skip to the next line
   */
  public hasActiveAudio(): boolean {
    return this.audio !== null;
  }

  /**
   * Get current playback time (milliseconds)
   */
  public getCurrentTime(): number {
    return this.audio ? this.audio.currentTime * 1000 : 0;
  }

  /**
   * Get audio duration (milliseconds)
   */
  public getDuration(): number {
    return this.audio && !isNaN(this.audio.duration) ? this.audio.duration * 1000 : 0;
  }

  /**
   * Set playback ended callback
   */
  public onEnded(callback: () => void): void {
    this.onEndedCallback = callback;
  }

  /**
   * Set mute state (takes effect immediately on currently playing audio)
   */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.audio) {
      this.audio.volume = muted ? 0 : this.volume;
    }
  }

  /**
   * Set volume (0-1)
   */
  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio && !this.muted) {
      this.audio.volume = this.volume;
    }
  }

  /**
   * Set playback speed (takes effect immediately on currently playing audio)
   */
  public setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.5, Math.min(2, rate));
    if (this.audio) {
      this.configurePlayback(this.audio);
    }
  }

  /**
   * Destroy the player
   */
  public destroy(): void {
    this.stop();
    this.onEndedCallback = null;
  }
}

/**
 * Create an audio player instance
 */
export function createAudioPlayer(): AudioPlayer {
  return new AudioPlayer();
}
