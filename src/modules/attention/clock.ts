/**
 * The only platform-touching timing code in the attention module
 * (SPEC.md §3). Deliberately *not* in /src/engine: it reads `performance.now`
 * and `requestAnimationFrame`, which the engine rule forbids and which cannot
 * be exercised under plain Vitest/Node anyway. Everything it produces is a
 * plain number that the engine's pure functions consume.
 */

/**
 * Monotonic milliseconds. `performance.now()` where it exists (it is monotonic
 * and unaffected by clock adjustments); `Date.now()` otherwise, which is
 * neither, hence `hasHighResolutionClock()` below feeding the reported
 * uncertainty band.
 */
export function nowMs(): number {
  const perf = globalThis.performance;
  return typeof perf?.now === 'function' ? perf.now() : Date.now();
}

/** False when the run fell back to Date.now(); reported, never silently assumed. */
export function hasHighResolutionClock(): boolean {
  return typeof globalThis.performance?.now === 'function';
}

/**
 * Read the clock on the frame that paints the pending update, and hand back a
 * canceller.
 *
 * Call this from a post-commit effect, never from the event handler that set
 * the state: requestAnimationFrame callbacks run at the *start* of a frame, so
 * scheduling one before React has committed would time the frame before the
 * stimulus, not the frame showing it.
 *
 * The timestamp is the start of the painting frame; photons follow up to one
 * refresh interval later. That residual is carried in `rtUncertaintyMs`
 * (engine/attention/latency.ts) rather than corrected for, because it is not
 * observable from here.
 */
export function onNextPaint(callback: (paintedMs: number) => void): () => void {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    // No frame callback available (some non-browser hosts): fall back to a
    // macrotask. Less accurate, and the drift it causes shows up in the
    // measured profile rather than being hidden.
    const id = setTimeout(() => callback(nowMs()), 0);
    return () => clearTimeout(id);
  }
  const handle = globalThis.requestAnimationFrame(() => callback(nowMs()));
  return () => globalThis.cancelAnimationFrame?.(handle);
}
