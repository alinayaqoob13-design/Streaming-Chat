/**
 * ============================================================================
 * NOTES RESULT — TABBED ARTIFACT VIEW
 * ============================================================================
 *
 * The three study artifacts behind real tabs:
 *   Summary | Flashcards (n) | Quiz (n)
 *
 * - Tab bar stays pinned above a scrollable panel, so it never scrolls away
 *   on long summaries
 * - Proper tab semantics (tablist/tab/tabpanel, aria-selected) for screen
 *   readers and keyboard users
 * - Switching tabs is instant and local — all three artifacts already live
 *   in the StudyNotes object, no extra fetching
 * ============================================================================
 */

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Layers, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { FlashcardsView } from "@/components/flashcards-view";
import { QuizView } from "@/components/quiz-view";
import type { StudyNotes } from "@/types/notes";

interface NotesResultProps {
  result: StudyNotes;
}

type TabId = "summary" | "flashcards" | "quiz";

export function NotesResult({ result }: NotesResultProps) {
  const [activeTab, setActiveTab] = useState<TabId>("summary");

  const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
    { id: "summary", label: "Summary", icon: FileText },
    { id: "flashcards", label: `Flashcards (${result.flashcards.length})`, icon: Layers },
    { id: "quiz", label: `Quiz (${result.quiz.length})`, icon: ListChecks },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex min-h-0 w-full flex-1 flex-col gap-4"
    >
      {/* ----------------------------------------------------------------- */}
      {/* Tab bar — pinned, never scrolls away                                */}
      {/* ----------------------------------------------------------------- */}
      <div
        role="tablist"
        aria-label="Study material sections"
        className="flex shrink-0 flex-wrap items-center gap-2"
      >
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-accent",
              activeTab === id
                ? "bg-accent font-medium text-on-accent"
                : "bg-surface-elevated text-text-secondary hover:bg-border hover:text-text-primary"
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Panels — scrollable area                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-surface p-4 sm:p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            role="tabpanel"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "summary" && (
              <div className="prose-streaming text-[15px] text-text-secondary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {result.summary}
                </ReactMarkdown>
              </div>
            )}
            {activeTab === "flashcards" && (
              <FlashcardsView flashcards={result.flashcards} />
            )}
            {activeTab === "quiz" && <QuizView quiz={result.quiz} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
