/**
 * ============================================================================
 * COMPONENT TESTS — components/input-top-bar.tsx
 * ============================================================================
 * The compact input-screen controls: streak chip + stats popover + recent
 * study sets popover. Asserts the old right-rail content still exists and
 * shows live data, but behind a slim top-bar treatment.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { InputTopBar } from "@/components/input-top-bar";
import { getLocalDateKey, EMPTY_STREAK } from "@/lib/streak";
import type { SavedStudySet } from "@/types/notes";

const SET: SavedStudySet = {
  id: "set-1",
  title: "Processes and threads",
  summary: "### Processes\n* A program in execution.",
  sourceNotes: "A process is a program in execution.",
  createdAt: Date.now(),
  language: "en",
  flashcards: [
    { front: "What is a process?", back: "A program in execution." },
  ],
  quiz: [
    {
      question: "What is a process?",
      options: ["A program in execution", "A file", "A CPU", "A thread"],
      correctIndex: 0,
      explanation: "Directly from the notes.",
    },
  ],
};

const STREAK = { ...EMPTY_STREAK, currentStreak: 3, longestStreak: 5, lastActiveDate: getLocalDateKey() };

function renderBar(overrides: Partial<React.ComponentProps<typeof InputTopBar>> = {}) {
  const handlers = {
    sets: [SET],
    streak: STREAK,
    onOpenSet: vi.fn(),
    onDeleteSet: vi.fn(),
    onImportSet: vi.fn(),
    onStartMixedPractice: vi.fn(),
  };
  return render(
    <InputTopBar
      {...handlers}
      {...overrides}
    />
  );
}

describe("InputTopBar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows the compact streak chip", () => {
    renderBar();
    expect(screen.getByText(/3 day streak/)).toBeInTheDocument();
  });

  it("hides the streak chip until the calendar state exists (pre-hydration)", () => {
    renderBar({ streak: null });
    expect(screen.queryByText(/day streak/i)).not.toBeInTheDocument();
  });

  it("opens the stats popover with the full, live stat grid", () => {
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: /your study stats/i }));

    const dialog = screen.getByRole("dialog", { name: /your study stats/i });
    expect(within(dialog).getByText("Study sets")).toBeInTheDocument();
    expect(within(dialog).getByText("Cards reviewed")).toBeInTheDocument();
    expect(within(dialog).getByText("Due today")).toBeInTheDocument();
    expect(within(dialog).getByText("Weak misses")).toBeInTheDocument();

    // Data stays live: counts derive from the sets prop at render time
    expect(within(dialog).getAllByText("1").length).toBeGreaterThan(0);
  });

  it("opens the recent study sets popover with the full search/delete/export list", () => {
    const onDeleteSet = vi.fn();
    renderBar({ onDeleteSet });
    fireEvent.click(screen.getByRole("button", { name: /recent study sets/i }));

    const dialog = screen.getByRole("dialog", { name: /recent study sets/i });
    expect(within(dialog).getByText("Processes and threads")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /delete study set/i }));
    expect(onDeleteSet).toHaveBeenCalledWith("set-1");
  });

  it("hides the recent-sets button when there is nothing to list", () => {
    renderBar({ sets: [] });
    expect(screen.queryByRole("button", { name: /recent study sets/i })).not.toBeInTheDocument();
  });

  it("closes an open popover on Escape and on backdrop click", async () => {
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: /your study stats/i }));
    expect(screen.getByRole("dialog", { name: /your study stats/i })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    // AnimatePresence exit outlives the close in jsdom — wait for it
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), {
      timeout: 2000,
    });

    fireEvent.click(screen.getByRole("button", { name: /your study stats/i }));
    const dialog = screen.getByRole("dialog", { name: /your study stats/i });
    // Backdrop is an invisible fixed button rendered before the panel
    fireEvent.click(
      (dialog.parentElement as HTMLElement).querySelector("button[aria-hidden='true']") as HTMLElement
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument(), {
      timeout: 2000,
    });
  });
});