/**
 * ============================================================================
 * COMPONENT TESTS — components/stats-view.tsx
 * ============================================================================
 * The stats tile is pure local derivation over saved sets: it must sum the
 * right things (SRS-reviewed cards, due load, weak-area misses) and never
 * touch the network or localStorage itself.
 * ============================================================================
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StatsView } from "@/components/stats-view";
import type { SavedStudySet } from "@/types/notes";

const BASE_SET: SavedStudySet = {
  id: "s1",
  title: "OS — Lecture 7",
  sourceNotes: "…",
  createdAt: 1,
  language: "en",
  summary: "## Summary\n…",
  flashcards: [
    // Reviewed once, no misses, not due (future review)
    { front: "process", back: "a program in execution", lastReviewedAt: "2026-07-01", nextReviewAt: "2030-01-01", intervalDays: 30 },
    // Reviewed, 2 again-misses, due now (no nextReviewAt)
    { front: "thread", back: "lightweight", lastReviewedAt: "2026-07-02", missCount: 2 },
    // Never reviewed → due now but not "reviewed"
    { front: "PCB", back: "process control block" },
  ],
  quiz: [
    {
      question: "Q1",
      options: ["a", "b", "c", "d"],
      correctIndex: 0,
      explanation: "…",
      missCount: 3,
    },
    { question: "Q2", options: ["a", "b", "c", "d"], correctIndex: 1, explanation: "…" },
  ],
};

describe("StatsView", () => {
  // Each stat renders as dt (label) + dd (value) inside a shared wrapper div.
  function row(label: string): string | null {
    return screen.getByText(label).closest("div")!.querySelector("dd")!.textContent;
  }

  it("shows zeroes when there are no saved sets", () => {
    render(<StatsView sets={[]} />);
    expect(screen.getByText("Your study stats")).toBeInTheDocument();
    expect(row("Study sets")).toBe("0");
    expect(row("Cards reviewed")).toBe("0");
    expect(row("Due today")).toBe("0");
    expect(row("Weak misses")).toBe("0");
  });

  it("derives counts from the saved sets: sets, reviewed cards, due load, misses", () => {
    render(<StatsView sets={[BASE_SET]} />);

    expect(row("Study sets")).toBe("1");
    expect(row("Cards reviewed")).toBe("2"); // 2 of 3 have lastReviewedAt
    expect(row("Due today")).toBe("2"); // thread + PCB have no future review
    expect(row("Weak misses")).toBe("5"); // 2 card misses + 3 quiz misses
  });

  it("sums across multiple sets", () => {
    render(<StatsView sets={[BASE_SET, { ...BASE_SET, id: "s2" }]} />);

    expect(row("Study sets")).toBe("2");
    expect(row("Cards reviewed")).toBe("4");
    expect(row("Due today")).toBe("4");
    expect(row("Weak misses")).toBe("10");
  });

  it("shows a Mixed practice link when there are quiz questions and a handler is given", () => {
    const handler = vi.fn();
    render(<StatsView sets={[BASE_SET]} onStartMixedPractice={handler} />);

    fireEvent.click(screen.getByRole("button", { name: /mixed practice/i }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("hides the Mixed practice link when there are no quiz questions", () => {
    render(<StatsView sets={[{ ...BASE_SET, quiz: [] }]} onStartMixedPractice={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /mixed practice/i })).not.toBeInTheDocument();
  });
});