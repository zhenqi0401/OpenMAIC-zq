/**
 * Feature flags. Public flags come from `NEXT_PUBLIC_*` env vars, which
 * Next.js inlines at build time so they are safe to read from client
 * components. Server-only flags must not use the `NEXT_PUBLIC_` prefix.
 *
 * Truthy values: `'true'` or `'1'`. Anything else (including unset) is
 * treated as disabled.
 */

function readBoolean(envValue: string | undefined): boolean {
  return envValue === 'true' || envValue === '1';
}

/**
 * Course popularity gate. Default ON because start tracking is a backwards-
 * compatible fact write; deployments can explicitly disable the module with
 * `false` or `0` without affecting ordinary course playback.
 */
export function isCoursePopularityEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_COURSE_POPULARITY_ENABLED;
  return value === undefined || (value !== 'false' && value !== '0');
}

/** Historical danmaku gate. Default ON; deployments can disable it independently. */
export function isDanmakuEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_DANMAKU_ENABLED;
  return value === undefined || (value !== 'false' && value !== '0');
}

/** Forum gate. Default ON; deployments can disable it independently. */
export function isForumEnabled(): boolean {
  const value = process.env.NEXT_PUBLIC_FORUM_ENABLED;
  return value === undefined || (value !== 'false' && value !== '0');
}

/**
 * MAIC Editor (Pro mode) gate. Default OFF — gates only the Pro toggle
 * affordance in `Header`. The `StageMode` type union is unaffected so
 * existing code paths typecheck identically with the flag in either
 * state.
 */
export function isMaicEditorEnabled(): boolean {
  return readBoolean(process.env.NEXT_PUBLIC_MAIC_EDITOR_ENABLED);
}

/**
 * Server-authoritative gate for the vocational task-engine generation path.
 * Default OFF. When disabled, requests that include taskEngineMode must
 * silently fall back to the ordinary standard / interactive generation paths.
 */
export function isVocationalTaskEngineEnabled(): boolean {
  return readBoolean(process.env.OPENMAIC_ENABLE_VOCATIONAL);
}

export function resolveVocationalActive(
  requirements?: { taskEngineMode?: boolean } | null,
): boolean {
  return Boolean(requirements?.taskEngineMode) && isVocationalTaskEngineEnabled();
}

/**
 * Optional client-only affordance for exposing the experimental vocational
 * test toggle. This is not a security or routing gate.
 */
export function shouldShowVocationalTestUi(): boolean {
  return readBoolean(process.env.NEXT_PUBLIC_SHOW_VOCATIONAL_TEST_UI);
}
