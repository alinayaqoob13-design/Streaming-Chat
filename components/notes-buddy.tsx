/**
 * ============================================================================
 * NOTES BUDDY — ORCHESTRATOR
 * ============================================================================
 *
 * Owns the state machine for the AI Study Notes Buddy:
 *
 *   input ──Generate──> generating ──200──> result
 *      ^                  |
 *      └────Try again─────┴──!200──> error
 *
 * - "input":      NotesInput visible, empty-state guidance when blank;
 *                 NotesHistory lists saved study sets below
 * - "generating": textarea locked, spinner on the button
 * - "result":     NotesResult visible + "New notes" to start over
 * - "error":      error banner with the API's friendly message + retry;
 *                 the student's notes are restored to the textarea so a
 *                 failed call never eats their text
 *
 * Persistence: every successful generation is saved to localStorage as a
 * SavedStudySet (newest first, capped) and can be reopened from the input
 * screen without spending a single token. There is no server-side storage.
 * ============================================================================
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, RotateCcw, PenLine, MessageSquareText, ChevronDown, ChevronUp, Download, Printer } from "lucide-react";
import { NotesInput } from "@/components/notes-input";
import { NotesResult } from "@/components/notes-result";
import { NotesChat } from "@/components/notes-chat";
import { NotesHistory } from "@/components/notes-history";
import { generateId } from "@/lib/utils";
import { studySetToMarkdown, downloadMarkdown } from "@/lib/export-notes";
import { DEFAULT_GENERATION_OPTIONS, type StudyNotes, type SavedStudySet, type GenerationOptions, type OutputLanguage } from "@/types/notes";

type BuddyStatus = "input" | "generating" | "result" | "error";

// ---------------------------------------------------------------------------
// LOCAL STORAGE PERSISTENCE
// ---------------------------------------------------------------------------
// Whole study sets (artifact + source notes) — reopening costs no tokens.
const STORAGE_KEY = "capstone-study-sets";
// Hard cap: a set can carry ~15k chars of notes + artifact; 20 sets stays
// well inside the ~5MB localStorage budget.
const MAX_SAVED_SETS = 20;

function loadSetsFromStorage(): SavedStudySet[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSetsToStorage(sets: SavedStudySet[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
  } catch {
    // Storage full or unavailable — fail silently, the app still works
  }
}

// Title = first non-empty line of the notes, trimmed for the history row
function deriveTitle(notes: string): string {
  const firstLine = notes.split("\n").map((l) => l.trim()).find(Boolean) ?? "Untitled notes";
  return firstLine.length > 60 ? firstLine.slice(0, 60) + "…" : firstLine;
}

export function NotesBuddy() {
  const [status, setStatus] = useState<BuddyStatus>("input");
  const [result, setResult] = useState<StudyNotes | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept so a failed generation can restore the student's text into the input
  const [lastNotes, setLastNotes] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [savedSets, setSavedSets] = useState<SavedStudySet[]>([]);
  // Language of the currently displayed set — drives RTL rendering
  const [resultLanguage, setResultLanguage] = useState<OutputLanguage>(DEFAULT_GENERATION_OPTIONS.language);
  // Guard against hydration mismatch: localStorage is read only after mount
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setSavedSets(loadSetsFromStorage());
    setHasMounted(true);
  }, []);

  const handleGenerate = useCallback(async (notes: string, options: GenerationOptions) => {
    setStatus("generating");
    setError(null);
    setLastNotes(notes);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, options }),
      });

      const data = await res.json();

      if (!res.ok) {
        // The API always returns { error: "<friendly copy>" } on failure
        setError(typeof data?.error === "string" ? data.error : "Something went wrong. Please try again in a moment.");
        setStatus("error");
        return;
      }

      const studyNotes = data as StudyNotes;
      setResult(studyNotes);
      setResultLanguage(options.language);
      setStatus("result");

      // Persist the set (newest first, capped) — reopening is free
      setSavedSets((prev) => {
        const saved: SavedStudySet = {
          ...studyNotes,
          id: generateId(),
          title: deriveTitle(notes),
          createdAt: Date.now(),
          sourceNotes: notes,
          language: options.language,
        };
        const next = [saved, ...prev].slice(0, MAX_SAVED_SETS);
        saveSetsToStorage(next);
        return next;
      });
    } catch {
      // Network failure — fetch itself threw
      setError("Could not reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setStatus("input");
  }, []);

  const handleNewNotes = useCallback(() => {
    setResult(null);
    setLastNotes("");
    setError(null);
    setStatus("input");
  }, []);

  // Reopen a saved set — no API call, everything renders from localStorage.
  // sourceNotes restores the follow-up chat's grounding too.
  const handleOpenSet = useCallback((set: SavedStudySet) => {
    setResult({ summary: set.summary, flashcards: set.flashcards, quiz: set.quiz });
    setLastNotes(set.sourceNotes);
    setResultLanguage(set.language ?? "en");
    setError(null);
    setChatOpen(false);
    setStatus("result");
  }, []);

  const handleDeleteSet = useCallback((id: string) => {
    setSavedSets((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSetsToStorage(next);
      return next;
    });
  }, []);

  return (
    <div className="flex w-full flex-1 flex-col gap-4 overflow-hidden rounded-xl border border-border bg-surface p-4 sm:p-6">
      {/* ----------------------------------------------------------------- */}
      {/* Error banner — friendly API message + retry, notes are preserved    */}
      {/* ----------------------------------------------------------------- */}
      <AnimatePresence>
        {status === "error" && error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            role="alert"
            className="flex shrink-0 items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" />
            <div className="flex-1">
              <p className="text-sm text-text-primary">{error}</p>
              <button
                onClick={handleRetry}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover focus:outline-none focus:underline"
              >
                <RotateCcw size={14} />
                Try again — your notes are still below
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------------------- */}
      {/* Main view: input form OR generated result                           */}
      {/* Result mode pins the title row + tab bar; only the panel scrolls,   */}
      {/* so "New notes" and the tabs are always reachable on long content.   */}
      {/* ----------------------------------------------------------------- */}
      {status === "result" && result ? (
        <>
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">
              Your study material
            </h2>
            <div className="flex items-center gap-2">
              {/* Export — markdown download + print-to-PDF, both free/local */}
              <button
                onClick={() =>
                  downloadMarkdown(
                    `${deriveTitle(lastNotes).replace(/[^\w\- ]/g, "").trim() || "study-notes"}.md`,
                    studySetToMarkdown(result, deriveTitle(lastNotes), Date.now())
                  )
                }
                aria-label="Download study set as Markdown"
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={() => window.print()}
                aria-label="Print or save as PDF"
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <Printer size={14} />
                <span className="hidden sm:inline">Print</span>
              </button>
              <button
                onClick={handleNewNotes}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <PenLine size={14} />
                New notes
              </button>
            </div>
          </div>
          <NotesResult result={result} language={resultLanguage} />

          {/* Follow-up chat — collapsible so it doesn't crowd the tabs.
              key={lastNotes} forces a remount per study set: a conversation
              never bleeds into different notes. */}
          <div className="shrink-0 rounded-xl border border-border bg-surface-elevated">
            <button
              onClick={() => setChatOpen((open) => !open)}
              aria-expanded={chatOpen}
              className="flex w-full items-center justify-between px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-accent rounded-xl"
            >
              <span className="inline-flex items-center gap-2 text-sm font-medium text-text-primary">
                <MessageSquareText size={16} className="text-accent" />
                Ask questions about these notes
              </span>
              {chatOpen ? (
                <ChevronUp size={16} className="text-text-muted" />
              ) : (
                <ChevronDown size={16} className="text-text-muted" />
              )}
            </button>
            {chatOpen && (
              <div className="flex h-[380px] flex-col border-t border-border">
                <NotesChat key={lastNotes} notes={lastNotes} />
              </div>
            )}
          </div>

          {/* Print-only handout layout — visible solely in @media print (see
              globals.css). Contains the WHOLE set (not just the active tab)
              in light-on-white, so "Print → Save as PDF" yields a complete
              revision document. */}
          <div className="print-area hidden print:block">
            <h1>{deriveTitle(lastNotes)}</h1>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {result.summary}
            </ReactMarkdown>
            <h2>Flashcards</h2>
            <ol>
              {result.flashcards.map((card, i) => (
                <li key={i}>
                  <strong>{card.front}</strong> — {card.back}
                </li>
              ))}
            </ol>
            <h2>Quiz</h2>
            <ol>
              {result.quiz.map((q, i) => (
                <li key={i}>
                  <p>{q.question}</p>
                  <ul>
                    {q.options.map((opt, oi) => (
                      <li key={oi}>
                        {opt}
                        {oi === q.correctIndex ? " ✓" : ""}
                      </li>
                    ))}
                  </ul>
                  <p>
                    <em>
                      Answer: {String.fromCharCode(65 + q.correctIndex)} — {q.explanation}
                    </em>
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NotesInput
            onGenerate={handleGenerate}
            isGenerating={status === "generating"}
            initialNotes={lastNotes}
          />
          {/* Saved study sets — only after mount (hydration guard) */}
          {hasMounted && (
            <NotesHistory
              sets={savedSets}
              onOpen={handleOpenSet}
              onDelete={handleDeleteSet}
            />
          )}
        </div>
      )}
    </div>
  );
}
