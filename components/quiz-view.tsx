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
 *
 * Why local checking: correctIndex already ships with the artifact, so no
 * second API call is needed — feedback is instant and works offline.
 * ============================================================================
 */

"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Check, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/types/notes";

interface QuizViewProps {
  quiz: QuizQuestion[];
}

export function QuizView({ quiz }: QuizViewProps) {
  // questionIndex -> chosen optionIndex; absence = unanswered
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const answeredCount = Object.keys(answers).length;
  const score = useMemo(
    () =>
      Object.entries(answers).filter(
        ([q, chosen]) => quiz[Number(q)]?.correctIndex === chosen
      ).length,
    [answers, quiz]
  );
  const allAnswered = answeredCount === quiz.length;

  const choose = (questionIndex: number, optionIndex: number) => {
    if (answers[questionIndex] !== undefined) return; // already locked
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const retake = () => setAnswers({});

  return (
    <div className="flex flex-col gap-5">
      {/* ----------------------------------------------------------------- */}
      {/* Score header                                                        */}
      {/* ----------------------------------------------------------------- */}
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

      {/* ----------------------------------------------------------------- */}
      {/* Questions                                                           */}
      {/* ----------------------------------------------------------------- */}
      {quiz.map((q, qi) => {
        const chosen = answers[qi];
        const isAnswered = chosen !== undefined;

        return (
          <motion.fieldset
            key={qi}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: qi * 0.05 }}
            className="rounded-xl border border-border bg-surface-elevated p-4 sm:p-5"
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
