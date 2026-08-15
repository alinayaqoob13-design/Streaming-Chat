/**
 * ============================================================================
 * INPUT TOP BAR — COMPACT HEADER CONTROLS
 * ============================================================================
 *
 * Replaces the old right-side supporting rail (streak card + stats card +
 * recent study sets) with two slim controls next to the "Study Workspace"
 * heading, so the main content owns the full column width:
 *
 *  - The streak chip (compact pill, reuse of StreakDisplay)
 *  - A stats icon button → popover with the SAME stat grid as before
 *    ("Study sets / Cards reviewed / Due today / Weak misses" + the
 *    "Mixed practice →" CTA) — data stays live because StatsView still
 *    derives from the savedSets prop on every render
 *  - A "Recent study sets" icon button → popover with the full NotesHistory
 *    (search, per-row delete, .json export, restore backup) — functionality
 *    that the left sidebar's simple list does not offer stays reachable
 *
 * Accessibility/behavior:
 *  - One panel open at a time; invisible backdrop + Escape both close it
 *  - aria-expanded + aria-haspopup on the triggers, role="dialog" panels
 *  - Panels are icon-orbit and click-away focus-safe (backdrop is inert
 *    except for closing)
 * ============================================================================
 */

"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, History } from "lucide-react";
import { StreakDisplay } from "@/components/streak-display";
import { StatsView } from "@/components/stats-view";
import { NotesHistory } from "@/components/notes-history";
import type { StreakState } from "@/lib/streak";
import type { SavedStudySet } from "@/types/notes";

interface InputTopBarProps {
  /** Streak state or null until hydration (chip hidden pre-mount) */
  streak: StreakState | null;
  /** Saved sets — feeds both the stats grid and the recent-sets popover */
  sets: SavedStudySet[];
  onOpenSet: (set: SavedStudySet) => void;
  onDeleteSet: (id: string) => void;
  onStartMixedPractice: () => void;
}

type PanelKind = "stats" | "recent" | null;

/** Shared popover panel: backdrop + scaled-in card, closed by Escape/backdrop. */
interface PanelProps {
  open: boolean;
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}

function Panel({ open, label, onClose, children }: PanelProps) {
  useEffect(() => {
    if (open) {
      const first = document.querySelector(
        'button, [href], [tabindex], input, select, textarea'
      ) as HTMLElement | null;
      if (first) {
        first.focus();
      }
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      const previouslyFocused = document.activeElement as HTMLElement | null;
      if (previouslyFocused) {
        previouslyFocused.blur();
      }
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <button
            aria-hidden="true"
            tabIndex={-1}
            onClick={onClose}
            className="fixed inset-0 z-40 cursor-default"
          />
<motion.div
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-full z-50 mt-2 w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-4 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function InputTopBar({
  streak,
  sets,
  onOpenSet,
  onDeleteSet,
  onStartMixedPractice,
}: InputTopBarProps) {
  const [panel, setPanel] = useState<PanelKind>(null);
  const close = () => setPanel(null);

  // Escape closes any open panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The recent-sets button hides while there is nothing to list — NotesHistory
  // returns null for an empty list too (both guards are belt-and-braces).
  const showRecent = sets.length > 0;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {streak && <StreakDisplay streak={streak} />}

      {/* --- Stats popover --- */}
      <div className="relative">
        <button
          onClick={() => setPanel(panel === "stats" ? null : "stats")}
          aria-expanded={panel === "stats"}
          aria-haspopup="dialog"
          aria-label="Your study stats"
          title="Your study stats"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-elevated text-text-secondary transition-colors hover:bg-border hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <BarChart3 size={16} aria-hidden />
        </button>
        <Panel open={panel === "stats"} label="Your study stats" onClose={close}>
          <StatsView sets={sets} onStartMixedPractice={onStartMixedPractice} />
        </Panel>
      </div>

      {/* --- Recent study sets popover --- */}
      {showRecent && (
        <div className="relative">
          <button
            onClick={() => setPanel(panel === "recent" ? null : "recent")}
            aria-expanded={panel === "recent"}
            aria-haspopup="dialog"
            aria-label="Recent study sets"
            title="Recent study sets"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-elevated text-text-secondary transition-colors hover:bg-border hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <History size={16} aria-hidden />
          </button>
          <Panel open={panel === "recent"} label="Recent study sets" onClose={close}>
            <div className="max-h-[min(60dvh,28rem)] overflow-y-auto pr-1">
              <NotesHistory
                sets={sets}
                onOpen={onOpenSet}
                onDelete={onDeleteSet}
              />
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}