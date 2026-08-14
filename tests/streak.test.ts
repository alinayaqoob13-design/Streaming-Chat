/**
 * ============================================================================
 * UNIT TESTS — lib/streak.ts (daily study streak)
 * ============================================================================
 *
 * Covers the pure streak core of Phase 5: local YYYY-MM-DD date keys (never
 * UTC — constructing dates from local parts makes every assertion
 * timezone-safe), one-count-per-day idempotency, consecutive-day chaining,
 * gap resets, monotonic longestStreak, and localStorage round-trips.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  EMPTY_STREAK,
  getLocalDateKey,
  daysBetween,
  recordStudyDay,
  loadStreak,
  saveStreak,
  type StreakState,
} from "@/lib/streak";

// Local-time construction: these stay correct in any timezone the CI runs in.
const TODAY = "2026-08-10";

function localDate(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d, 12, 0, 0); // noon local, never near midnight
}

function state(partial: Partial<StreakState>): StreakState {
  return { currentStreak: 0, longestStreak: 0, lastActiveDate: null, ...partial };
}

describe("getLocalDateKey", () => {
  it("formats a local date as zero-padded YYYY-MM-DD", () => {
    expect(getLocalDateKey(localDate(2026, 8, 10))).toBe("2026-08-10");
  });

  it("keys stay stable for the full local day (23:59:59 still today)", () => {
    const lateEvening = new Date(2026, 7, 10, 23, 59, 59);
    expect(getLocalDateKey(lateEvening)).toBe("2026-08-10");
  });

  it("rolls over at local midnight, not at UTC midnight", () => {
    // 00:30 local on the 11th — a UTC read would say the 10th (or the 11th
    // depending on offset); the local read must always be the 11th.
    expect(getLocalDateKey(new Date(2026, 7, 11, 0, 30))).toBe("2026-08-11");
  });
});

describe("daysBetween", () => {
  it("is 0 for the same day and 1 for consecutive days", () => {
    expect(daysBetween(TODAY, TODAY)).toBe(0);
    expect(daysBetween("2026-08-09", TODAY)).toBe(1);
  });

  it("crosses month boundaries correctly", () => {
    expect(daysBetween("2026-07-31", "2026-08-01")).toBe(1);
    expect(daysBetween("2026-07-29", "2026-08-01")).toBe(3);
  });

  it("counts whole calendar days, not 24-hour windows (DST-proof)", () => {
    // A day either side of a DST shift — still exactly one calendar day apart
    expect(daysBetween("2026-10-31", "2026-11-01")).toBe(1);
  });
});

describe("recordStudyDay", () => {
  it("starts a fresh streak at 1 on the first-ever study day", () => {
    const out = recordStudyDay(EMPTY_STREAK, TODAY);
    expect(out).toEqual({ currentStreak: 1, longestStreak: 1, lastActiveDate: TODAY });
  });

  it("never double-counts the same calendar day", () => {
    const once = recordStudyDay(EMPTY_STREAK, TODAY);
    const twice = recordStudyDay(once, TODAY);
    const thrice = recordStudyDay(twice, TODAY);
    expect(twice).toEqual(once);
    expect(thrice).toEqual(once);
  });

  it("extends the streak by one when the previous day was yesterday", () => {
    const out = recordStudyDay(state({ currentStreak: 4, longestStreak: 4, lastActiveDate: "2026-08-09" }), TODAY);
    expect(out.currentStreak).toBe(5);
    expect(out.longestStreak).toBe(5);
    expect(out.lastActiveDate).toBe(TODAY);
  });

  it("chains across a month boundary as a single day", () => {
    const out = recordStudyDay(state({ currentStreak: 9, longestStreak: 9, lastActiveDate: "2026-07-31" }), "2026-08-01");
    expect(out.currentStreak).toBe(10);
  });

  it("resets to 1 after any gap longer than a day", () => {
    const out = recordStudyDay(state({ currentStreak: 7, longestStreak: 12, lastActiveDate: "2026-08-06" }), TODAY);
    expect(out.currentStreak).toBe(1);
    // The all-time best survives the reset
    expect(out.longestStreak).toBe(12);
  });

  it("resets to 1 after a very long absence", () => {
    const out = recordStudyDay(state({ currentStreak: 3, longestStreak: 3, lastActiveDate: "2025-01-01" }), TODAY);
    expect(out.currentStreak).toBe(1);
    expect(out.longestStreak).toBe(3);
  });

  it("longestStreak is monotonic across a full chain then reset", () => {
    let s = recordStudyDay(EMPTY_STREAK, "2026-08-01"); // 1
    s = recordStudyDay(s, "2026-08-02"); // 2
    s = recordStudyDay(s, "2026-08-03"); // 3
    expect(s.longestStreak).toBe(3);
    s = recordStudyDay(s, "2026-08-10"); // gap -> reset
    expect(s.currentStreak).toBe(1);
    expect(s.longestStreak).toBe(3);
  });
});

describe("loadStreak / saveStreak", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns EMPTY_STREAK when nothing is stored", () => {
    expect(loadStreak()).toEqual(EMPTY_STREAK);
  });

  it("round-trips a real streak through localStorage", () => {
    const s: StreakState = { currentStreak: 5, longestStreak: 9, lastActiveDate: "2026-08-09" };
    saveStreak(s);
    expect(loadStreak()).toEqual(s);
  });

  it("falls back to EMPTY_STREAK on corrupt JSON", () => {
    localStorage.setItem("capstone-streak", "{not json");
    expect(loadStreak()).toEqual(EMPTY_STREAK);
  });

  it("falls back to EMPTY_STREAK on a malformed shape", () => {
    localStorage.setItem("capstone-streak", JSON.stringify({ currentStreak: "five" }));
    expect(loadStreak()).toEqual(EMPTY_STREAK);
  });
});