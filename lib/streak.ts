/**
 * ============================================================================
 * DAILY STUDY STREAK — PURE CORE
 * ============================================================================
 *
 * Tracks consecutive days on which a study set was successfully generated.
 * Rules:
 *
 *  - One count per calendar day: repeated generations on the same day (local
 *    time) never bump the streak twice.
 *  - The streak breaks only when a full day passes without a generation —
 *    it then restarts at 1 on the next successful day.
 *  - Dates are LOCAL (YYYY-MM-DD via getFullYear/getMonth/getDate), never
 *    UTC. Using toISOString() here would shift the day boundary for users
 *    east/west of UTC — a subtle but unfair streak bug.
 *  - longestStreak is monotonic: it can only grow, never reset.
 *
 * Persistence uses its own localStorage key (capstone-streak) — a study
 * streak is metadata about the user, not about a saved set, so it does not
 * live inside capstone-study-sets.
 *
 * The module is deliberately pure + jsdom-safe: no window/document access at
 * import time, so it unit-tests with plain Vitest.
 * ============================================================================
 */

export interface StreakState {
  /** Consecutive days ending on lastActiveDate (0 = never studied yet) */
  currentStreak: number;
  /** All-time best currentStreak — never decreases */
  longestStreak: number;
  /** Local YYYY-MM-DD of the last successful generation, or null */
  lastActiveDate: string | null;
}

export const EMPTY_STREAK: StreakState = {
  currentStreak: 0,
  longestStreak: 0,
  lastActiveDate: null,
};

const STORAGE_KEY = "capstone-streak";

// ---------------------------------------------------------------------------
// DATE KEY HELPERS
// ---------------------------------------------------------------------------

/** Local calendar date as YYYY-MM-DD. Timezone-safe: built from local parts. */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Whole days from key `a` to key `b` (b − a). Computed on UTC midnights of the
 * parsed local dates, which makes it immune to DST shifts that would otherwise
 * flip a 23/25-hour day into a wrong count.
 */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aUtc = Date.UTC(ay, am - 1, ad);
  const bUtc = Date.UTC(by, bm - 1, bd);
  return Math.round((bUtc - aUtc) / 86_400_000);
}

// ---------------------------------------------------------------------------
// STREAK TRANSITION — PURE
// ---------------------------------------------------------------------------

/**
 * Advance the streak for a successful generation on `todayKey`.
 * Pure: the caller owns state + persistence.
 */
export function recordStudyDay(prev: StreakState, todayKey: string): StreakState {
  // Already logged today — never double-count the same calendar day
  if (prev.lastActiveDate === todayKey) return prev;

  // yesterday === consecutive chain continues; anything else (or a first-ever
  // study day) restarts the chain at 1.
  const isConsecutive = prev.lastActiveDate !== null && daysBetween(prev.lastActiveDate, todayKey) === 1;
  const current = isConsecutive ? prev.currentStreak + 1 : 1;

  return {
    currentStreak: current,
    longestStreak: Math.max(prev.longestStreak, current),
    lastActiveDate: todayKey,
  };
}

// ---------------------------------------------------------------------------
// PERSISTENCE — localStorage with the same guards as notes-buddy
// ---------------------------------------------------------------------------

export function loadStreak(): StreakState {
  if (typeof window === "undefined") return EMPTY_STREAK;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return EMPTY_STREAK;
    const parsed = JSON.parse(stored) as Partial<StreakState>;
    if (
      typeof parsed.currentStreak !== "number" ||
      typeof parsed.longestStreak !== "number" ||
      (parsed.lastActiveDate !== null && typeof parsed.lastActiveDate !== "string")
    ) {
      return EMPTY_STREAK;
    }
    return {
      currentStreak: parsed.currentStreak,
      longestStreak: parsed.longestStreak,
      lastActiveDate: parsed.lastActiveDate ?? null,
    };
  } catch {
    // Corrupt JSON or unavailable storage — start fresh, the app still works
    return EMPTY_STREAK;
  }
}

export function saveStreak(state: StreakState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — fail silently
  }
}