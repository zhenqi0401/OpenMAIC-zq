/** Per-model-call controls for the outline SSE pipeline. */
export const OUTLINE_ATTEMPT_TIMEOUT_MS = 300_000;

export function createOutlineAttemptSignal(parent: AbortSignal | undefined) {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error('ATTEMPT_TIMEOUT'));
  }, OUTLINE_ATTEMPT_TIMEOUT_MS);
  const abortFromParent = () => controller.abort(parent?.reason);
  parent?.addEventListener('abort', abortFromParent, { once: true });

  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      parent?.removeEventListener('abort', abortFromParent);
    },
  };
}
