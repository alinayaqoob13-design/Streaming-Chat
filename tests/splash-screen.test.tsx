/**
 * ============================================================================
 * COMPONENT TESTS — components/splash-screen.tsx
 * ============================================================================
 * SplashGate lifecycle (updated contract):
 *   - EVERY full page load (refresh / new tab) → splash plays, holds for the
 *     minimum duration, then fades out and reveals the app underneath
 *     without ever remounting it
 *   - in-app remount within the same loaded page → splash is skipped
 *     (module-scope flag resets only on a genuine page load)
 *   - no storage is touched at all (no sessionStorage/localStorage flag)
 *
 * Asserts on the DOM contract (role=status), not on animation frames.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { SplashGate, __resetSplashForTests } from "@/components/splash-screen";

// Matches the constants in the component — duplicates them deliberately so
// a timing change in the component fails loudly instead of passing quietly.
const MIN_VISIBLE_MS = 1600;
const FADE_MS = 450;

function renderApp() {
  return render(
    <SplashGate>
      <div>app content behind the splash</div>
    </SplashGate>
  );
}

describe("SplashGate", () => {
  beforeEach(() => {
    __resetSplashForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a full-screen branded splash on every page load", () => {
    renderApp();

    const splash = screen.getByRole("status");
    expect(within(splash).getByText("AI Study Notes Buddy")).toBeInTheDocument();
    expect(within(splash).getByText(/summary, flashcards/i)).toBeInTheDocument();

    // The app is mounted underneath (never destroyed) — it is just inert
    // while the overlay owns the screen.
    expect(screen.getByText("app content behind the splash")).toBeInTheDocument();
  });

  it("holds for the minimum duration, then fades and reveals the app", () => {
    renderApp();
    expect(screen.getByRole("status")).toBeInTheDocument();

    // The minimum hold has NOT passed yet — still splash.
    act(() => vi.advanceTimersByTime(MIN_VISIBLE_MS - 1));
    expect(screen.getByRole("status")).toBeInTheDocument();

    // The hold completes → fade begins…
    act(() => vi.advanceTimersByTime(1));
    // …and once the fade finishes the overlay unmounts, app fully interactive.
    act(() => vi.advanceTimersByTime(FADE_MS + 1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("app content behind the splash")).toBeInTheDocument();
  });

  it("does not replay on an in-app remount within the same loaded page", () => {
    const first = renderApp();
    act(() => vi.advanceTimersByTime(MIN_VISIBLE_MS + FADE_MS + 1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    first.unmount();

    // Same loaded page (module state intact) → straight into the app
    renderApp();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("app content behind the splash")).toBeInTheDocument();
  });

  it("plays again after a simulated fresh page load (module reset)", () => {
    renderApp();
    act(() => vi.advanceTimersByTime(MIN_VISIBLE_MS + FADE_MS + 1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    __resetSplashForTests(); // a real refresh reloads the module
    renderApp();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("writes nothing to sessionStorage or localStorage", () => {
    renderApp();
    act(() => vi.advanceTimersByTime(MIN_VISIBLE_MS + FADE_MS + 1));

    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it("renders a neutral startup frame — never the app — on first paint (SSR)", () => {
    // Regression guard for the flash bug: the server-rendered HTML (and the
    // very first client render) must contain NO app content and NO splash
    // overlay, only the opaque neutral frame. The app appears only after the
    // page-load check resolves.
    const html = renderToStaticMarkup(
      <SplashGate>
        <div>app content behind the splash</div>
      </SplashGate>
    );

    expect(html).not.toContain("app content behind the splash");
    expect(html).toContain("bg-background");
    expect(html).not.toContain("AI Study Notes Buddy is loading");
  });
});
