/**
 * ============================================================================
 * MIXED PRACTICE — /mixed-practice
 * ============================================================================
 *
 * Pulls quiz questions from every saved study set, shuffles them, and serves
 * one combined practice session. Wrong answers are reported back to the source
 * set's missCount so Weak Areas stays honest across mixed practice too.
 *
 * Entirely client-side: no API calls, no tokens, works offline.
 * ============================================================================
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, PartyPopper, ListChecks } from "lucide-react";
import { QuizView } from "@/components/quiz-view";
import type { SavedStudySet, QuizQuestion } from "@/types/notes";

const STORAGE_KEY = "capstone-study-sets";
const DEFAULT_MIXED_COUNT = 10;

interface MixedItem {
  /** Source set id — used to persist misses back to the right saved set */
  setId: string;
  /** Index of this question inside the source set's quiz array */
  questionIndex: number;
  /** The question itself */
  question: QuizQuestion;
}

function loadSets(): SavedStudySet[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as SavedStudySet[]) : [];
  } catch {
    return [];
  }
}

function saveSets(sets: SavedStudySet[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
  } catch {
    // Storage full — the miss won't persist, but the quiz keeps working
  }
}

function shuffled<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function Loading() {
  return (
    <main className="flex h-screen w-full items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-text-secondary">Building your mixed practice…</p>
      </div>
    </main>
  );
}

function EmptyState({ onHome }: { onHome: () => void }) {
  return (
    <main className="flex h-screen w-full items-center justify-center bg-background p-4">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(600px circle at 80% 10%, rgba(214,156,174,0.08), transparent 60%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated">
          <PartyPopper size={28} className="text-success" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-text-primary">Nothing to practice yet</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Generate at least one study set with quiz questions, then come back for a mixed session.
          </p>
        </div>
        <button
          onClick={onHome}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <ArrowLeft size={16} />
          Back home
        </button>
      </motion.div>
    </main>
  );
}

export default function MixedPracticePage() {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);
  const [mixed, setMixed] = useState<MixedItem[]>([]);

  useEffect(() => {
    setHasMounted(true);
    const sets = loadSets();
    const allQuestions: MixedItem[] = [];
    for (const set of sets) {
      for (let i = 0; i < set.quiz.length; i++) {
        allQuestions.push({
          setId: set.id,
          questionIndex: i,
          question: set.quiz[i],
        });
      }
    }
    setMixed(shuffled(allQuestions).slice(0, DEFAULT_MIXED_COUNT));
  }, []);

  const handleMissQuestion = useCallback((mixedIndex: number) => {
    const item = mixed[mixedIndex];
    if (!item) return;

    const sets = loadSets();
    const setIdx = sets.findIndex((s) => s.id === item.setId);
    if (setIdx === -1) return;

    const next = [...sets];
    const sourceQuestion = next[setIdx].quiz[item.questionIndex];
    if (!sourceQuestion) return;

    next[setIdx].quiz[item.questionIndex] = {
      ...sourceQuestion,
      missCount: (sourceQuestion.missCount ?? 0) + 1,
    };
    saveSets(next);
  }, [mixed]);

  if (!hasMounted) return <Loading />;
  if (mixed.length === 0) return <EmptyState onHome={() => router.push("/")} />;

  const uniqueSetCount = new Set(mixed.map((m) => m.setId)).size;

  return (
    <main className="flex min-h-screen w-full flex-col bg-background p-4 sm:p-6 lg:p-8">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(600px circle at 80% 10%, rgba(214,156,174,0.08), transparent 60%)",
        }}
      />
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-text-primary">Mixed practice</h1>
            <p className="mt-1 text-sm text-text-secondary">
              <ListChecks size={14} className="inline-block align-text-bottom" />{" "}
              {mixed.length} question{mixed.length === 1 ? "" : "s"} from {uniqueSetCount} saved set
              {uniqueSetCount === 1 ? "" : "s"}
            </p>
          </div>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <ArrowLeft size={14} />
            Back home
          </button>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 sm:p-6">
          <QuizView quiz={mixed.map((m) => m.question)} onMissQuestion={handleMissQuestion} />
        </div>
      </div>
    </main>
  );
}
