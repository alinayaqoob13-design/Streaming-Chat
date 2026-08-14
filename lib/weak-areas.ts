/**
 * ============================================================================
 * WEAK AREAS — AGGREGATION (PHASE 6B)
 * ============================================================================
 *
 * Collects the items the student keeps missing — flashcards rated "Again" in
 * the SRS study mode and quiz questions answered wrong — into one sorted list
 * for the Weak Areas tab (components/weak-areas-view.tsx).
 *
 * Pure and read-only: it only reads missCount off the artifacts already in
 * memory. No storage writes and no AI/API calls happen here.
 *
 * Items are grouped by the item itself (front/question text), not by an
 * abstract topic, because artifacts have no topic field — inferring topics
 * with new model calls is explicitly out of scope.
 * ============================================================================
 */

import type { StudyNotes } from "@/types/notes";

/** A card/question only shows up as weak once missed this many times. */
export const WEAK_AREA_THRESHOLD = 2;

export interface WeakAreaItem {
  kind: "flashcard" | "quiz-question";
  /** Index into the source array (flashcards / quiz) — used to jump to it. */
  index: number;
  /** Caller-facing text: the flashcard front or the quiz question. */
  title: string;
  /** Secondary context: the flashcard back (quiz items have none). */
  subtitle?: string;
  missCount: number;
}

function missCountOf(count: number | undefined): number {
  return count ?? 0;
}

/**
 * Returns every item with missCount >= WEAK_AREA_THRESHOLD, sorted by most
 * misses first. Ties keep their source order (flashcards before quiz, then
 * original index) because Array.prototype.sort is stable.
 */
export function collectWeakAreas(notes: StudyNotes): WeakAreaItem[] {
  const items: WeakAreaItem[] = [];

  notes.flashcards.forEach((card, i) => {
    const missCount = missCountOf(card.missCount);
    if (missCount >= WEAK_AREA_THRESHOLD) {
      items.push({ kind: "flashcard", index: i, title: card.front, subtitle: card.back, missCount });
    }
  });

  notes.quiz.forEach((q, i) => {
    const missCount = missCountOf(q.missCount);
    if (missCount >= WEAK_AREA_THRESHOLD) {
      items.push({ kind: "quiz-question", index: i, title: q.question, missCount });
    }
  });

  return items.sort((a, b) => b.missCount - a.missCount);
}