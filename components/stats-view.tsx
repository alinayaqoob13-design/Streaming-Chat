/**
 * ============================================================================
 * STATS VIEW — YOUR STUDY STATS TILE
 * ============================================================================
 *
 * A compact, purely-informational tile for the Bento grid: derives four
 * numbers from data that already lives in localStorage (saved sets + SRS
 * fields). Costs zero tokens, computes locally, no new persistence.
 *
 * Stats shown:
 *  - Study sets created (length of saved sets)
 *  - Cards reviewed at least once (lastReviewedAt set — SRS-tracked decks)
 *  - Cards due today (reuses lib/srs.ts countDueCards across all sets)
 *  - Weak-area misses (SRS "Again" ratings + wrong quiz answers)
 *
 * Informational only — no CTA here; the Generate button owns the primary
 * action (Bento Rule E).
 * ============================================================================
 */

"use client";

import { useMemo } from "react";
import { Layers, CalendarClock, CheckCheck, AlertTriangle } from "lucide-react";
import { countDueCards } from "@/lib/srs";
import type { SavedStudySet } from "@/types/notes";

interface StatsViewProps {
  sets: SavedStudySet[];
  onStartMixedPractice?: () => void;
}

interface StatEntry {
  icon: typeof Layers;
  label: string;
  value: number;
  accent?: "success" | "danger" | "accent";
}

export function StatsView({ sets, onStartMixedPractice }: StatsViewProps) {
  const stats = useMemo<StatEntry[]>(() => {
    let reviewed = 0;
    let due = 0;
    let misses = 0;

    for (const set of sets) {
      // SRS-tracked cards count once reviewed; due load sums across decks
      for (const card of set.flashcards) {
        if (card.lastReviewedAt) reviewed++;
      }
      due += countDueCards(set.flashcards);
      for (const card of set.flashcards) misses += card.missCount ?? 0;
      for (const q of set.quiz) misses += q.missCount ?? 0;
    }

    return [
      { icon: Layers, label: "Study sets", value: sets.length, accent: "accent" },
      { icon: CheckCheck, label: "Cards reviewed", value: reviewed, accent: "success" },
      { icon: CalendarClock, label: "Due today", value: due, accent: "accent" },
      { icon: AlertTriangle, label: "Weak misses", value: misses, accent: "danger" },
    ];
  }, [sets]);

  const totalQuiz = sets.reduce((sum, set) => sum + set.quiz.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-text-muted">
          Your study stats
        </h2>
        {totalQuiz > 0 && onStartMixedPractice && (
          <button
            onClick={onStartMixedPractice}
            className="rounded text-xs font-medium text-accent transition-colors hover:text-accent-hover focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
          >
            Mixed practice →
          </button>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
        {stats.map(({ icon: Icon, label, value, accent }) => (
          <div
            key={label}
            className="flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5"
          >
            <dt className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
              <Icon
                size={12}
                className={
                  accent === "danger" ? "text-danger" : accent === "success" ? "text-success" : "text-accent"
                }
                aria-hidden
              />
              {label}
            </dt>
            <dd className="font-display text-xl font-semibold leading-none text-text-primary">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}