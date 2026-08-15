/**
 * ============================================================================
 * NOTES HISTORY — SAVED STUDY SETS
 * ============================================================================
 *
 * The input screen's history section: every generated study set is saved to
 * localStorage (by NotesBuddy) and listed here, newest first.
 *
 * - Click a row to reopen that set in the result view — no API call, the
 *   whole artifact (summary + flashcards + quiz + source notes) is local
 * - Live search box filters rows by title or any flashcard term
 * - Trash icon deletes a single set (NotesBuddy offers Undo for 8s)
 *
 * Rendered only after mount (hasMounted guard in NotesBuddy) so the list
 * never causes a hydration mismatch between server and client HTML.
 * ============================================================================
 */

"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Search, Trash2 } from "lucide-react";
import type { SavedStudySet } from "@/types/notes";

interface NotesHistoryProps {
  sets: SavedStudySet[];
  onOpen: (set: SavedStudySet) => void;
  onDelete: (id: string) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function NotesHistory({ sets, onOpen, onDelete }: NotesHistoryProps) {
  const [query, setQuery] = useState("");

  // Title + any flashcard front/back term → the search box. Empty query keeps
  // the whole list, so the "no matches" state only appears with typed input.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sets;
    return sets.filter(
      (set) =>
        set.title.toLowerCase().includes(q) ||
        set.flashcards.some(
          (c) => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q)
        )
    );
  }, [sets, query]);

  if (sets.length === 0) return null;

  return (
    <div className="mt-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-text-muted">
          <History size={13} />
          Recent study sets
        </h2>
      </div>

      <div className="relative mb-2">
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sets by title or flashcard…"
          aria-label="Search saved study sets"
          className="w-full rounded-lg border border-border bg-surface-elevated py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface-elevated/50 px-3 py-4 text-center text-sm text-text-muted">
          No saved sets match "{query.trim()}"
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {/* AnimatePresence gives deleted rows a fade+collapse exit; rows
              stagger in on mount / filter change (delay capped at 8 rows so
              long lists never feel slow) */}
          <AnimatePresence>
            {filtered.map((set, i) => (
            <motion.li
              key={set.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i, 8) * 0.03 }}
              className="overflow-hidden"
            >
              <div className="lift group flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 hover:border-accent/30">
                {/* Row body is the real button — the whole row opens the set */}
                <button
                  onClick={() => onOpen(set)}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left focus:outline-none"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-text-primary">
                      {set.title}
                    </span>
                    <span className="block text-[11px] text-text-muted">
                      {set.flashcards.length} flashcards · {set.quiz.length} quiz questions
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-text-muted">
                    {formatDate(set.createdAt)}
                  </span>
                </button>
                <button
                  onClick={() => onDelete(set.id)}
                  aria-label={`Delete study set: ${set.title}`}
                  className="shrink-0 min-w-[44px] min-h-[44px] rounded-md p-1.5 text-text-muted opacity-60 transition-all hover:bg-danger/10 hover:text-danger hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-danger"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
