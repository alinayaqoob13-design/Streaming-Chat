/**
 * ============================================================================
 * QUIZ PROGRESS — MID-QUIZ PERSISTENCE
 * ============================================================================
 *
 * The quiz view (components/quiz-view.tsx) locks each question after one
 * attempt. That state used to live entirely in component memory, so a tab
 * switch (the result panel remounts per tab) or a page reload erased it.
 * This module stores the chosen answers per study set under localStorage so
 * a student can drop mid-quiz and resume exactly where they left off.
 *
 * Storage:
 *   key:   capstone-quiz-progress:<setId>
 *   value: JSON object { "<questionIndex>": "<chosenOptionIndex>", ... }
 *
 * Loading is defensive: malformed JSON, non-integer indices, and choices
 * outside the current quiz's bounds (a regenerated/stale set) are dropped.
 * ============================================================================
 */

/** localStorage key for one study set's quiz answers. */
export function quizProgressStorageKey(setId: string): string {
  return `capstone-quiz-progress:${setId}`;
}

/**
 * Restore the saved quiz answers for a set. Every question index must be a
 * valid integer inside the current quiz, and every chosen option must point
 * to an existing option — stale payloads can never lock a question that no
 * longer exists or highlight a vanished option.
 *
 * @param optionCounts  options.length per question, in quiz order
 * @returns the validated map (possibly empty), or null when nothing is saved
 */
export function loadQuizProgress(
  setId: string,
  optionCounts: number[]
): Record<number, number> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(quizProgressStorageKey(setId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;

    const restored: Record<number, number> = {};
    for (const key of Object.keys(parsed)) {
      const questionIndex = Number(key);
      const chosen = (parsed as Record<string, unknown>)[key];
      if (!Number.isInteger(questionIndex)) continue;
      if (questionIndex < 0 || questionIndex >= optionCounts.length) continue;
      if (typeof chosen !== "number" || !Number.isInteger(chosen)) continue;
      if (chosen < 0 || chosen >= optionCounts[questionIndex]) continue;
      restored[questionIndex] = chosen;
    }
    return restored;
  } catch {
    return null;
  }
}

/** Persist the current answers; storage failures degrade silently. */
export function saveQuizProgress(setId: string, answers: Record<number, number>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(quizProgressStorageKey(setId), JSON.stringify(answers));
  } catch {
    // Storage full or unavailable — the quiz still works in memory
  }
}

/** Delete a set's saved quiz progress (used when cleaning a deleted set). */
export function clearQuizProgress(setId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(quizProgressStorageKey(setId));
  } catch {
    // Best-effort cleanup only
  }
}

/** Prefix under which every progress key lives — used for orphan pruning. */
export const QUIZ_PROGRESS_KEY_PREFIX = "capstone-quiz-progress:";

/**
 * Remove quiz progress belonging to sets that no longer exist. Deleted sets
 * leave their keys behind, so the orchestrator prunes orphans on mount.
 */
export function pruneOrphanQuizProgress(setIds: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    const kept = new Set(Array.from(setIds, quizProgressStorageKey));
    Object.keys(localStorage)
      .filter((key) => key.startsWith(QUIZ_PROGRESS_KEY_PREFIX) && !kept.has(key))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Storage unavailable — skip pruning
  }
}