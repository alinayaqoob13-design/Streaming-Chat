/**
 * ============================================================================
 * UNIT TESTS — lib/srs.ts (simplified SM-2)
 * ============================================================================
 * Covers the pure scheduling core of Phase 6: deterministic card ids, default
 * normalization, the Again/Good/Easy rescheduling rules, and due-date logic.
 * ============================================================================
 */

import { describe, it, expect } from "vitest";
import {
  flashcardId,
  normalizeFlashcard,
  applyCardRating,
  isCardDue,
  countDueCards,
  DEFAULT_EASE_FACTOR,
  MIN_EASE_FACTOR,
} from "@/lib/srs";
import type { Flashcard } from "@/types/notes";

const NOW = new Date("2026-08-10T12:00:00.000Z");

function dayFrom(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const BARE: Flashcard = { front: "What is a thread?", back: "A lightweight unit of execution." };

describe("flashcardId", () => {
  it("is deterministic for identical cards", () => {
    expect(flashcardId(BARE.front, BARE.back)).toBe(flashcardId(BARE.front, BARE.back));
  });

  it("differs between different cards", () => {
    expect(flashcardId("a", "b")).not.toBe(flashcardId("a", "c"));
  });
});

describe("normalizeFlashcard", () => {
  it("fills every SRS field with defaults on a bare card", () => {
    const n = normalizeFlashcard(BARE);
    expect(n.cardId).toBe(flashcardId(BARE.front, BARE.back));
    expect(n.easeFactor).toBe(DEFAULT_EASE_FACTOR);
    expect(n.intervalDays).toBe(0);
    expect(n.repetitions).toBe(0);
    expect(n.lastReviewedAt).toBeNull();
    expect(n.nextReviewAt).toBeNull();
    expect(n.missCount).toBe(0);
  });

  it("keeps existing SRS values intact", () => {
    const n = normalizeFlashcard({ ...BARE, easeFactor: 1.8, repetitions: 3, intervalDays: 9, missCount: 4 });
    expect(n.easeFactor).toBe(1.8);
    expect(n.repetitions).toBe(3);
    expect(n.intervalDays).toBe(9);
    expect(n.missCount).toBe(4);
  });
});

describe("applyCardRating — Again", () => {
  it("resets repetitions to 0 and schedules tomorrow", () => {
    const out = applyCardRating({ ...BARE, repetitions: 4, intervalDays: 20 }, "again", NOW);
    expect(out.repetitions).toBe(0);
    expect(out.intervalDays).toBe(1);
    expect(out.nextReviewAt).toBe(dayFrom(NOW, 1));
    expect(out.lastReviewedAt).toBe(NOW.toISOString());
  });

  it("decreases easeFactor slightly but never below 1.3", () => {
    expect(applyCardRating(BARE, "again", NOW).easeFactor).toBeCloseTo(2.3);
    expect(applyCardRating({ ...BARE, easeFactor: 1.3 }, "again", NOW).easeFactor).toBe(MIN_EASE_FACTOR);
  });

  it("counts every Again rating as a miss, cumulatively", () => {
    const once = applyCardRating(BARE, "again", NOW);
    expect(once.missCount).toBe(1);
    const twice = applyCardRating(once, "again", NOW);
    expect(twice.missCount).toBe(2);
  });
});

describe("applyCardRating — Good interval growth (1 → 6 → x ease)", () => {
  it("first successful review schedules 1 day", () => {
    const out = applyCardRating(BARE, "good", NOW);
    expect(out.repetitions).toBe(1);
    expect(out.intervalDays).toBe(1);
    expect(out.nextReviewAt).toBe(dayFrom(NOW, 1));
  });

  it("second successful review schedules 6 days", () => {
    const once = applyCardRating(BARE, "good", NOW);
    const out = applyCardRating(once, "good", NOW);
    expect(out.repetitions).toBe(2);
    expect(out.intervalDays).toBe(6);
  });

  it("third review multiplies by easeFactor and keeps ease roughly the same", () => {
    const twice = applyCardRating(applyCardRating(BARE, "good", NOW), "good", NOW);
    const out = applyCardRating(twice, "good", NOW);
    expect(out.repetitions).toBe(3);
    expect(out.intervalDays).toBe(6 * DEFAULT_EASE_FACTOR); // 15
    expect(out.easeFactor).toBe(DEFAULT_EASE_FACTOR); // unchanged
  });
});

describe("applyCardRating — Easy", () => {
  it("boosts easeFactor and applies the 1.3x interval bonus", () => {
    const once = applyCardRating(BARE, "good", NOW); // intervalDays: 1
    const out = applyCardRating(once, "easy", NOW);
    expect(out.easeFactor).toBeCloseTo(DEFAULT_EASE_FACTOR + 0.15);
    expect(out.intervalDays).toBe(Math.round(6 * 1.3)); // 8 vs Good's 6
    expect(out.nextReviewAt).toBe(dayFrom(NOW, 8));
  });
});

describe("due logic", () => {
  it("a never-reviewed card is due", () => {
    expect(isCardDue(BARE, NOW)).toBe(true);
  });

  it("a card scheduled in the past is due, one in the future is not", () => {
    expect(isCardDue({ ...BARE, nextReviewAt: dayFrom(NOW, -1) }, NOW)).toBe(true);
    expect(isCardDue({ ...BARE, nextReviewAt: dayFrom(NOW, 3) }, NOW)).toBe(false);
  });

  it("countDueCards tallies only the due cards", () => {
    const cards: Flashcard[] = [
      BARE,
      { ...BARE, front: "older due", nextReviewAt: dayFrom(NOW, -2) },
      { ...BARE, front: "not due yet", nextReviewAt: dayFrom(NOW, 5) },
    ];
    expect(countDueCards(cards, NOW)).toBe(2);
  });
});

describe("applyCardRating purity", () => {
  it("never mutates the input card", () => {
    const input: Flashcard = { ...BARE };
    const snapshot = JSON.parse(JSON.stringify(input));
    applyCardRating(input, "easy", NOW);
    expect(input).toEqual(snapshot);
  });
});