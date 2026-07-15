/**
 * Playback Types - Types for lecture playback and live discussion engine
 */

import type { PlaybackSnapshot } from '@/lib/utils/playback-storage';

export type { PlaybackSnapshot };

/** Visual effects (for onEffectFire callback) */
export type Effect =
  | { kind: 'spotlight'; targetId: string; dimOpacity?: number }
  | { kind: 'laser'; targetId: string; color?: string };

/** Engine mode state machine */
export type EngineMode = 'idle' | 'playing' | 'paused' | 'live';

/** Discussion topic state */
export type TopicState = 'active' | 'pending' | 'closed';

export type PlaybackCursorPhase = 'idle' | 'playing' | 'paused' | 'discussion' | 'completed';

export type PlaybackCursorReason =
  | 'play'
  | 'pause'
  | 'resume'
  | 'scene-change'
  | 'action-start'
  | 'discussion-start'
  | 'discussion-end'
  | 'rate-change'
  | 'complete'
  | 'stop';

/** Stable playback contract consumed by later scheduling features such as danmaku. */
export interface PlaybackCursorSnapshot {
  /** PostgreSQL enterprise course ID. Null identifies local/preview playback. */
  courseId: string | null;
  sceneKey: string | null;
  sceneIndex: number;
  actionId: string | null;
  actionIndex: number;
  /** Playback-time offset, frozen while paused or in discussion and adjusted by playback rate. */
  actionOffsetMs: number;
  phase: PlaybackCursorPhase;
  playbackRate: number;
  emittedAt: number;
}

export interface PlaybackCursorEvent {
  reason: PlaybackCursorReason;
  cursor: PlaybackCursorSnapshot;
}

/** Trigger event (for proactive discussion card) */
export interface TriggerEvent {
  id: string;
  question: string;
  prompt?: string;
  agentId?: string;
}

/** Playback engine callbacks */
export interface PlaybackEngineCallbacks {
  onModeChange?: (mode: EngineMode) => void;
  onSceneChange?: (sceneId: string) => void;
  onSpeechStart?: (text: string) => void;
  onSpeechEnd?: () => void;
  onTextDelta?: (content: string) => void;
  onSpeakerChange?: (role: string) => void;
  onEffectFire?: (effect: Effect) => void;

  // Proactive discussion
  onProactiveShow?: (trigger: TriggerEvent) => void;
  onProactiveHide?: () => void;

  // Discussion lifecycle
  onDiscussionConfirmed?: (topic: string, prompt?: string, agentId?: string) => void;
  onDiscussionEnd?: () => void;
  onUserInterrupt?: (text: string) => void;

  // Topic / Transcript
  onTopicStart?: (type: 'lecture' | 'discussion', title: string) => void;
  onTopicAppend?: (role: string, text: string) => void;
  onTopicEnd?: () => void;

  // Progress tracking (for persistence)
  onProgress?: (snapshot: PlaybackSnapshot) => void;

  /** Check if a given agent is in the user's selected list (for skipping discussion actions) */
  isAgentSelected?: (agentId: string) => boolean;

  /** Get current playback speed multiplier (e.g. 1, 1.5, 2) */
  getPlaybackSpeed?: () => number;

  /** PLAY-01 cursor contract. This does not schedule or render danmaku. */
  onPlaybackCursor?: (event: PlaybackCursorEvent) => void;

  onComplete?: () => void;
}

export interface PlaybackEngineOptions {
  courseId?: string | null;
  /** Global course scene index when an engine instance owns only a scene slice. */
  sceneIndexBase?: number;
  now?: () => number;
}
