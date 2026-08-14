/**
 * ============================================================================
 * VIEW TRANSITION HELPER — lib/view-transition.ts
 * ============================================================================
 * The runtime error "Transition was aborted because of invalid state" came
 * from the ViewTransition object's rejecting .ready/.finished promises.
 * These tests pin the swallow-and-fallback behavior.
 * ============================================================================
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { withViewTransition } from "@/lib/view-transition";

interface FakeViewTransition {
  updateCallbackDone?: Promise<unknown>;
  ready?: Promise<unknown>;
  finished?: Promise<unknown>;
}

// The DOM lib ships its own non-optional startViewTransition typing, so go
// through a deliberately loose slot to install/remove our mock.
function setStartViewTransition(impl: ((cb: () => void) => FakeViewTransition) | undefined) {
  const slot = document as unknown as { startViewTransition?: unknown };
  if (impl === undefined) delete slot.startViewTransition;
  else slot.startViewTransition = impl;
}

afterEach(() => {
  setStartViewTransition(undefined);
  vi.unstubAllGlobals();
});

describe("withViewTransition", () => {
  it("runs the callback directly when the API is missing (jsdom/older browsers)", () => {
    const fn = vi.fn();
    withViewTransition(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("swallows aborted-transition rejections and never re-runs the callback", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const fn = vi.fn();
    setStartViewTransition((cb) => {
      cb(); // the real API invokes the callback synchronously to capture state
      return {
        updateCallbackDone: Promise.reject(new Error("Transition was aborted because of invalid state")),
        ready: Promise.reject(new Error("Transition was aborted because of invalid state")),
        finished: Promise.reject(new Error("Transition was aborted because of invalid state")),
      };
    });

    withViewTransition(fn);
    // Let the microtask queue flush — the no-op catchers must absorb the
    // rejections (an unhandled rejection would fail the test run)
    await new Promise((r) => setTimeout(r, 0));

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("falls back to a direct run when startViewTransition throws synchronously", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const fn = vi.fn();
    setStartViewTransition(() => {
      throw new Error("not allowed");
    });
    withViewTransition(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
