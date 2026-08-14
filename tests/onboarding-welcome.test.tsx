/**
 * ============================================================================
 * COMPONENT TESTS — components/onboarding-welcome.tsx
 * ============================================================================
 * OnboardingGate lifecycle:
 *   - first EVER visit (no capstone-onboarding-done in localStorage) → the
 *     welcome dialog opens over the app, which stays mounted underneath
 *   - Next/Back walk the three slides; the final step says "Start studying"
 *   - Skip (any step), Start studying, and Escape all record the flag BEFORE
 *     the exit fade, then remove the dialog
 *   - any later visit (flag set) → the dialog never opens
 *   - the flag lives in localStorage ONLY — sessionStorage is untouched
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, within } from "@testing-library/react";
import { OnboardingGate } from "@/components/onboarding-welcome";

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
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("opens the welcome dialog on the first ever visit", () => {
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

    // The flag is written BEFORE the exit fade…
    fireEvent.click(within(dialog()).getByRole("button", { name: "Start studying" }));
    expect(localStorage.getItem("capstone-onboarding-done")).toBe("true");

    // …and the dialog is gone after the fade, app fully interactive.
    act(() => vi.advanceTimersByTime(EXIT_MS + 1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("app content behind the welcome")).toBeInTheDocument();
  });

  it("Skip dismisses from any step and never returns", () => {
    const first = renderApp();
    const dialog = first.getByRole("dialog");

    fireEvent.click(within(dialog).getByRole("button", { name: "Skip" }));
    expect(localStorage.getItem("capstone-onboarding-done")).toBe("true");

    act(() => vi.advanceTimersByTime(EXIT_MS + 1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();

    // A fresh mount with the flag set → no dialog, straight into the app.
    renderApp();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("app content behind the welcome")).toBeInTheDocument();
  });

  it("Escape dismisses the welcome from any step", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(localStorage.getItem("capstone-onboarding-done")).toBe("true");

    act(() => vi.advanceTimersByTime(EXIT_MS + 1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("only ever touches localStorage — sessionStorage is never written", () => {
    renderApp();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    act(() => vi.advanceTimersByTime(EXIT_MS + 1));

    expect(localStorage.getItem("capstone-onboarding-done")).toBe("true");
    expect(sessionStorage.getItem("capstone-onboarding-done")).toBeNull();
  });
});