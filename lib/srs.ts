/**
 * ============================================================================
 * SPACED REPETITION (SRS) — SIMPLIFIED SM-2
 * ============================================================================
 *
 * The scheduling core of Phase 6. Implements a trimmed-down SM-2 (the
 * algorithm Anki is based on) with three rating buttons: Again / Good / Easy.
 *
 * Pure functions only — no React, no storage. The review UI
 * (components/flashcards-view.tsx) calls them, and the orchestrator persists
 * the updated Flashcard objects back into the saved study set under the app's
 * existing localStorage key (capstone-study-sets). No parallel storage system:
 * the SRS fields live on the Flashcard itself (see types/notes.ts).
 *
 * Scheduling rules:
 * - Again: repetitions -> 0, intervalDays -> 1, easeFactor -0.2 (floor 1.3),
 *   missCount +1 (feeds the Weak Areas panel, Phase 6B)
 * - Good:  repetitions +1; intervals progress 1 -> 6 -> x easeFactor
 * - Easy:  same as Good, plus easeFactor +0.15 and a x1.3 interval bonus
 * - nextReviewAt is always lastReviewedAt + intervalDays, in ISO strings
 * ============================================================================
 */

import type { Flashcard } from "@/types/notes";

export type CardRating = "again" | "good" | "easy";

export const DEFAULT_EASE_FACTOR = 2.5;
export const MIN_EASE_FACTOR = 1.3;
/** How much each rating moves the ease factor (per the simplified SM-2). */
const AGAIN_EASE_PENALTY = 0.2;
const EASY_EASE_BONUS = 0.15;
/** Bonus interval multiplier applied to "Easy" ratings. */
const EASY_INTERVAL_BONUS = 1.3;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Deterministic id for a card: a 2x32-bit content hash of front+back. Cards get
 * the same id every time the same set is reopened, so SRS history survives
 * page reloads without storing anything extra. Collisions across cards are
 * practically impossible with real study content, and the deck is tiny.
 */
export function flashcardId(front: string, back: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const seed = `${front}\u0000${back}`;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `card-${(h2 >>> 0).toString(36)}-${(h1 >>> 0).toString(36)}`;
}

/**
 * The fully-initialized card shape: every SRS field is present and typed.
 * normalizeFlashcard returns this so the algorithm code never touches an
 * optional field again.
 */
export type NormalizedFlashcard = Flashcard & {
  cardId: string;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  missCount: number;
};

/**
 * Fill any missing SRS fields with their defaults so downstream code can rely
 * on the full shape. Safe on API-fresh cards and on sets saved before Phase 6.
 */
export function normalizeFlashcard(card: Flashcard): NormalizedFlashcard {
  return {
    ...card,
    cardId: card.cardId ?? flashcardId(card.front, card.back),
    easeFactor: card.easeFactor ?? DEFAULT_EASE_FACTOR,
    intervalDays: card.intervalDays ?? 0,
    repetitions: card.repetitions ?? 0,
    lastReviewedAt: card.lastReviewedAt ?? null,
    nextReviewAt: card.nextReviewAt ?? null,
    missCount: card.missCount ?? 0,
  };
}

/** A card is due when it was never reviewed (null) or its next review has passed. */
export function isCardDue(card: Flashcard, now: Date = new Date()): boolean {
  const nextReviewAt = normalizeFlashcard(card).nextReviewAt;
  // Cards with no next review date (never rated yet) are always due.
  if (nextReviewAt === null) return true;
  // An unparseable date (hand-crafted/old storage) would give NaN and make
  // the comparison false forever — treat it as due so the card is never
  // silently hidden from the study queue.
  const dueTime = new Date(nextReviewAt).getTime();
  return Number.isNaN(dueTime) || dueTime <= now.getTime();
}

/** How many cards in the deck are due right now — powers the "N due today" chip. */
export function countDueCards(cards: Flashcard[], now: Date = new Date()): number {
  return cards.filter((c) => isCardDue(c, now)).length;
}

/**
 * Apply one rating to a card and return the updated card. Pure — the caller
 * decides where to store the result (the orchestrator persists it to the saved
 * study set in localStorage).
 */
export function applyCardRating(card: Flashcard, rating: CardRating, now: Date = new Date()): Flashcard {
  const base = normalizeFlashcard(card);

  // Again — did not recall: back to the beginning, seen again tomorrow.
  // Also counts as a miss for weak-area tracking (Phase 6B).
  if (rating === "again") {
    return {
      ...base,
      easeFactor: Math.max(MIN_EASE_FACTOR, base.easeFactor - AGAIN_EASE_PENALTY),
      intervalDays: 1,
      repetitions: 0,
      missCount: base.missCount + 1,
      lastReviewedAt: now.toISOString(),
      nextReviewAt: addDays(now, 1).toISOString(),
    };
  }

  // Good / Easy — successful recall: the scheduling spine of SM-2.
  // First successful review = 1 day, second = 6 days, then interval x ease.
  const repeat = base.repetitions + 1;
  const rawInterval =
    repeat === 1 ? 1 : repeat === 2 ? 6 : Math.max(1, Math.round(base.intervalDays * base.easeFactor));
  const interval =
    rating === "easy" ? Math.max(1, Math.round(rawInterval * EASY_INTERVAL_BONUS)) : rawInterval;

  return {
    ...base,
    easeFactor: rating === "easy" ? base.easeFactor + EASY_EASE_BONUS : base.easeFactor,
    intervalDays: interval,
    repetitions: repeat,
    lastReviewedAt: now.toISOString(),
    nextReviewAt: addDays(now, interval).toISOString(),
  };
}