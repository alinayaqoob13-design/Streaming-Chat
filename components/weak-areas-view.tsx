/**
 * ============================================================================
 * WEAK AREAS VIEW — PHASE 6B
 * ============================================================================
 *
 * The "Needs review" panel behind the Weak Areas tab. Purely read-only: it
 * aggregates missCount already recorded on the flashcards and quiz questions
 * (rated "Again" in SRS study mode, or answered wrong in the quiz), shows
 * them sorted by most-missed first, and lets the student jump straight back
 * to a specific card or question to review it.
 *
 * Grouping is by the item itself (front/question text) — artifacts have no
 * topic field, so no AI inference happens here; that is out of scope.
 * ============================================================================
 */

"use client";

import { motion } from "framer-motion";
import { Layers, ListChecks, ArrowRight, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { collectWeakAreas } from "@/lib/weak-areas";
import type { Flashcard, QuizQuestion } from "@/types/notes";

interface WeakAreasViewProps {
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
  /** Open the flashcards tab on that card */
  onJumpToCard: (index: number) => void;
  /** Open the quiz tab scroll/highlighted on that question */
  onJumpToQuestion: (index: number) => void;
}

export function WeakAreasView({ flashcards, quiz, onJumpToCard, onJumpToQuestion }: WeakAreasViewProps) {
  const items = collectWeakAreas({ summary: "", flashcards, quiz });
  const cardItems = items.filter((i) => i.kind === "flashcard");
  const quizItems = items.filter((i) => i.kind === "quiz-question");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Items you have missed{" "}
        <span className="font-medium text-text-primary">2 or more times</span> across
        spaced-repetition reviews and quiz attempts — review these first.
      </p>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface-elevated p-8 text-center">
          <PartyPopper size={28} className="text-success" aria-hidden="true" />
          <p className="font-display text-lg font-medium text-text-primary">
            No weak areas yet
          </p>
          <p className="text-sm text-text-secondary">
            Miss an SRS card with "Again" or answer a quiz question wrong twice and
            it will show up here.
          </p>
        </div>
      ) : (
        <>
          {cardItems.length > 0 && (
            <WeakAreaGroup
              heading="Flashcards"
              icon={Layers}
              items={cardItems}
              actionLabel={(i) => `Review flashcard ${i.index + 1}`}
              onJump={(i) => onJumpToCard(i.index)}
            />
          )}
          {quizItems.length > 0 && (
            <WeakAreaGroup
              heading="Quiz questions"
              icon={ListChecks}
              items={quizItems}
              actionLabel={(i) => `Review question ${i.index + 1}`}
              onJump={(i) => onJumpToQuestion(i.index)}
            />
          )}
        </>
      )}
    </div>
  );
}

interface WeakAreaGroupProps {
  heading: string;
  icon: typeof Layers;
  items: ReturnType<typeof collectWeakAreas>;
  actionLabel: (item: WeakAreaGroupProps["items"][number]) => string;
  onJump: (item: WeakAreaGroupProps["items"][number]) => void;
}

function WeakAreaGroup({ heading, icon: Icon, items, actionLabel, onJump }: WeakAreaGroupProps) {
  return (
    <section aria-label={heading} className="flex flex-col gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-text-muted">
        <Icon size={13} />
        {heading}
      </h3>
      {items.map((item, i) => (
        <motion.div
          key={`${item.kind}-${item.index}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, delay: i * 0.04 }}
          className="flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-elevated p-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium leading-relaxed text-text-primary">{item.title}</p>
            {item.subtitle && (
              <p className="mt-1 text-xs leading-relaxed text-text-muted">{item.subtitle}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                item.missCount >= 3 ? "bg-danger/15 text-danger" : "bg-accent/15 text-accent"
              )}
              title={`Missed ${item.missCount} times`}
            >
              {item.missCount} miss{item.missCount === 1 ? "" : "es"}
            </span>
            <button
              onClick={() => onJump(item)}
              aria-label={actionLabel(item)}
              className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Review
              <ArrowRight size={12} />
            </button>
          </div>
        </motion.div>
      ))}
    </section>
  );
}