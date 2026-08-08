/**
 * ============================================================================
 * FLASHCARDS VIEW
 * ============================================================================
 *
 * Interactive flip-card deck for the generated flashcards.
 *
 * The signature interaction of the Study Notes Buddy: the card is styled
 * like a paper index card (amber "highlighter" top edge) and flips in 3D
 * on click / Enter / Space. Prev/next arrows and arrow keys move through
 * the deck; flipping always resets when the card changes so the answer is
 * never spoiled.
 *
 * Accessibility: the card is a real <button> (focusable, keyboard-flippable)
 * with aria-label describing the current face. 3D flip uses transform only,
 * and globals.css collapses all animation under prefers-reduced-motion —
 * the card still flips, just instantly.
 * ============================================================================
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Flashcard } from "@/types/notes";

interface FlashcardsViewProps {
  flashcards: Flashcard[];
}

export function FlashcardsView({ flashcards }: FlashcardsViewProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const total = flashcards.length;
  const card = flashcards[index];

  const goTo = useCallback((next: number) => {
    setIndex(next);
    setFlipped(false); // never leak the answer of the next card
  }, []);

  const prev = useCallback(() => goTo(Math.max(0, index - 1)), [goTo, index]);
  const next = useCallback(() => goTo(Math.min(total - 1, index + 1)), [goTo, index, total]);

  // Arrow keys walk the deck — natural for a study tool used at a desk
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next]);

  if (!card) return null;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Progress */}
      <p className="text-xs text-text-muted">
        Card {index + 1} of {total} — click the card to flip
      </p>

      {/* ----------------------------------------------------------------- */}
      {/* Flip card — perspective wrapper + rotating inner, two faces         */}
      {/* ----------------------------------------------------------------- */}
      <div className="perspective-card w-full max-w-xl">
        <AnimatePresence mode="wait">
          <motion.button
            key={index}
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

      {/* ----------------------------------------------------------------- */}
      {/* Deck navigation                                                     */}
      {/* ----------------------------------------------------------------- */}
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
    </div>
  );
}
