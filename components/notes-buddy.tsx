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
 * A daily study streak (lib/streak.ts, key capstone-streak) is counted on
 * each successful generation — one per local calendar day.
 *
 * Layout (Phase 7): the input screen is a Bento grid — a dominant primary
 * tile (NotesInput) with a supporting rail (streak + recent study sets) on
 * xl, collapsing to one column below 1280px. The result screen is a
 * full-width surface tile. Structure-only: child components are unchanged.
 * ============================================================================
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertCircle, RotateCcw, PenLine, MessageSquareText, ChevronDown, ChevronUp, Download, Check, Undo2 } from "lucide-react";
import { NotesInput } from "@/components/notes-input";
import { NotesResult } from "@/components/notes-result";
import { NotesChat } from "@/components/notes-chat";
import { InputTopBar } from "@/components/input-top-bar";
import { useRouter, usePathname } from "next/navigation";

import { generateId, cn } from "@/lib/utils";
import { studySetToWordHtml, downloadWord } from "@/lib/export-notes";
import { withViewTransition } from "@/lib/view-transition";
import { getLocalDateKey, loadStreak, saveStreak, recordStudyDay, EMPTY_STREAK, type StreakState } from "@/lib/streak";
import { pruneOrphanQuizProgress } from "@/lib/quiz-progress";
import { DEFAULT_GENERATION_OPTIONS, type StudyNotes, type SavedStudySet, type GenerationOptions, type OutputLanguage, type Flashcard, type QuizQuestion } from "@/types/notes";
import { AppShell } from "@/components/app-shell/app-shell";
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

export default function NotesBuddy({ initialSetId }: { initialSetId?: string }) {
  const [status, setStatus] = useState<BuddyStatus>("input");
  const [showSuccess, setShowSuccess] = useState(false);
  const [savedSets, setSavedSets] = useState<SavedStudySet[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const successTimerRef = useRef<number | null>(null);
  const [result, setResult] = useState<StudyNotes | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept so a failed generation can restore the student's text into the input
  const [lastNotes, setLastNotes] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  // Incremented on "New Study Set" — remounts NotesInput so a stale draft
  // never survives into a fresh session (see handleNewNotes).
  const [inputEpoch, setInputEpoch] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  // Helper to open a set, optionally updating the URL
  // back into this set (and through it into localStorage). null = result not
  // tied to a saved set (e.g. mid-cleanup), ratings then update view state only.
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  // Language of the currently displayed set — drives RTL rendering
  const [resultLanguage, setResultLanguage] = useState<OutputLanguage>(DEFAULT_GENERATION_OPTIONS.language);
  // Daily study streak — null until mount (hydration guard); the chip only
  // renders once this holds a real value, so server HTML never differs.
  const [streak, setStreak] = useState<StreakState | null>(null);
  // Guard against hydration mismatch: localStorage is read only after mount
  const [hasMounted, setHasMounted] = useState(false);
  // Undo-delete toast: the removed set is stashed for 8 seconds so an
  // accidental trash-tap is recoverable (see handleUndoDelete).
  const [undoToast, setUndoToast] = useState<{ setId: string; title: string } | null>(null);
  const undoStashRef = useRef<SavedStudySet | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  // Deep-link set opener must fire exactly once. Without this guard the
  // effect below re-fires when activeSetId flips to null ("New notes") and
  // would re-open the set the student just left.
  const initialSetOpenedRef = useRef(false);

  // Clear the undo window on unmount so no timer fires into a dead component
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  // Hydration guard: anything that reads localStorage must not render on the
  // server, otherwise server HTML and client HTML differ.
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Prune quiz progress (lib/quiz-progress.ts) belonging to sets that no
  // longer exist. Runs after hydration and whenever the saved-set list
  // changes; it is cheap and idempotent, so per-event sync is fine.
  useEffect(() => {
    if (!hasMounted) return;
    pruneOrphanQuizProgress(new Set(savedSets.map((s) => s.id)));
  }, [hasMounted, savedSets]);

  // Open set from URL on initial mount (no navigation push). Runs once via
  // initialSetOpenedRef — the effect also fires on savedSets/activeSetId
  // changes (they are listed as deps), but past the first successful open a
  // later "null" transition must never re-trigger a deep link.
  useEffect(() => {
    if (!hasMounted) return;
    if (initialSetOpenedRef.current) return;
    if (!initialSetId) return;
    const set = savedSets.find((s) => s.id === initialSetId);
    if (!set) return;
    initialSetOpenedRef.current = true;
    openSet(set, false);
  }, [hasMounted, initialSetId, savedSets]);

  const handleGenerate = useCallback(async (notes: string, options: GenerationOptions) => {
    // Reset any prior success indicator when starting a new generation
    setShowSuccess(false);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
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
        // API returned an error – clear any success indicator
        setShowSuccess(false);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        // The API always returns { error: "<friendly copy>" } on failure
        setError(typeof data?.error === "string" ? data.error : "Something went wrong. Please try again in a moment.");
        setStatus("error");
        return;
      }

      const studyNotes = data as StudyNotes;
      // Persist the set (newest first, capped) — reopening is free.
      // The id is computed here so the SRS layer can target this set later.
      const setId = generateId();

      // The whole input→result switch rides one view transition when the
      // browser supports it (see lib/view-transition.ts) — React batches
      // these updates into a single repaint, so the crossfade captures the
      // real screen change.
      withViewTransition(() => {
        setResult(studyNotes);
        setResultLanguage(options.language);
        setStatus("result");
        setActiveSetId(setId);
        setSavedSets((prev) => {
          const saved: SavedStudySet = {
            ...studyNotes,
            id: setId,
            title: deriveTitle(notes),
            createdAt: Date.now(),
            sourceNotes: notes,
            language: options.language,
          };
          const next = [saved, ...prev].slice(0, MAX_SAVED_SETS);
          saveSetsToStorage(next);
          return next;
        });

        // Daily streak — a successful generation counts as a study day.
        // recordStudyDay is idempotent per local calendar day, so smashing
        // the Generate button repeatedly never inflates the count.
        setStreak((prev) => {
          const next = recordStudyDay(prev ?? EMPTY_STREAK, getLocalDateKey());
          saveStreak(next);
          return next;
        });
      });

      // Trigger success indicator
      setShowSuccess(true);
      // Clear any existing timer
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = window.setTimeout(() => setShowSuccess(false), 1000);
    } catch {
      // Network failure — fetch itself threw
      setError("Could not reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }, []);

  const handleRetry = useCallback(() => {
    withViewTransition(() => {
      setError(null);
      setStatus("input");
      setActiveSetId(null);
    });
    setShowSuccess(false);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
  }, []);

  const handleNewNotes = useCallback(() => {
    setResult(null);
    setLastNotes("");
    setError(null);
    setShowSuccess(false);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    // Bumping the epoch REMOUNTS NotesInput (via key) — its internal draft,
    // compose flag and option chips all reset. Without this, clicking
    // "New Study Set" while already on the input screen left the previous
    // notes sitting in the textarea (a prop change never resets useState).
    setInputEpoch((e) => e + 1);
    withViewTransition(() => {
      setStatus("input");
      setActiveSetId(null);
    });
    router.push(`/`);
  }, []);

  // Reopen a saved set — no API call, everything renders from localStorage.
  // sourceNotes restores the follow-up chat's grounding too.
  const openSet = (set: SavedStudySet, pushUrl: boolean = true) => {
    withViewTransition(() => {
      setResult({ summary: set.summary, flashcards: set.flashcards, quiz: set.quiz });
      setLastNotes(set.sourceNotes);
      setResultLanguage(set.language ?? "en");
      setError(null);
      setChatOpen(false);
      setActiveSetId(set.id);
      setStatus("result");
    });
    if (pushUrl) {
      router.push(`/study-set/${set.id}`);
    }
  };

  const handleDeleteSet = useCallback(
    (id: string) => {
      // Deleting the set on screen detaches SRS writes from storage
      // If we're viewing the set we just deleted, kick back to the input screen
      if (id === activeSetId) {
        setActiveSetId(null);
        setStatus("input");
        setResult(null);
        setLastNotes("");
      }
      
      // Stash the victim + open the Undo window (8s) BEFORE persisting, so a
      // misplaced tap is never final — restore puts the set back on top.
      const victim = savedSets.find((s) => s.id === id) ?? null;
      undoStashRef.current = victim;
      const next = savedSets.filter((s) => s.id !== id);
      saveSetsToStorage(next);
      setSavedSets(next);
      if (victim) {
        setUndoToast({ setId: id, title: victim.title });
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = window.setTimeout(() => setUndoToast(null), 8000);
      }
    },
    [activeSetId, savedSets]
  );

  const handleOpenSet = useCallback((set: SavedStudySet) => {
    openSet(set);
  }, []);

  // Restore the stashed set (if it wasn't deleted again meanwhile) back to the
  // top of the list. Cap still applies so the list never exceeds its budget.
  const handleUndoDelete = useCallback(() => {
    const victim = undoStashRef.current;
    if (!victim) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoToast(null);
    setSavedSets((prev) => {
      if (prev.some((s) => s.id === victim.id)) return prev;
      const next = [victim, ...prev].slice(0, MAX_SAVED_SETS);
      saveSetsToStorage(next);
      return next;
    });
  }, []);

  // Phase 6 SRS: a flashcard was rated in the study (SRS) mode. Update both
  // the on-screen result and the matching saved set, persisting back to the
  // existing capstone-study-sets key — ratings survive reloads.
  const handleRateCard = useCallback((index: number, updated: Flashcard) => {
    setResult((prev) => {
      if (!prev || index < 0 || index >= prev.flashcards.length) return prev;
      return {
        ...prev,
        flashcards: prev.flashcards.map((c, i) => (i === index ? updated : c)),
      };
    });
    setSavedSets((prev) => {
      if (!activeSetId) return prev;
      const next = prev.map((s) =>
        s.id === activeSetId
          ? { ...s, flashcards: s.flashcards.map((c, i) => (i === index ? updated : c)) }
          : s
      );
      saveSetsToStorage(next);
      return next;
    });
  }, [activeSetId]);

  // Phase 6B: a quiz question was answered wrong. Increment its missCount in
  // the view state and the matching saved set (same persistence path as SRS
  // ratings) — feeds the Weak Areas tab.
  const handleMissQuestion = useCallback((index: number) => {
    const bump = (q: QuizQuestion) => ({ ...q, missCount: (q.missCount ?? 0) + 1 });
    setResult((prev) => {
      if (!prev || index < 0 || index >= prev.quiz.length) return prev;
      return { ...prev, quiz: prev.quiz.map((q, i) => (i === index ? bump(q) : q)) };
    });
    setSavedSets((prev) => {
      if (!activeSetId) return prev;
      const next = prev.map((s) =>
        s.id === activeSetId ? { ...s, quiz: s.quiz.map((q, i) => (i === index ? bump(q) : q)) } : s
      );
      saveSetsToStorage(next);
      return next;
    });
  }, [activeSetId]);

  return (
  <AppShell
        savedSets={savedSets}
        activeSetId={activeSetId}
        onOpenSet={handleOpenSet}
        onNewSet={handleNewNotes}
        // Sidebar history renders from localStorage — server + first client
        // paint must agree (empty placeholder); real rows follow hydration
        isHydrated={hasMounted}
      >
      {status === "input" && (
        <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-3 px-2">
          <div>
            <h2 className="font-display text-2xl font-semibold text-text-primary hidden lg:block">
              Study Workspace
            </h2>
            <p className="text-sm text-text-secondary mt-1">
              Paste lecture notes — get a summary, flashcards &amp; a quiz
            </p>
          </div>
          {/* Compact controls — streak chip + stats and recent-sets popovers
              (see components/input-top-bar.tsx). Replaces the old right-side
              rail so the workspace owns the full column width. */}
          <InputTopBar
            streak={hasMounted ? streak : null}
            sets={hasMounted ? savedSets : []}
            onOpenSet={handleOpenSet}
            onDeleteSet={handleDeleteSet}
            onStartMixedPractice={() => router.push("/mixed-practice")}
          />
        </div>
      )}

      <div className="flex w-full flex-1 flex-col gap-4 overflow-hidden">
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
       {status === "result" && showSuccess && (
         <motion.div
           initial={{ opacity: 0, scale: 0.8 }}
           animate={{ opacity: 1, scale: 1 }}
           exit={{ opacity: 0, scale: 0.8 }}
           className="fixed inset-0 flex items-center justify-center pointer-events-none"
         >
           <Check size={48} className="text-success shadow-[0_0_12px_var(--color-accent-glow)]" />
         </motion.div>
       )}

      {status === "result" && result ? (
        /* Result screen — a full-width surface tile (same box as the old
           single-panel chrome, now one of several Bento tiles). flex column
           + min-h-0 keep NotesResult's internal scroll architecture intact. */
        <div className="flex min-h-0 flex-col rounded-xl border border-border bg-surface p-4 sm:p-6">
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">
              Your study material
            </h2>
            <div className="flex items-center gap-2">
              {/* Export — one click downloads a Word document (.doc). PDF and
                  Markdown options were removed per user decision; Word opens
                  everywhere students actually hand in work. */}
              <button
                onClick={() => {
                  const title = deriveTitle(lastNotes);
                  downloadWord(
                    `${title.replace(/[^\w\- ]/g, "").trim() || "study-notes"}.doc`,
                    studySetToWordHtml(result, title, Date.now())
                  );
                }}
                aria-label="Download study set as a Word document"
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Export</span>
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
          <NotesResult result={result} language={resultLanguage} title={deriveTitle(lastNotes)} sourceNotes={lastNotes} setId={activeSetId ?? undefined} onRateCard={handleRateCard} onMissQuestion={handleMissQuestion} />

          {/* Follow-up chat — collapsible so it doesn't crowd the tabs.
              key={lastNotes} forces a remount per study set: a conversation
              never bleeds into different notes.
              IMPORTANT: the panel stays MOUNTED while collapsed (CSS hidden,
              not conditionally rendered) — otherwise useChat's state would be
              destroyed on every toggle, killing an in-flight stream and the
              whole conversation. */}
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
            <div className={cn("flex h-[380px] flex-col border-t border-border", !chatOpen && "hidden")}>
              <NotesChat key={lastNotes} notes={lastNotes} />
            </div>
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
        </div>
      ) : (
        /* -----------------------------------------------------------------
           INPUT SCREEN
           A single full-width workspace tile (textarea + options + Generate)
           with the compact controls in the top bar above. flex + min-h-0
           keep NotesInput's stretched-layout architecture intact: the tile
           absorbs the available height and the textarea grows into it.
           ----------------------------------------------------------------- */
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col rounded-xl border border-border bg-surface p-4 sm:p-6">
            <NotesInput
              key={inputEpoch}
              onGenerate={handleGenerate}
              isGenerating={status === "generating"}
              initialNotes={lastNotes}
            />
          </div>
        </div>
      )}
    {/* ----------------------------------------------------------------- */}
      {/* Undo-delete toast — 8s window after a trash tap. Fixed, bottom-     */}
      {/* center, above everything; the mobile nav bar sits below it on the   */}
      {/* chat app, but this screen is reachable from both experiences.       */}
      {/* ----------------------------------------------------------------- */}
      <AnimatePresence>
        {undoToast && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            role="status"
            className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-border bg-surface-elevated px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
          >
            <p className="max-w-[60vw] truncate text-sm text-text-primary">
              Deleted "<span className="font-medium">{undoToast.title}</span>"
            </p>
            <button
              onClick={handleUndoDelete}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/25 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <Undo2 size={14} />
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </AppShell>
  );
}
