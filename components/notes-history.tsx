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
 * - Export icon downloads that set as a .json backup file for sharing —
 *   import it on any device via the "Restore backup" button (validation is
 *   deliberately strict: mismatched shapes are rejected with an alert)
 *
 * Rendered only after mount (hasMounted guard in NotesBuddy) so the list
 * never causes a hydration mismatch between server and client HTML.
 * ============================================================================
 */

"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { History, Search, Share2, Trash2, Upload } from "lucide-react";
import type { SavedStudySet } from "@/types/notes";
import { downloadJson } from "@/lib/export-notes";

interface NotesHistoryProps {
  sets: SavedStudySet[];
  onOpen: (set: SavedStudySet) => void;
  onDelete: (id: string) => void;
  onImport: (set: SavedStudySet) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Strict JSON backup validation. Anything that isn't a well-formed study set
// is rejected — this is untrusted input, so no field is trusted blindly.
// Optional SRS fields (cardId, easeFactor, ...) are dropped on purpose:
// imported cards simply restart their review schedule as new cards.
// ---------------------------------------------------------------------------
function parseImportedSet(raw: string): SavedStudySet | null {
  try {
    const data = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return null;

    const title = typeof data.title === "string" ? data.title.slice(0, 120) : "Imported study set";
    if (typeof data.summary !== "string" || data.summary.length === 0) return null;
    if (!Array.isArray(data.flashcards) || data.flashcards.length === 0) return null;
    if (!Array.isArray(data.quiz)) return null;

    const flashcards = (data.flashcards as unknown[])
      .filter(
        (c: unknown): c is { front: string; back: string } =>
          typeof (c as { front?: unknown }).front === "string" &&
          (c as { front: string }).front.length > 0 &&
          typeof (c as { back?: unknown }).back === "string"
      )
      .map((c) => ({ front: c.front, back: c.back }));
    if (flashcards.length === 0) return null;

    const quiz = (data.quiz as unknown[])
      .filter(
        (q: unknown): q is { question: string; options: string[]; correctIndex: number; explanation?: string } =>
          typeof (q as { question?: unknown }).question === "string" &&
          Array.isArray((q as { options?: unknown }).options) &&
          (q as { options: unknown[] }).options.length >= 2 &&
          (q as { options: unknown[] }).options.every((o) => typeof o === "string") &&
          Number.isInteger((q as { correctIndex?: unknown }).correctIndex)
      )
      .map((q) => ({
        question: q.question,
        options: q.options.slice(0, 4),
        correctIndex: Math.min(q.correctIndex, q.options.length - 1),
        explanation: typeof q.explanation === "string" ? q.explanation : "No explanation included in backup.",
      }));
    // Backups always carry a quiz, but tolerate older files that predate it.
    if (quiz.length === 0 && data.summary.length < 80) return null;

    return {
      id: typeof data.id === "string" ? data.id : `imported-${Date.now()}`,
      title,
      summary: data.summary,
      sourceNotes: typeof data.sourceNotes === "string" ? data.sourceNotes : `Imported "${title}"`,
      createdAt:
        typeof data.createdAt === "number" && Number.isFinite(data.createdAt)
          ? data.createdAt
          : Date.now(),
      language:
        data.language === "ur" || data.language === "en" ? data.language : undefined,
      flashcards,
      quiz,
    };
  } catch {
    return null;
  }
}

export function NotesHistory({ sets, onOpen, onDelete, onImport }: NotesHistoryProps) {
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

  const handleImportFile = async (file: File) => {
    const reject = () =>
      window.alert(
        "That file doesn't look like a valid study-set backup. Was it exported from the Study Notes Buddy?"
      );
    try {
      const parsed = parseImportedSet(await file.text());
      if (!parsed) return reject();
      onImport(parsed);
    } catch {
      reject();
    }
  };

  return (
    <div className="mt-6">
      {/* Header row: title + backup tools. The import button reads a local file
          — the .json backup format — and never sends anything anywhere. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-text-muted">
          <History size={13} />
          Recent study sets
        </h2>
        <div className="flex items-center gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface-elevated px-2.5 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent/40 hover:text-text-primary focus-within:outline-none focus-within:ring-2 focus-within:ring-accent">
            <Upload size={13} />
            Restore backup
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
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
          {filtered.map((set) => (
            <motion.li
              key={set.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="group flex items-center gap-1 rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2.5 transition-colors hover:border-accent/30">
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
                {/* Export — one-tap .json backup of this set for sharing */}
                <button
                  onClick={() =>
                    downloadJson(
                      `${set.title.replace(/[\\/:*?"<>|]/g, "").slice(0, 60) || "study-set"}.json`,
                      set
                    )
                  }
                  aria-label={`Export study set: ${set.title} as JSON backup`}
                  className="shrink-0 min-w-[44px] min-h-[44px] rounded-md p-1.5 text-text-muted opacity-60 transition-all hover:bg-accent/10 hover:text-accent hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  <Share2 size={14} />
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
        </ul>
      )}
    </div>
  );
}