/**
 * ============================================================================
 * VIEW TRANSITIONS — CROSSFADE BETWEEN SCREENS
 * ============================================================================
 *
 * Thin wrapper around the View Transition API (Chrome/Edge; Safari 18+).
 * NotesBuddy's input screen and result screen are two very different
 * layouts, so the switch benefits from a soft crossfade + rise instead of a
 * hard snap. Everything degrades gracefully:
 *
 *   - Browsers without startViewTransition: the callback just runs directly
 *   - prefers-reduced-motion: reduce: same — instant, no animation
 *
 * The CSS lives in globals.css under ::view-transition-old/new(root).
 * ============================================================================
 */

/**
 * Run `fn` inside a view transition when the browser supports it AND the
 * user hasn't asked for reduced motion. `fn` must contain ALL state updates
 * that repaint the screen — React 18 batches them, so the transition
 * snapshot captures the switch as one continuous frame.
 *
 * If the transition itself fails (the API can reject when the snapshot
 * commit throws), `fn` still runs as a plain update — the UI must never be
 * left on the old screen with new state half-applied.
 */
export function withViewTransition(fn: () => void): void {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => void | Promise<void>;
  };
  if (
    !doc.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    fn();
    return;
  }
  try {
    // Promise.resolve() keeps older implementations that return nothing safe.
    void Promise.resolve(doc.startViewTransition(fn)).catch(() => fn());
  } catch {
    // Synchronous throw from an old polyfill — fall back to a plain update.
    fn();
  }
}