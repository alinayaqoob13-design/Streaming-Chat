/**
 * ============================================================================
 * NOTES INPUT COMPONENT
 * ============================================================================
 *
 * The input screen of the AI Study Notes Buddy: a large textarea for pasted
 * lecture notes plus the Generate button.
 *
 * BUTTON STATE MACHINE (3 states, mirroring the chat input's philosophy):
 * 1. IDLE:       Fewer than MIN_CHARS characters → button disabled + hint
 * 2. READY:      Enough text → accent button, "Generate study material"
 * 3. GENERATING: API call in flight → spinner, textarea locked
 *
 * Why client-side length checks: the API route validates again (defense in
 * depth), but catching it here saves a round trip and lets us show inline
 * hints. The MIN/MAX constants mirror NOTES_INPUT_LIMITS in lib/config.ts —
 * that file is server-only (reads process.env) so it cannot be imported here.
 *
 * Empty state: when the textarea is empty, a guidance card shows the three
 * artifacts the student will get, so the screen never looks blank or broken.
 * A mini-preview (mock flashcard + quiz question) gives users a visual hint
 * of what the generated output will look like.
 *
 * SMART DEFAULTS (Phase 5): difficulty and language are persisted to
 * localStorage so returning users don't have to reselect every time.
 *
 * FILE IMPORT (Phase 5.5): the Import file button reads .txt/.md via
 * FileReader and text-based PDFs via lazily-loaded pdfjs-dist — all local,
 * zero tokens, nothing uploaded. Imported text flows through the same
 * textarea validation as pasted notes.
 * ============================================================================
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { Sparkles, Loader2, FileText, Layers, ListChecks, Check, Wand2, RotateCcw, Upload, ClipboardPaste, ChevronRight, BarChart3, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractTextFromFile, ACCEPTED_FILE_TYPES } from "@/lib/file-import";
import {
  DEFAULT_GENERATION_OPTIONS,
  type GenerationOptions,
  type QuizDifficulty,
  type OutputLanguage,
} from "@/types/notes";

// Mirrors NOTES_INPUT_LIMITS in lib/config.ts (server-only, not importable here).
const MIN_CHARS = 30;
const MAX_CHARS = 15000;

// ---------------------------------------------------------------------------
// SMART DEFAULTS — Phase 5
// ---------------------------------------------------------------------------
// Persist difficulty + language so returning users keep their preferences.
// Flashcard/quiz counts are less "personal" and reset to defaults each session.
const PREFERENCES_KEY = "capstone-notes-preferences";

interface SavedPreferences {
  difficulty?: QuizDifficulty;
  language?: OutputLanguage;
}

function loadPreferences(): Partial<GenerationOptions> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY);
    if (!stored) return {};
    const parsed: SavedPreferences = JSON.parse(stored);
    const result: Partial<GenerationOptions> = {};
    if (["easy", "medium", "hard"].includes(parsed.difficulty as string)) {
      result.difficulty = parsed.difficulty;
    }
    if (["en", "ur"].includes(parsed.language as string)) {
      result.language = parsed.language;
    }
    return result;
  } catch {
    return {};
  }
}

function savePreferences(difficulty: QuizDifficulty, language: OutputLanguage) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({ difficulty, language } satisfies SavedPreferences)
    );
  } catch {
    // Storage full or unavailable — fail silently
  }
}

// One-click demo notes — lets anyone (including an examiner) try the app
// without hunting for text to paste.
const SAMPLE_NOTES = `Operating Systems — Lecture 7: Processes and Threads

A process is a program in execution. Each process has its own address space containing the code, data, heap, and stack segments. The OS manages processes using a Process Control Block (PCB), which stores the process ID, program counter, register values, and scheduling information.

Process states: New, Ready, Running, Waiting, and Terminated. A context switch saves the state of one process into its PCB and loads another; it is pure overhead.

Threads are lightweight execution units within a process. Threads share code, data, and heap, but each has its own stack and registers — making thread switching much cheaper than process switching.

Multithreading benefits: responsiveness, resource sharing, economy, and scalability on multi-core systems.`;

// Steps shown while Gemini works — turns a 4-5s wait into visible progress
const GENERATING_STEPS = [
  "Reading your notes",
  "Writing the summary",
  "Building flashcards",
  "Creating the quiz",
];

/** Staged progress indicator for the generating state. Purely cosmetic —
    timing is illustrative, the API resolves whenever it resolves. */
function GeneratingSteps() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setCurrent((c) => Math.min(c + 1, GENERATING_STEPS.length - 1)),
      1300
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <motion.ul
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-surface-elevated p-4 animate-pulse",
        "transition-colors"
      )}
      aria-live="polite"
      aria-label="Generation progress"
    >
      {GENERATING_STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-2.5 text-sm">
          {i < current ? (
            <Check size={15} className="shrink-0 text-success" />
          ) : i === current ? (
            <Loader2 size={15} className="shrink-0 animate-spin text-accent" />
          ) : (
            <span className="h-[15px] w-[15px] shrink-0 rounded-full border border-border" />
          )}
          <span className={i <= current ? "text-text-primary" : "text-text-muted"}>
            {step}
            {i === current ? "…" : ""}
          </span>
        </li>
      ))}
    </motion.ul>
  );
}

// ---------------------------------------------------------------------------
// SAMPLE PREVIEW — Phase 5
// ---------------------------------------------------------------------------
// A purely visual mini-preview showing what the generated output looks like.
// Helps first-time users understand the value before pasting their notes.
//
// Phase 9: the Summary/Flashcards/Quiz buttons above (ARTIFACT_TABS) select
// an active artifact — the matching card scales up + gains an accent border
// while the other two dim to 60%. Purely informational: the selection never
// touches the compose view's options state.

type ArtifactKind = "summary" | "flashcards" | "quiz";

const ARTIFACT_TABS: { kind: ArtifactKind; label: string; icon: typeof FileText }[] = [
  { kind: "summary", label: "Summary", icon: FileText },
  { kind: "flashcards", label: "Flashcards", icon: Layers },
  { kind: "quiz", label: "Quiz", icon: ListChecks },
];

function SamplePreview({ active }: { active: ArtifactKind | null }) {
  const [flipped, setFlipped] = useState(false);

  // Emphasis classes shared by every preview card: the selected one scales
  // up and picks up the accent glow, unselected cards dim. CSS transitions
  // (with motion-reduce opt-out) keep this lightweight and accessible.
  const cardClass = (kind: ArtifactKind) =>
    cn(
      "transition-all duration-200 motion-reduce:transition-none",
      active === kind
        ? "scale-[1.02] border-accent/60 shadow-[0_0_12px_var(--color-accent-glow)]"
        : active === null
          ? "opacity-100"
          : "opacity-60"
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="flex w-full max-w-lg flex-col gap-3"
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted text-center">
        Preview — what you&apos;ll get
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* --- Mini summary (Phase 9) — third artifact card so every button
            above has a matching preview. Static like the quiz card. --- */}
        <div
          aria-label="Summary preview"
          className={cn(
            "flex min-h-[100px] flex-col gap-2 rounded-xl border border-border bg-surface-elevated p-4 text-left",
            cardClass("summary")
          )}
        >
          <div className="flex items-center gap-1.5">
            <FileText size={14} className="text-accent" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Summary
            </span>
          </div>
          <p className="text-xs font-medium leading-relaxed text-text-primary line-clamp-2">
            Hash tables use key-value pairs for O(1) average lookups — ideal
            for fast data retrieval.
          </p>
        </div>

        {/* --- Mini flashcard --- */}
        <button
          onClick={() => setFlipped((f) => !f)}
          aria-label={flipped ? "Show flashcard front" : "Flip flashcard"}
          className={cn(
            "group relative flex min-h-[100px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated p-4 text-center hover:border-accent/40 hover:shadow-[0_0_12px_var(--color-accent-glow)]",
            cardClass("flashcards")
          )}
        >
          <Layers size={14} className="text-accent" />
          <AnimatePresence mode="wait">
            {flipped ? (
              <motion.div
                key="back"
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <p className="text-xs leading-relaxed text-text-primary">
                  A data structure that stores key-value pairs and uses a hash function for O(1) average lookups.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="front"
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <p className="text-sm font-medium text-text-primary">
                  What is a Hash Table?
                </p>
                <p className="mt-1 text-[10px] text-text-muted">
                  tap to flip
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <RotateCcw
            size={10}
            className="absolute bottom-2 right-2 text-text-muted opacity-0 transition-opacity group-hover:opacity-60"
          />
        </button>

        {/* --- Mini quiz question --- */}
        <div
          aria-label="Quiz preview"
          className={cn(
            "flex min-h-[100px] flex-col gap-2 rounded-xl border border-border bg-surface-elevated p-4",
            cardClass("quiz")
          )}
        >
          <div className="flex items-center gap-1.5">
            <ListChecks size={14} className="text-accent" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
              Quiz
            </span>
          </div>
          <p className="text-xs font-medium text-text-primary">
            Which sorting algorithm has the best average-case time complexity?
          </p>
          <div className="flex flex-wrap gap-1">
            {["Bubble Sort", "Merge Sort", "Selection Sort", "Insertion Sort"].map(
              (opt, i) => (
                <span
                  key={opt}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px]",
                    i === 1
                      ? "bg-accent/20 font-semibold text-accent"
                      : "bg-surface text-text-muted"
                  )}
                >
                  {opt}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* --- How it works (Phase 9) — compact informational strip for
          first-time users. Purely static; no interactivity. Arrows only on
          sm+ where the row is horizontal; mobile stacks vertically. --- */}
      <div className="flex flex-col items-center gap-2 text-[11px] text-text-muted sm:flex-row sm:justify-center sm:gap-2.5">
        <span className="inline-flex items-center gap-1.5">
          <ClipboardPaste size={16} className="shrink-0 text-accent/80" aria-hidden />
          Paste your notes
        </span>
        <ChevronRight size={12} className="hidden shrink-0 text-text-muted/70 sm:inline" aria-hidden />
        <span className="inline-flex items-center gap-1.5">
          <Sparkles size={16} className="shrink-0 text-accent/80" aria-hidden />
          AI generates study material
        </span>
        <ChevronRight size={12} className="hidden shrink-0 text-text-muted/70 sm:inline" aria-hidden />
        <span className="inline-flex items-center gap-1.5">
          <BarChart3 size={16} className="shrink-0 text-accent/80" aria-hidden />
          Study &amp; track progress
        </span>
      </div>
    </motion.div>
  );
}

// Chip choices — the route clamps anything outside the schema bounds anyway
const DIFFICULTY_CHOICES: { value: QuizDifficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];
const FLASHCARD_CHOICES = [5, 8, 12];
const QUIZ_CHOICES = [3, 5, 8];
const LANGUAGE_CHOICES: { value: OutputLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ur", label: "اردو" },
];

type ButtonState = "idle" | "ready" | "generating";

interface NotesInputProps {
  /** Called with the trimmed notes + chosen options when the student hits Generate */
  onGenerate: (notes: string, options: GenerationOptions) => void;
  /** True while the API call is in flight */
  isGenerating: boolean;
  /** Pre-fill text — used to restore the notes after a failed generation */
  initialNotes?: string;
}

/** One labeled row of single-select chips (difficulty, counts, language) */
function OptionChips<T extends string | number>({
  label,
  choices,
  value,
  onChange,
  disabled,
}: {
  label: string;
  choices: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] font-medium uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {choices.map((c) => (
          <button
            key={String(c.value)}
            role="radio"
            aria-checked={value === c.value}
            onClick={() => onChange(c.value)}
            disabled={disabled}
            className={cn(
              "press inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              "disabled:cursor-not-allowed disabled:opacity-50",
              value === c.value
                ? "bg-accent font-semibold text-on-accent border-2 border-accent shadow-[0_0_12px_var(--color-accent-glow)]"
                : "border-2 border-transparent bg-surface-elevated text-text-secondary hover:bg-border hover:text-text-primary"
            )}
          >
            {value === c.value && <Check size={14} className="shrink-0" />}
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function NotesInput({
  onGenerate,
  isGenerating,
  initialNotes = "",
}: NotesInputProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [options, setOptions] = useState<GenerationOptions>(DEFAULT_GENERATION_OPTIONS);
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  // Smart defaults: load persisted preferences on mount (hydration-safe)
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  // ---- Compose-mode state ---------------------------------------------------
  // Hero mode (landing card + empty textarea) gives way to compose mode on
  // the first meaningful interaction — typing, the sample-notes button, or a
  // file import. Once entered, compose mode STAYS (clearing the textarea
  // won't pop the hero back up, so nothing flickers on every backspace).
  // Mounting with notes already present (e.g. error-retry restore) starts
  // directly in compose mode.
  const [hasComposed, setHasComposed] = useState(() => initialNotes.trim().length > 0);
  useEffect(() => {
    if (notes.trim().length > 0) {
      setHasComposed(true);
      setHasUnsavedNotes(true);
    } else {
      // If textarea is cleared while in compose mode and user hasn't generated,
      // they can go back to hero without confirmation (empty draft)
      setHasUnsavedNotes(false);
    }
  }, [notes]);

  // ---- Hero preview selection (Phase 9) ------------------------------------
  // Purely visual: which artifact button is highlighted and which preview
  // card is emphasized. Independent of the compose-view options state.
  const [activeArtifact, setActiveArtifact] = useState<ArtifactKind | null>(null);

  // ---- Compose-back state (Phase 9/10) ------------------------------------
  // Tracks whether the user has unsaved notes in the textarea while in compose mode.
  // When the user clicks "Back to Home", if there are unsaved notes we ask for
  // confirmation before discarding the draft. The textarea value is always preserved
  // in local state, so re-entering compose mode later recovers the draft.
  const [hasUnsavedNotes, setHasUnsavedNotes] = useState(false);

  // ---- File import state ---------------------------------------------------
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Read a chosen file into the textarea — .txt/.md instantly, PDFs via the
  // lazily-loaded pdfjs parser. The textarea's existing MIN/MAX validation
  // takes it from there (importing past the limit shows the red counter).
  const handleImportFile = useCallback(async (file: File) => {
    setImporting(true);
    setImportError(null);
    try {
      const text = await extractTextFromFile(file);
      if (!text.trim()) {
        setImportError("Couldn't read any text from that file — try a .txt, .md, or a text-based PDF.");
        return;
      }
      setNotes(text);
    } catch {
      setImportError("Couldn't open that file. Something went wrong while reading it.");
    } finally {
      setImporting(false);
    }
  }, []);

  // Load saved preferences on mount — difficulty and language only
  useEffect(() => {
    const saved = loadPreferences();
    if (Object.keys(saved).length > 0) {
      setOptions((prev) => ({ ...prev, ...saved }));
    }
    setPrefsLoaded(true);
  }, []);

  // Persist preferences whenever difficulty or language changes (after initial load)
  useEffect(() => {
    if (!prefsLoaded) return;
    savePreferences(options.difficulty, options.language);
  }, [options.difficulty, options.language, prefsLoaded]);

  // Keep the button state derived from the text + generation status —
  // a single source of truth instead of syncing two useState calls by hand.
  useEffect(() => {
    if (isGenerating) {
      setButtonState("generating");
    } else if (notes.trim().length >= MIN_CHARS && notes.length <= MAX_CHARS) {
      setButtonState("ready");
    } else {
      setButtonState("idle");
    }
  }, [notes, isGenerating]);

  const handleGenerate = useCallback(() => {
    const trimmed = notes.trim();
    if (buttonState !== "ready") return;
    onGenerate(trimmed, options);
  }, [notes, buttonState, onGenerate, options]);

  // Back to hero (Phase 11). The draft is only discarded AFTER the user
  // confirms; with an empty draft (e.g. came in via sample notes) it is
  // instant. Clearing the text is what reliably brings the hero back —
  // showEmptyState requires charCount === 0.
  const handleBackToHero = () => {
    if (hasUnsavedNotes && !window.confirm("You have unsaved notes — go back anyway?")) {
      return;
    }
    setNotes("");
    setHasComposed(false);
    setHasUnsavedNotes(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl/Cmd + Enter generates — a paste-heavy workflow deserves a shortcut
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const charCount = notes.length;
  const isOverLimit = charCount > MAX_CHARS;
  // Hero shows only while the textarea is empty AND compose mode was never
  // entered — cleared notes don't bring the hero back (see hasComposed).
  // "Back to Home" is the explicit escape hatch: after a confirm (when the
  // draft is non-empty) it clears the draft and resets both flags, which is
  // what makes the hero return (see handleBackToHero).
  const showEmptyState =
    charCount === 0 && !isGenerating && !hasComposed && !hasUnsavedNotes;

  // -------------------------------------------------------------------------
  // COMPOSE REVEAL — hero → compose choreography (Phase 8)
  // -------------------------------------------------------------------------
  // The hero card collapses upward (AnimatePresence exit, 0.25s) while the
  // options chips and Generate button rise into focus, staggered ~0.5s in
  // total. Reduced-motion users get a plain instant reveal.
  const reduceMotion = useReducedMotion();
  const composeReveal: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { delayChildren: 0.05, staggerChildren: 0.07 } },
  };
  const composeItem: Variants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] } },
  };

  // flex-1: inside the stretched bento tile, the input column claims the full
  // tile height so the textarea below can grow into it (see Textarea block).
  return (
    <div className="flex w-full flex-1 flex-col gap-4">
      {/* ----------------------------------------------------------------- */}
      {/* Hero empty state — the first impression. Serif headline, what the   */}
      {/* tool produces, and a one-click sample so anyone can try it instantly*/}
      {/* ----------------------------------------------------------------- */}
      <AnimatePresence>
        {showEmptyState && (
<motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="relative flex flex-col items-center gap-4 overflow-hidden rounded-xl border border-border bg-surface px-4 py-8 text-center sm:px-8"
            >
              {/* --- Ambient background animation (Phase 11) — accent-tinted
                  blobs drifting on pure-transform keyframes (blob1/2/3 in
                  globals.css). Reduced-motion freezes them as a static tint.
                  The hero is `relative` so these never escape the card. --- */}
              <div
                aria-hidden
                className="blob-anim absolute inset-0 overflow-hidden pointer-events-none"
              >
                <div
                  className="blob-1 absolute -top-6 -left-6 w-48 h-48 rounded-full blur-3xl opacity-50"
                />
                <div
                  className="blob-2 absolute -bottom-6 -right-6 w-64 h-64 rounded-full blur-3xl opacity-40"
                />
                <div
                  className="blob-3 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full blur-2xl opacity-30"
                />
              </div>

              {/* Content wrapper — positioned so it always paints above the blobs */}
              <div className="relative z-10 flex flex-col items-center gap-4">
              <h2 className="font-display text-2xl font-semibold leading-snug text-text-primary sm:text-3xl">
                Turn lecture notes into
                <br />
                <span className="text-accent">exam prep.</span>
              </h2>
            <div
              role="group"
              aria-label="Choose an artifact preview"
              className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-3"
            >
              {ARTIFACT_TABS.map(({ kind, label, icon: Icon }) => {
                const isActive = activeArtifact === kind;
                return (
                  <button
                    key={kind}
                    onClick={() =>
                      setActiveArtifact((prev) => (prev === kind ? null : kind))
                    }
                    aria-pressed={isActive}
                    className={cn(
                      "press inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      isActive
                        ? "border-2 border-accent bg-accent font-semibold text-on-accent shadow-[0_0_12px_var(--color-accent-glow)]"
                        : "border-2 border-transparent bg-surface-elevated text-text-secondary hover:bg-border hover:text-text-primary"
                    )}
                  >
                    <Icon size={16} className={cn("shrink-0", !isActive && "text-accent")} />
                    {label}
                  </button>
                );
              })}
            </div>

            <p className="max-w-md text-sm leading-relaxed text-text-secondary pt-4">
              Paste your notes below and get three study artifacts, grounded only
              in what you pasted — nothing invented.
            </p>

            {/* --- Sample preview (Phase 5/9) — cards respond to the artifact
                buttons above via the active prop --- */}
            <SamplePreview active={activeArtifact} />

            <button
              onClick={() => {
                setNotes(SAMPLE_NOTES);
                setHasUnsavedNotes(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Wand2 size={15} />
              Try with sample notes
            </button>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------------------- */}
      {/* Import row — paste, or pull text straight from a local file.         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] text-text-muted">
          Paste your lecture notes below, or import a file
        </span>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isGenerating || importing}
          aria-label="Import notes from a file"
          className={cn(
            "inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-accent",
            isGenerating || importing
              ? "cursor-not-allowed bg-surface-elevated text-text-muted"
              : "bg-surface-elevated text-text-primary hover:bg-border"
          )}
        >
          {importing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <Upload size={13} />
          )}
          {importing ? "Importing…" : "Import file"}
        </button>
        {/* Hidden picker — the visible button triggers it; choice is reset so
            reopening the picker for the same file still fires onChange */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Textarea — flex-1 makes it the primary workspace: the tile above
          stretches with the page (see NotesBuddy's bento grid) and the
          textarea absorbs the leftover height, capped at 60dvh so it never
          swallows the whole screen. `h-full` keeps the char counter anchored
          while the box grows, and the page (not a nested scroll) handles
          whatever exceeds the cap.                                    */}
      {/* ----------------------------------------------------------------- */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          placeholder="Paste your lecture notes here… (Ctrl+Enter to generate)"
          aria-label="Lecture notes"
          className={cn(
            "w-full flex-1 resize-y rounded-xl border bg-surface-elevated px-4 py-3 text-[15px] leading-relaxed text-text-primary",
            "placeholder:text-text-muted",
            "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all duration-200 transition-height",
            "min-h-[220px] max-h-[60dvh]",
            isOverLimit ? "border-danger" : "border-border"
          )}
        />
        {/* Character counter — turns red past the API limit */}
        <span
          className={cn(
            "absolute bottom-2 right-3 text-[10px] transition-opacity",
            charCount > 0 ? "opacity-100" : "opacity-0",
            isOverLimit ? "text-danger" : "text-text-muted"
          )}
        >
          {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
        </span>
      </div>

      {/* Inline hint: why the button is disabled */}
      {charCount > 0 && notes.trim().length < MIN_CHARS && !isGenerating && (
        <p className="text-xs text-text-muted">
          Add a little more — at least {MIN_CHARS} characters make useful study material.
        </p>
      )}
      {/* Compose mode with an empty textarea (e.g. cleared after going back):
          without this the Generate button just sits there dead with no reason */}
      {hasComposed && charCount === 0 && !isGenerating && (
        <p className="text-xs text-text-muted">
          Paste or type your notes above — at least {MIN_CHARS} characters unlock Generate.
        </p>
      )}
      {isOverLimit && (
        <p className="text-xs text-danger">
          These notes are too long for one go — split them into smaller sections.
        </p>
      )}
      {importError && (
        <p role="alert" className="text-xs text-danger">
          {importError}
        </p>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Compose reveal — options chips + Generate button. Mounted only in   */}
      {/* compose mode, so the hero → compose flip staggers them into focus   */}
      {/* (see composeReveal/composeItem above). Hidden during hero mode so   */}
      {/* the landing stays clean: hero card + empty textarea.                */}
      {/* ----------------------------------------------------------------- */}
      {hasComposed && (
        <motion.div
          variants={composeReveal}
          initial={reduceMotion ? false : "hidden"}
          animate="show"
          className="flex flex-col gap-4"
        >
          {/* --- Back to hero affordance (Phase 11) — a real <button> for
              keyboard/screen-reader access. With unsaved notes it asks once
              via confirm; on confirm the draft is cleared so the hero view
              reliably returns (showEmptyState requires charCount === 0).
              Hidden while generating so it never interrupts the API call. --- */}
          {!isGenerating && (
            <button
              type="button"
              onClick={handleBackToHero}
              className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 self-start rounded text-[11px] text-text-muted transition-colors hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <ChevronLeft size={16} className="shrink-0" />
              Back to Home
            </button>
          )}
          {/* --- Generation options — difficulty, counts, language --- */}
          <motion.div
            variants={composeItem}
            className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-3"
          >
            <OptionChips
              label="Difficulty"
              choices={DIFFICULTY_CHOICES}
              value={options.difficulty}
              onChange={(difficulty) => setOptions((o) => ({ ...o, difficulty }))}
              disabled={isGenerating}
            />
            <OptionChips
              label="Flashcards"
              choices={FLASHCARD_CHOICES.map((n) => ({ value: n, label: String(n) }))}
              value={options.flashcardCount}
              onChange={(flashcardCount) => setOptions((o) => ({ ...o, flashcardCount }))}
              disabled={isGenerating}
            />
            <OptionChips
              label="Quiz"
              choices={QUIZ_CHOICES.map((n) => ({ value: n, label: String(n) }))}
              value={options.quizCount}
              onChange={(quizCount) => setOptions((o) => ({ ...o, quizCount }))}
              disabled={isGenerating}
            />
            <OptionChips
              label="Language"
              choices={LANGUAGE_CHOICES}
              value={options.language}
              onChange={(language) => setOptions((o) => ({ ...o, language }))}
              disabled={isGenerating}
            />
          </motion.div>

          {/* ----------------------------------------------------------- */}
          {/* Generate button (3-state) — replaced by staged progress       */}
          {/* while generating, so the wait reads as visible work            */}
          {/* ----------------------------------------------------------- */}
          {buttonState === "generating" ? (
            <GeneratingSteps />
          ) : (
            <motion.div variants={composeItem}>
              <motion.button
                onClick={handleGenerate}
                disabled={buttonState !== "ready"}
                whileTap={buttonState === "ready" ? { scale: 0.98 } : {}}
                whileHover={buttonState === "ready" ? { scale: 1.01 } : {}}
                className={cn(
                  "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-medium transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  "disabled:cursor-not-allowed",
                  // Idle: bordered + slightly brighter text so the button reads
                  // as "disabled but alive", not dead. Ready: persistent soft
                  // glow so the primary action visibly switches on.
                  buttonState === "idle" && "border border-border bg-surface-elevated text-text-secondary opacity-80",
                  buttonState === "ready" && "bg-accent text-on-accent shadow-[0_0_18px_var(--color-accent-glow)] hover:bg-accent-hover hover:shadow-[0_0_24px_var(--color-accent-glow)]"
                )}
                aria-label="Generate study material"
              >
                <span className="flex items-center gap-2">
                  <Sparkles size={18} />
                  Generate study material
                </span>
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
