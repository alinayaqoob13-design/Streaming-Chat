/**
 * ============================================================================
 * COMPONENT TESTS — components/onboarding-welcome.tsx
 * ============================================================================
 * OnboardingGate lifecycle (updated contract):
 *   - EVERY full page load (refresh / new tab) → the welcome dialog opens
 *     over the app, which stays mounted underneath
 *   - Next/Back walk the three slides; the final step says "Start studying"
 *   - Skip (any step), Start studying, and Escape all mark the page-load flag
 *     BEFORE the exit fade, then remove the dialog
 *   - in-app remount within the same loaded page → the dialog never re-opens
 *   - no storage is used at all
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, within } from "@testing-library/react";
import { OnboardingGate, __resetOnboardingForTests } from "@/components/onboarding-welcome";

// Matches the constant in the component — duplicates it deliberately so a
// timing change fails loudly instead of passing quietly.
const EXIT_MS = 220;

function renderApp() {
  return render(
    <OnboardingGate>
      <div>app content behind the welcome</div>
    </OnboardingGate>
  );
}

describe("OnboardingGate", () => {
  beforeEach(() => {
    __resetOnboardingForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens the welcome dialog on every page load", () => {
    renderApp();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Welcome")).toBeInTheDocument();
    expect(within(dialog).getByText("Paste & generate")).toBeInTheDocument();
    expect(within(dialog).getByText(/paste lecture notes/i)).toBeInTheDocument();

    // The app is mounted underneath — it is just inert while the dialog
    // owns the screen.
    expect(screen.getByText("app content behind the welcome")).toBeInTheDocument();
  });

  it("walks the slides with Next/Back and finishes with Start studying", () => {
    renderApp();
    const dialog = () => screen.getByRole("dialog");

    // Slide swaps mount the new slide immediately (enter-only motion — no
    // exit phase to wait for), so clicks resolve synchronously.
    fireEvent.click(within(dialog()).getByRole("button", { name: "Next" }));
    expect(within(dialog()).getByText("Study the smart way")).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Back" })).toBeInTheDocument();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Back" }));
    expect(within(dialog()).getByText("Paste & generate")).toBeInTheDocument();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Next" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Next" }));
    expect(within(dialog()).getByText("Track & chat")).toBeInTheDocument();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Start studying" }));

    // The dialog is gone after the fade, app fully interactive.
    act(() => vi.advanceTimersByTime(EXIT_MS + 1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("app content behind the welcome")).toBeInTheDocument();
  });

  it("Skip dismisses and does not re-open on an in-app remount", () => {
    const first = renderApp();
    fireEvent.click(within(first.getByRole("dialog")).getByRole("button", { name: "Skip" }));

    act(() => vi.advanceTimersByTime(EXIT_MS + 1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    // Same loaded page → no dialog, straight into the app.
    renderApp();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("app content behind the welcome")).toBeInTheDocument();
  });

  it("shows again after a simulated fresh page load (module reset)", () => {
    const first = renderApp();
    fireEvent.click(within(first.getByRole("dialog")).getByRole("button", { name: "Skip" }));
    act(() => vi.advanceTimersByTime(EXIT_MS + 1));
    first.unmount();

    __resetOnboardingForTests(); // a real refresh reloads the module
    renderApp();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("Escape dismisses the welcome from any step", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.keyDown(document, { key: "Escape" });

    act(() => vi.advanceTimersByTime(EXIT_MS + 1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("writes nothing to any storage", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    act(() => vi.advanceTimersByTime(EXIT_MS + 1));

    expect(localStorage.getItem("capstone-onboarding-done")).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });
});
