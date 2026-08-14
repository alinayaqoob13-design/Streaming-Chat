/**
 * ============================================================================
 * COMPONENT TESTS — components/splash-screen.tsx
 * ============================================================================
 * SplashGate lifecycle:
 *   - fresh session (no hasSeenSplash in sessionStorage) → splash shows,
 *     holds for the minimum duration, records the flag, then fades out and
 *     reveals the app underneath without ever remounting it
 *   - same-session reload (flag already set) → splash is skipped
 *   - splash state lives in sessionStorage ONLY — localStorage is untouched
 *
 * Asserts on the sessionStorage contract + DOM presence (role=status), not
 * on animation frames — same approach as the rest of the suite.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { SplashGate } from "@/components/splash-screen";

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
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it("shows a full-screen branded splash on a fresh session", () => {
    renderApp();

    const splash = screen.getByRole("status");
    expect(within(splash).getByText("AI Study Notes Buddy")).toBeInTheDocument();
    expect(within(splash).getByText(/summary, flashcards/i)).toBeInTheDocument();

    // The app is mounted underneath (never destroyed) — it is just inert
    // while the overlay owns the screen.
    expect(screen.getByText("app content behind the splash")).toBeInTheDocument();
  });

  it("records hasSeenSplash after the minimum duration and then reveals the app", () => {
    renderApp();
    expect(screen.getByRole("status")).toBeInTheDocument();

    // The minimum hold has NOT passed yet — still splash.
    act(() => vi.advanceTimersByTime(MIN_VISIBLE_MS - 1));
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(sessionStorage.getItem("hasSeenSplash")).toBeNull();

    // The hold completes → flag written BEFORE the fade (a reload mid-fade
    // must not replay the splash)…
    act(() => vi.advanceTimersByTime(1));
    expect(sessionStorage.getItem("hasSeenSplash")).toBe("true");

    // …and the fade finishes → overlay unmounts, app fully interactive.
    act(() => vi.advanceTimersByTime(FADE_MS + 1));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("app content behind the splash")).toBeInTheDocument();
  });

  it("skips the splash entirely when this session already saw it", () => {
    sessionStorage.setItem("hasSeenSplash", "true");
    renderApp();

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("app content behind the splash")).toBeInTheDocument();
  });

  it("only ever touches sessionStorage — localStorage is never written", () => {
    renderApp();
    act(() => vi.advanceTimersByTime(MIN_VISIBLE_MS + FADE_MS + 1));

    expect(sessionStorage.getItem("hasSeenSplash")).toBe("true");
    expect(localStorage.getItem("hasSeenSplash")).toBeNull();
  });

  it("renders a neutral startup frame — never the app — on first paint (SSR)", () => {
    // Regression guard for the flash bug: the server-rendered HTML (and the
    // very first client render) must contain NO app content and NO splash
    // overlay, only the opaque neutral frame. The app appears only after the
    // sessionStorage check resolves.
    const html = renderToStaticMarkup(
      <SplashGate>
        <div>app content behind the splash</div>
      </SplashGate>
    );

    expect(html).not.toContain("app content behind the splash");
    expect(html).toContain("bg-background");
    expect(html).not.toContain("AI Study Notes Buddy is loading");
  });

  it("resolves into the app on a same-session reload without any splash flash", () => {
    sessionStorage.setItem("hasSeenSplash", "true");
    renderApp();

    // Never any splash overlay, app straight away — and the neutral frame is
    // gone the moment the effect resolves.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("app content behind the splash")).toBeInTheDocument();
  });
});