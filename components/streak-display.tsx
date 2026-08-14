/**
 * ============================================================================
 * STREAK DISPLAY — DAILY STUDY STREAK CHIP
 * ============================================================================
 *
 * Reads StreakState and renders a compact "N day streak" chip (Flame icon).
 * Rules:
 *
 *  - Always visible in the input view once mounted (hydration guard lives in
 *    the parent — NotesBuddy passes the state only after mount).
 *  - 0-streak users get encouragement copy, not a dead chip.
 *  - If the chain is alive but today hasn't been logged yet, a muted nudge
 *    ("Keep it alive — generate today") motivates the day's first generation.
 *
 * Pure presentation — all state transitions live in lib/streak.ts.
 * ============================================================================
 */

"use client";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { getLocalDateKey, type StreakState } from "@/lib/streak";

export interface StreakDisplayProps {
  streak: StreakState;
}

export function StreakDisplay({ streak }: StreakDisplayProps) {
  const { currentStreak, longestStreak, lastActiveDate } = streak;

  // A live chain still needs today's generation to stay alive — nudge the
  // user once per day instead of letting the streak quietly lapse.
  const dueToday = currentStreak > 0 && lastActiveDate !== getLocalDateKey();

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      title={longestStreak > 0 ? `Best streak: ${longestStreak} day${longestStreak === 1 ? "" : "s"}` : undefined}
      className="flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1.5"
    >
      <Flame
        size={16}
        className={currentStreak > 0 ? "shrink-0 text-accent" : "shrink-0 text-text-muted"}
        aria-hidden
      />
      {currentStreak > 0 ? (
        <span className="text-sm font-medium text-text-primary">
          {currentStreak} day streak
        </span>
      ) : (
        <span className="text-sm text-text-secondary">No streak yet — generate today to start one</span>
      )}
      {dueToday && (
        <span className="hidden text-xs text-text-muted sm:inline">· Keep it alive — study today</span>
      )}
    </motion.div>
  );
}