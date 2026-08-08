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
 * ============================================================================
 */

"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, FileText, Layers, ListChecks, Check, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_GENERATION_OPTIONS,
  type GenerationOptions,
  type QuizDifficulty,
  type OutputLanguage,
} from "@/types/notes";

// Mirrors NOTES_INPUT_LIMITS in lib/config.ts (server-only, not importable here).
const MIN_CHARS = 30;
const MAX_CHARS = 15000;

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
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface-elevated p-4"
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
              "inline-flex min-h-[32px] min-w-[32px] items-center justify-center rounded-lg px-3 py-2 text-xs transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-accent",
              "disabled:cursor-not-allowed disabled:opacity-50",
              value === c.value
                ? "bg-accent font-medium text-on-accent"
                : "bg-surface-elevated text-text-secondary hover:bg-border hover:text-text-primary"
            )}
          >
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

  const handleGenerate = () => {
    const trimmed = notes.trim();
    if (buttonState !== "ready") return;
    onGenerate(trimmed, options);
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
  const showEmptyState = charCount === 0 && !isGenerating;

  return (
    <div className="flex w-full flex-col gap-4">
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
            className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface px-4 py-8 text-center sm:px-8"
          >
            <h2 className="font-display text-2xl font-semibold leading-snug text-text-primary sm:text-3xl">
              Turn lecture notes into
              <br />
              <span className="text-accent">exam prep.</span>
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-text-secondary">
              Paste your notes below and get three study artifacts, grounded only
              in what you pasted — nothing invented.
            </p>
            <ul className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-3">
              <li className="flex items-center justify-center gap-2 rounded-lg bg-surface-elevated px-3 py-2.5">
                <FileText size={16} className="shrink-0 text-accent" />
                <span className="text-sm text-text-primary">Summary</span>
              </li>
              <li className="flex items-center justify-center gap-2 rounded-lg bg-surface-elevated px-3 py-2.5">
                <Layers size={16} className="shrink-0 text-accent" />
                <span className="text-sm text-text-primary">Flashcards</span>
              </li>
              <li className="flex items-center justify-center gap-2 rounded-lg bg-surface-elevated px-3 py-2.5">
                <ListChecks size={16} className="shrink-0 text-accent" />
                <span className="text-sm text-text-primary">Quiz</span>
              </li>
            </ul>
            <button
              onClick={() => setNotes(SAMPLE_NOTES)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20 focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <Wand2 size={15} />
              Try with sample notes
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------------------- */}
      {/* Textarea                                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="relative">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
          placeholder="Paste your lecture notes here… (Ctrl+Enter to generate)"
          aria-label="Lecture notes"
          className={cn(
            "w-full resize-y rounded-xl border bg-surface-elevated px-4 py-3 text-[15px] leading-relaxed text-text-primary",
            "placeholder:text-text-muted",
            "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all duration-200",
            "min-h-[220px] max-h-[50vh]",
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
      {isOverLimit && (
        <p className="text-xs text-danger">
          These notes are too long for one go — split them into smaller sections.
        </p>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Generation options — difficulty, counts, language                   */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-3">
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
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Generate button (3-state) — replaced by staged progress while       */}
      {/* generating, so the 4-5s wait reads as visible work                  */}
      {/* ----------------------------------------------------------------- */}
      {buttonState === "generating" ? (
        <GeneratingSteps />
      ) : (
        <motion.button
          onClick={handleGenerate}
          disabled={buttonState !== "ready"}
          className={cn(
            "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-medium transition-colors duration-200",
            "focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface",
            "disabled:cursor-not-allowed",
            buttonState === "idle" && "bg-surface-elevated text-text-muted",
            buttonState === "ready" && "bg-accent text-on-accent hover:bg-accent-hover"
          )}
          whileTap={buttonState === "ready" ? { scale: 0.98 } : {}}
          aria-label="Generate study material"
        >
          <span className="flex items-center gap-2">
            <Sparkles size={18} />
            Generate study material
          </span>
        </motion.button>
      )}
    </div>
  );
}
