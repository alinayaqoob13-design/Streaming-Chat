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
 * The returned ViewTransition's .ready/.finished/.updateCallbackDone
 * promises REJECT with "Transition was aborted because of invalid state"
 * whenever a transition is skipped (rapid back-to-back calls, hidden tab).
 * Unhandled, those rejections surface as runtime errors (Next.js dev
 * overlay). We attach no-op catchers — an aborted transition only loses its
 * animation; the state from `fn` is already applied.
 */
export function withViewTransition(fn: () => void): void {
  const doc = document as Document & {
    startViewTransition?: (callback: () => void) => {
      updateCallbackDone?: Promise<unknown>;
      ready?: Promise<unknown>;
      finished?: Promise<unknown>;
    };
  };
  if (
    !doc.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    fn();
    return;
  }
  try {
    const vt = doc.startViewTransition(fn);
    vt.updateCallbackDone?.catch(() => {});
    vt.ready?.catch(() => {});
    vt.finished?.catch(() => {});
  } catch {
    // Synchronous throw from an old polyfill — fall back to a plain update.
    fn();
  }
}