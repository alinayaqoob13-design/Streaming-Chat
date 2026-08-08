/**
 * ============================================================================
 * FLASHCARDS VIEW — BROWSE + PRACTICE MODES
 * ============================================================================
 *
 * Two ways to use the generated deck:
 *
 * BROWSE (default): the flip-card deck from Day 3 — click to flip, arrows /
 * arrow keys to move, dot navigation.
 *
 * PRACTICE: an active-recall session inspired by Quizlet's Learn mode and
 * Anki (see research: spacerep.app, flashrecall.app/blog/anki-and-quizlet):
 * - The deck is shuffled
 * - The student flips the card, then honestly marks "Know it" or
 *   "Still learning" — buttons stay disabled until the card is flipped,
 *   so a mark always follows a recall attempt
 * - Missed cards are re-queued ONCE at the end of the session (a gentle
 *   nod to spaced repetition without a full SM-2 scheduler)
 * - The session ends with a score screen: full-deck restart, missed-only
 *   review, or back to browse
 *
 * Entirely client-side: practice costs no tokens and works offline.
 * ============================================================================
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCw, Check, X, GraduationCap, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Flashcard } from "@/types/notes";

interface FlashcardsViewProps {
  flashcards: Flashcard[];
}

type Mode = "browse" | "practice" | "done";

function shuffledIndices(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function FlashcardsView({ flashcards }: FlashcardsViewProps) {
  // ---- Browse state -------------------------------------------------------
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // ---- Practice state -----------------------------------------------------
  const [mode, setMode] = useState<Mode>("browse");
  const [queue, setQueue] = useState<number[]>([]);
  const [pointer, setPointer] = useState(0);
  const [known, setKnown] = useState<number[]>([]);
  const [missed, setMissed] = useState<number[]>([]);
  // Cards already re-queued once — prevents an endless loop on repeat misses
  const [requeued, setRequeued] = useState<number[]>([]);

  const total = flashcards.length;

  // Which card is on screen right now, in either mode
  const currentIndex = mode === "browse" ? index : queue[pointer];
  const card = flashcards[currentIndex];

  const goTo = useCallback((next: number) => {
    setIndex(next);
    setFlipped(false); // never leak the answer of the next card
  }, []);

  const prev = useCallback(() => goTo(Math.max(0, index - 1)), [goTo, index]);
  const next = useCallback(() => goTo(Math.min(total - 1, index + 1)), [goTo, index, total]);

  // Arrow keys walk the deck in browse mode — in practice mode the student's
  // answer buttons drive the session instead
  useEffect(() => {
    if (mode !== "browse") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, mode]);

  // ---- Practice actions ---------------------------------------------------

  const startPractice = useCallback((indices?: number[]) => {
    setQueue(indices ?? shuffledIndices(total));
    setPointer(0);
    setKnown([]);
    setMissed([]);
    setRequeued([]);
    setFlipped(false);
    setMode("practice");
  }, [total]);

  const exitPractice = useCallback(() => {
    setMode("browse");
    setFlipped(false);
  }, []);

  const mark = useCallback(
    (result: "known" | "missed") => {
      const cardIdx = queue[pointer];
      if (result === "known") {
        setKnown((k) => (k.includes(cardIdx) ? k : [...k, cardIdx]));
      } else {
        setMissed((m) => (m.includes(cardIdx) ? m : [...m, cardIdx]));
        // Re-queue once: see this card again at the end of the session
        if (!requeued.includes(cardIdx)) {
          setQueue((q) => [...q, cardIdx]);
          setRequeued((r) => [...r, cardIdx]);
        }
      }
      setFlipped(false);
      const nextPointer = pointer + 1;
      if (nextPointer >= queue.length + (result === "missed" && !requeued.includes(cardIdx) ? 1 : 0)) {
        setMode("done");
      } else {
        setPointer(nextPointer);
      }
    },
    [queue, pointer, requeued]
  );

  if (!card) return null;

  const missedCount = missed.length;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* ----------------------------------------------------------------- */}
      {/* Mode header                                                         */}
      {/* ----------------------------------------------------------------- */}
      {mode === "browse" ? (
        <>
          <p className="text-xs text-text-muted">
            Card {index + 1} of {total} — click the card to flip
          </p>
          <button
            onClick={() => startPractice()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <GraduationCap size={15} />
            Practice this deck
          </button>
        </>
      ) : mode === "practice" ? (
        <div className="flex w-full max-w-xl items-center justify-between">
          <p className="text-xs text-text-muted" aria-live="polite">
            {pointer + 1} of {queue.length} ·{" "}
            <span className="text-success">{known.length} known</span> ·{" "}
            <span className="text-danger">{missedCount} missed</span>
          </p>
          <button
            onClick={exitPractice}
            className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary focus:outline-none focus:underline"
          >
            <Undo2 size={12} />
            Exit practice
          </button>
        </div>
      ) : null}

      {/* ----------------------------------------------------------------- */}
      {/* Session complete                                                    */}
      {/* ----------------------------------------------------------------- */}
      {mode === "done" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-border bg-surface-elevated p-8 text-center"
        >
          <GraduationCap size={32} className="text-accent" />
          <div>
            <p className="font-display text-2xl font-semibold text-text-primary">
              {known.length} of {total} known
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {missedCount === 0
                ? "Perfect session — every card recalled."
                : `${missedCount} card${missedCount === 1 ? "" : "s"} still need work. Missed cards were shown twice.`}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {missedCount > 0 && (
              <button
                onClick={() => startPractice(missed)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent"
              >
                Review {missedCount} missed
              </button>
            )}
            <button
              onClick={() => startPractice()}
              className="rounded-lg bg-surface px-4 py-2.5 text-sm text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Practice full deck
            </button>
            <button
              onClick={exitPractice}
              className="rounded-lg bg-surface px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-border hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Back to browse
            </button>
          </div>
        </motion.div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Flip card — shared by browse and practice                           */}
      {/* ----------------------------------------------------------------- */}
      {mode !== "done" && (
        <div className="perspective-card w-full max-w-xl">
          <AnimatePresence mode="wait">
            <motion.button
              key={`${mode}-${currentIndex}-${pointer}`}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.18 }}
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? `Answer: ${card.back}` : `Flashcard: ${card.front}. Activate to reveal the answer.`}
              className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl"
            >
              <motion.div
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                className="preserve-3d relative h-64 w-full sm:h-72"
              >
                {/* Front — the question/term */}
                <div className="card-face absolute inset-0 flex flex-col rounded-2xl border border-border bg-surface-elevated p-6">
                  <span className="h-1.5 w-16 rounded-full bg-accent" aria-hidden="true" />
                  <span className="mt-3 text-[10px] font-medium uppercase tracking-widest text-text-muted">
                    Question
                  </span>
                  <span className="flex flex-1 items-center justify-center overflow-y-auto">
                    <span className="font-display text-lg font-medium leading-relaxed text-text-primary sm:text-xl">
                      {card.front}
                    </span>
                  </span>
                  <RotateCw size={14} className="self-end text-text-muted" aria-hidden="true" />
                </div>

                {/* Back — the answer, pre-rotated so it reads correctly */}
                <div className="card-face absolute inset-0 flex flex-col rounded-2xl border border-accent/40 bg-user-bubble p-6 [transform:rotateY(180deg)]">
                  <span className="h-1.5 w-16 rounded-full bg-accent" aria-hidden="true" />
                  <span className="mt-3 text-[10px] font-medium uppercase tracking-widest text-accent">
                    Answer
                  </span>
                  <span className="flex flex-1 items-center justify-center overflow-y-auto">
                    <span className="text-base leading-relaxed text-text-primary sm:text-lg">
                      {card.back}
                    </span>
                  </span>
                  <RotateCw size={14} className="self-end text-text-muted" aria-hidden="true" />
                </div>
              </motion.div>
            </motion.button>
          </AnimatePresence>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Practice answer buttons — enabled only AFTER a recall attempt       */}
      {/* ----------------------------------------------------------------- */}
      {mode === "practice" && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => mark("missed")}
            disabled={!flipped}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-danger",
              flipped
                ? "bg-danger/15 text-danger hover:bg-danger/25"
                : "cursor-not-allowed bg-surface-elevated text-text-muted"
            )}
          >
            <X size={16} />
            Still learning
          </button>
          <button
            onClick={() => mark("known")}
            disabled={!flipped}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-success",
              flipped
                ? "bg-success/15 text-success hover:bg-success/25"
                : "cursor-not-allowed bg-surface-elevated text-text-muted"
            )}
          >
            <Check size={16} />
            Know it
          </button>
        </div>
      )}
      {mode === "practice" && !flipped && (
        <p className="-mt-2 text-[11px] text-text-muted">
          Flip the card first, then mark honestly
        </p>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Browse navigation                                                   */}
      {/* ----------------------------------------------------------------- */}
      {mode === "browse" && (
        <div className="flex items-center gap-3">
          <button
            onClick={prev}
            disabled={index === 0}
            aria-label="Previous card"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-accent",
              index === 0
                ? "cursor-not-allowed text-text-muted"
                : "bg-surface-elevated text-text-primary hover:bg-border"
            )}
          >
            <ChevronLeft size={18} />
          </button>

          {/* Dot indicators — also direct navigation */}
          <div className="flex items-center gap-1.5">
            {flashcards.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to card ${i + 1}`}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-accent",
                  i === index ? "w-5 bg-accent" : "w-1.5 bg-border hover:bg-text-muted"
                )}
              />
            ))}
          </div>

          <button
            onClick={next}
            disabled={index === total - 1}
            aria-label="Next card"
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-accent",
              index === total - 1
                ? "cursor-not-allowed text-text-muted"
                : "bg-surface-elevated text-text-primary hover:bg-border"
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
