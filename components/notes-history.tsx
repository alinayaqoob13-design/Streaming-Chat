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
 * - Trash icon deletes a single set; deletion is instant and local
 * - Title is derived from the first line of the pasted notes at save time
 *
 * Rendered only after mount (hasMounted guard in NotesBuddy) so the list
 * never causes a hydration mismatch between server and client HTML.
 * ============================================================================
 */

"use client";

import { motion } from "framer-motion";
import { History, Trash2 } from "lucide-react";
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
  if (sets.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-text-muted">
        <History size={13} />
        Recent study sets
      </h2>
      <ul className="flex flex-col gap-1.5">
        {sets.map((set) => (
          <motion.li
            key={set.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="group flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 transition-colors hover:border-accent/30">
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
                className="shrink-0 rounded-md p-1.5 text-text-muted opacity-0 transition-all hover:bg-danger/10 hover:text-danger focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-danger group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
