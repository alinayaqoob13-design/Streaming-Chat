/**
 * ============================================================================
 * UNIT TESTS — lib/weak-areas.ts
 * ============================================================================
 * The Weak Areas aggregation: threshold filtering, flashcard + quiz-miss
 * merging, and most-missed-first sorting (stable ties, source order).
 * ============================================================================
 */

import { describe, it, expect } from "vitest";
import { collectWeakAreas, WEAK_AREA_THRESHOLD } from "@/lib/weak-areas";
import type { StudyNotes } from "@/types/notes";

const SET: StudyNotes = {
  summary: "x",
  flashcards: [
    { front: "Card A", back: "a", missCount: 3 },
    { front: "Card B", back: "b" }, // no misses recorded
    { front: "Card C", back: "c", missCount: 2 },
    { front: "Card D", back: "d", missCount: 1 }, // below threshold
  ],
  quiz: [
    { question: "Q1", options: ["a", "b", "c", "d"], correctIndex: 0, explanation: "", missCount: 5 },
    { question: "Q2", options: ["a", "b", "c", "d"], correctIndex: 0, explanation: "" },
  ],
};

describe("collectWeakAreas", () => {
  it("keeps only items with missCount >= threshold", () => {
    const items = collectWeakAreas(SET);
    const missCounts = items.map((i) => i.missCount);
    expect(missCounts.every((m) => m >= WEAK_AREA_THRESHOLD)).toBe(true);
    expect(items.map((i) => i.title)).not.toContain("Card D");
  });

  it("sorts by most misses first, across both kinds", () => {
    const items = collectWeakAreas(SET);
    expect(items.map((i) => i.title)).toEqual(["Q1", "Card A", "Card C"]);
  });

  it("marks the correct kind and index for jump targets", () => {
    const items = collectWeakAreas(SET);
    const card = items.find((i) => i.title === "Card A");
    expect(card).toMatchObject({ kind: "flashcard", index: 0, missCount: 3 });
    const q = items.find((i) => i.title === "Q1");
    expect(q).toMatchObject({ kind: "quiz-question", index: 0, missCount: 5 });
  });

  it("carries the flashcard back as subtitle but not subtitle for quiz items", () => {
    const items = collectWeakAreas(SET);
    expect(items.find((i) => i.title === "Card A")?.subtitle).toBe("a");
    expect(items.find((i) => i.title === "Q1")?.subtitle).toBeUndefined();
  });

  it("returns an empty list when nothing qualifies", () => {
    const clean: StudyNotes = {
      summary: "x",
      flashcards: [{ front: "ok", back: "fine", missCount: 1 }],
      quiz: [],
    };
    expect(collectWeakAreas(clean)).toEqual([]);
  });
});