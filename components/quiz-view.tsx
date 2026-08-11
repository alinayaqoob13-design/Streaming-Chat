/**
 * ============================================================================
 * QUIZ VIEW
 * ============================================================================
 *
 * Interactive MCQ quiz built from the generated questions.
 *
 * Behavior:
 * - All questions are listed; each locks as soon as the student picks an
 *   option — one attempt per question, like a real self-test
 * - Immediate feedback: correct option turns green, a wrong pick turns red
 *   AND reveals the right one, plus the explanation the model provided
 * - Score chip at the top updates live; "Retake" resets all answers
 * - Phase 6B: a wrong first pick reports a miss to the parent (persisted as
 *   missCount on the question, feeding the Weak Areas tab); focusIndex makes
 *   the panel scroll to a specific question with a short highlight when the
 *   student jumps in from Weak Areas
 *
 * Why local checking: correctIndex already ships with the artifact, so no
 * second API call is needed — feedback is instant and works offline.
 * ============================================================================
 */

"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/types/notes";

interface QuizViewProps {
  quiz: QuizQuestion[];
  /** Phase 6B: a question was answered wrong — lets the parent persist it. */
  onMissQuestion?: (index: number) => void;
  /** When given, the panel scrolls to this question and briefly highlights it. */
  focusIndex?: number;
}

export function QuizView({ quiz, onMissQuestion, focusIndex }: QuizViewProps) {
  // questionIndex -> chosen optionIndex; absence = unanswered
  const [answers, setAnswers] = useState<Record<number, number>>({});
  // Question briefly highlighted after a Weak Areas jump (cleared on timeout)
  const [highlighted, setHighlighted] = useState<number | null>(null);
  // One ref per fieldset, for scroll-into-view on a focusIndex jump
  const questionRefs = useRef<(HTMLFieldSetElement | null)[]>([]);

  const answeredCount = Object.keys(answers).length;
  const score = useMemo(
    () =>
      Object.entries(answers).filter(
        ([q, chosen]) => quiz[Number(q)]?.correctIndex === chosen
      ).length,
    [answers, quiz]
  );
  const allAnswered = answeredCount === quiz.length;

  // Each lock is a single attempt, so a wrong pick is reported exactly once.
  const choose = (questionIndex: number, optionIndex: number) => {
    if (answers[questionIndex] !== undefined) return; // already locked
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
    if (optionIndex !== quiz[questionIndex].correctIndex) {
      onMissQuestion?.(questionIndex);
    }
  };

  const retake = () => setAnswers({});

  // -------------------------------------------------------------------------
  // Keyboard shortcuts: 1-9 answer the first unanswered question (option N),
  // Space scrolls to that question and glows it. INPUT/TEXTAREA focused users
  // are skipped. The ref keeps the handler free of stale-state races during
  // fast repeat presses.
  // -------------------------------------------------------------------------
  const answersRef = useRef(answers);
  answersRef.current = answers;
  useEffect(() => {
    const firstOpen = () => quiz.findIndex((_, i) => answersRef.current[i] === undefined);
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const qi = firstOpen();
      if (qi === -1) return;
      if (/^[1-9]$/.test(e.key)) {
        if (Number(e.key) <= quiz[qi].options.length) {
          e.preventDefault();
          choose(qi, Number(e.key) - 1);
        }
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        questionRefs.current[qi]?.scrollIntoView?.({ behavior: "smooth", block: "center" });
        setHighlighted(qi);
        const timer = window.setTimeout(() => setHighlighted((h) => (h === qi ? null : h)), 2500);
        window.setTimeout(() => window.clearTimeout(timer), 2600);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quiz, choose]);

  // Jump-to-question: scroll the target fieldset into view and glow it for a
  // couple of seconds. Optional-chained so jsdom and older browsers with no
  // scrollIntoView support never throw.
  useEffect(() => {
    if (focusIndex === undefined) return;
    questionRefs.current[focusIndex]?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    setHighlighted(focusIndex);
    const timer = window.setTimeout(() => setHighlighted(null), 2500);
    return () => window.clearTimeout(timer);
  }, [focusIndex]);

  const currentQuestion = Math.min(answeredCount + 1, quiz.length);

  return (
    <div className="flex flex-col gap-5">
      {/* Progress Indicator */}
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <span id="quiz-progress-label">Question {currentQuestion} of {quiz.length}</span>
        <div
          role="progressbar"
          aria-labelledby="quiz-progress-label"
          aria-valuemin={0}
          aria-valuemax={quiz.length}
          aria-valuenow={currentQuestion}
          className="flex-1 h-1.5 bg-border rounded-full overflow-hidden"
        >
          <div className="h-full bg-accent transition-all duration-300" style={{ width: `${(currentQuestion / quiz.length) * 100}%` }} />
        </div>
      </div>

      {/* Score header */}
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
            allAnswered
              ? "bg-accent/15 text-accent"
              : "bg-surface-elevated text-text-primary"
          )}
          aria-live="polite"
        >
          {allAnswered
            ? `Final score: ${score} / ${quiz.length}`
            : `Score: ${score} / ${quiz.length} — ${quiz.length - answeredCount} left`}
        </span>
        {answeredCount > 0 && (
          <button
            onClick={retake}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-1.5 text-sm text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <RotateCcw size={14} />
            Retake
          </button>
        )}
      </div>

      {/* Tip line — the 1-9/Space shortcuts live in the keydown handler above */}
      <p className="text-xs text-text-muted" aria-hidden="true">
        Tip:{" "}
        <kbd className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-primary">1</kbd>–
        <kbd className="rounded border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-primary">9</kbd>{" "}
        answers the next open question,
        <kbd className="ml-1 rounded border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] text-text-primary">Space</kbd>{" "}
        jumps to it
      </p>

      {/* ----------------------------------------------------------------- */}
      {/* Questions                                                           */}
      {/* ----------------------------------------------------------------- */}
      {quiz.map((q, qi) => {
        const chosen = answers[qi];
        const isAnswered = chosen !== undefined;

        return (
          <motion.fieldset
            key={qi}
            ref={(el) => {
              questionRefs.current[qi] = el;
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: qi * 0.05 }}
            className={cn(
              "rounded-xl border bg-surface-elevated p-4 sm:p-5",
              highlighted === qi ? "border-accent/70 ring-1 ring-accent/40" : "border-border"
            )}
          >
            <legend className="sr-only">Question {qi + 1}</legend>
            <p className="mb-3 text-[15px] font-medium leading-relaxed text-text-primary">
              <span className="mr-2 text-text-muted">{qi + 1}.</span>
              {q.question}
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {q.options.map((option, oi) => {
                const isCorrect = oi === q.correctIndex;
                const isChosen = oi === chosen;

                return (
                  <button
                    key={oi}
                    onClick={() => choose(qi, oi)}
                    disabled={isAnswered}
                    aria-pressed={isChosen}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors duration-150",
                      "focus:outline-none focus:ring-2 focus:ring-accent",
                      // Pre-answer: neutral, hoverable
                      !isAnswered &&
                        "border-border bg-surface text-text-primary hover:border-accent/50 hover:bg-border/40",
                      // Post-answer: right answer green, wrong pick red, rest muted
                      isAnswered && isCorrect &&
                        "border-success/50 bg-success/10 text-success",
                      isAnswered && isChosen && !isCorrect &&
                        "border-danger/50 bg-danger/10 text-danger",
                      isAnswered && !isCorrect && !isChosen &&
                        "border-border bg-surface text-text-muted",
                      isAnswered && "cursor-default"
                    )}
                  >
                    <span>{option}</span>
                    {isAnswered && isCorrect && <Check size={16} className="shrink-0" />}
                    {isAnswered && isChosen && !isCorrect && <X size={16} className="shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Explanation — revealed after answering, right or wrong */}
            {isAnswered && (
              <motion.p
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                transition={{ duration: 0.2 }}
                className="mt-3 border-t border-border-subtle pt-3 text-sm text-text-secondary"
              >
                <span className={cn("font-medium", chosen === q.correctIndex ? "text-success" : "text-danger")}>
                  {chosen === q.correctIndex ? "Correct. " : "Not quite. "}
                </span>
                {q.explanation}
              </motion.p>
            )}
          </motion.fieldset>
        );
      })}
    </div>
  );
}
