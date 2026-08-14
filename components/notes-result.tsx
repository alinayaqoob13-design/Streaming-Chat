/**
 * ============================================================================
 * NOTES RESULT — TABBED ARTIFACT VIEW
 * ============================================================================
 *
 * The three study artifacts behind real tabs:
 *   Summary | Flashcards (n) | Quiz (n) | Weak areas (n)
 *
 * - Tab bar stays pinned above a scrollable panel, so it never scrolls away
 *   on long summaries
 * - Proper tab semantics (tablist/tab/tabpanel, aria-selected) for screen
 *   readers and keyboard users
 * - Switching tabs is instant and local — all three artifacts already live
 *   in the StudyNotes object, no extra fetching
 * - Phase 6B: the Weak areas tab aggregates per-item missCount (SRS "Again"
 *   ratings + wrong quiz answers) and its jump buttons open the flashcards
 *   tab on that exact card or the quiz tab scrolled to that question
 * ============================================================================
 */

"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Layers, ListChecks, AlertTriangle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { summaryToText, downloadText } from "@/lib/export-notes";
import { FlashcardsView } from "@/components/flashcards-view";
import { QuizView } from "@/components/quiz-view";
import { WeakAreasView } from "@/components/weak-areas-view";
import { collectWeakAreas } from "@/lib/weak-areas";
import type { StudyNotes, OutputLanguage, Flashcard } from "@/types/notes";

interface NotesResultProps {
  result: StudyNotes;
  /** "ur" renders the panels right-to-left for Urdu output */
  language?: OutputLanguage;
  /** Set title — used to name the .txt summary export */
  title?: string;
  /** Source notes — forwarded to FlashcardsView for "Explain differently" */
  sourceNotes?: string;
  /** Study-set id — forwarded to QuizView so answers persist across tab
      switches and reloads (see lib/quiz-progress.ts) */
  setId?: string;
  /** Forwarded to FlashcardsView: SRS ratings flow up to the orchestrator */
  onRateCard?: (index: number, updated: Flashcard) => void;
  /** Forwarded to QuizView: wrong answers flow up for weak-area persistence */
  onMissQuestion?: (index: number) => void;
}

type TabId = "summary" | "flashcards" | "quiz" | "weakareas";

export function NotesResult({ result, language = "en", title = "study-notes", sourceNotes, setId, onRateCard, onMissQuestion }: NotesResultProps) {
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  // Collapse long summaries – default collapsed if over threshold
  const summaryShouldCollapse = result.summary.length > 800;
  const [summaryExpanded, setSummaryExpanded] = useState(false);

  // Weak Areas jump targets: set by a jump button, consumed by the target
  // panel on its next mount (tab switches remount the panel — see below)
  const [focusCardIndex, setFocusCardIndex] = useState<number | null>(null);
  const [focusQuestionIndex, setFocusQuestionIndex] = useState<number | null>(null);

  const weakItems = useMemo(() => collectWeakAreas(result), [result]);

  const jumpToCard = (index: number) => {
    setFocusCardIndex(index);
    setActiveTab("flashcards");
  };
  const jumpToQuestion = (index: number) => {
    setFocusQuestionIndex(index);
    setActiveTab("quiz");
  };

// Weak Areas jump targets are one-shot: clear them once the user LEAVES the
// target tab. Clearing must NOT run when the target tab becomes active — the
// tab panels mount inside an AnimatePresence mode="wait" exit animation, so
// the new panel technically mounts AFTER this effect runs; a clear here would
// erase the index before the panel ever reads it. Clearing on tab-away
// guarantees the panel that consumes the value always sees it, while every
// later visit to the tab starts clean.
useEffect(() => {
  if (activeTab !== "flashcards") setFocusCardIndex(null);
  if (activeTab !== "quiz") setFocusQuestionIndex(null);
}, [activeTab]);

  const tabs: { id: TabId; label: string; icon: typeof FileText }[] = [
    { id: "summary", label: "Summary", icon: FileText },
    { id: "flashcards", label: `Flashcards (${result.flashcards.length})`, icon: Layers },
    { id: "quiz", label: `Quiz (${result.quiz.length})`, icon: ListChecks },
    { id: "weakareas", label: `Weak areas (${weakItems.length})`, icon: AlertTriangle },
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
              "relative inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-accent",
              activeTab === id
                ? "font-medium text-on-accent"
                : "bg-surface-elevated text-text-secondary hover:bg-border hover:text-text-primary"
            )}
          >
            {/* Animated pill — layoutId makes the accent background glide
                between tabs instead of snapping, one element at a time. */}
            {activeTab === id && (
              <motion.span
                layoutId="activeTab"
                className="absolute inset-0 rounded-lg bg-accent"
                transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              <Icon size={14} />
              {label}
            </span>
          </button>
        ))}
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Panels — scrollable area. dir switches the whole artifact to RTL    */}
      {/* for Urdu output; the tab bar above stays LTR chrome.                */}
      {/* ----------------------------------------------------------------- */}
      <div
        dir={language === "ur" ? "rtl" : "ltr"}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-surface p-4 sm:p-5",
          language === "ur" && "font-urdu leading-loose"
        )}
      >
        <AnimatePresence mode="wait">
          {/* min-h-full makes short panels fill the scrollable area so the
              flashcards workspace can flex-1 into the whole panel height —
              the card + its controls then fit without nested scrolling. */}
          <motion.div
            key={activeTab}
            role="tabpanel"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="flex min-h-full flex-col"
          >
            {activeTab === "summary" && (
              <div className="flex flex-col gap-2">
                <div className="prose-streaming text-[15px] text-text-secondary">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {summaryShouldCollapse && !summaryExpanded ? `${result.summary.slice(0, 800)}...` : result.summary}
                  </ReactMarkdown>
                </div>
                <div
                  className={cn(
                    "flex flex-wrap items-center gap-2",
                    summaryShouldCollapse && "justify-between"
                  )}
                >
                  {summaryShouldCollapse && (
                    <button
                      onClick={() => setSummaryExpanded((prev) => !prev)}
                      className="self-start min-w-[44px] min-h-[44px] text-sm text-accent underline hover:text-accent-hover"
                    >
                      {summaryExpanded ? "Show less" : "Read more"}
                    </button>
                  )}
                  {/* Summary export — plain .txt, generated locally, no tokens */}
                  <button
                    onClick={() =>
                      downloadText(
                        `${title.replace(/[^\w\- ]+/g, "").trim() || "study-notes"}.txt`,
                        summaryToText(result, title)
                      )
                    }
                    aria-label="Download summary as a text file"
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    <Download size={14} />
                    Export summary (.txt)
                  </button>
                </div>
              </div>
            )}
            {activeTab === "flashcards" && (
              <FlashcardsView
                flashcards={result.flashcards}
                sourceNotes={sourceNotes}
                onRateCard={onRateCard}
                initialIndex={focusCardIndex ?? 0}
              />
            )}
            {activeTab === "quiz" && (
              <QuizView
                quiz={result.quiz}
                onMissQuestion={onMissQuestion}
                focusIndex={focusQuestionIndex ?? undefined}
                persistKey={setId}
              />
            )}
            {activeTab === "weakareas" && (
              <WeakAreasView
                flashcards={result.flashcards}
                quiz={result.quiz}
                onJumpToCard={jumpToCard}
                onJumpToQuestion={jumpToQuestion}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
