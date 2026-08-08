/**
 * ============================================================================
 * NOTES BUDDY — ORCHESTRATOR
 * ============================================================================
 *
 * Owns the state machine for the AI Study Notes Buddy:
 *
 *   input ──Generate──> generating ──200──> result
 *      ^                  |
 *      └────Try again─────┴──!200──> error
 *
 * - "input":      NotesInput visible, empty-state guidance when blank
 * - "generating": textarea locked, spinner on the button
 * - "result":     NotesResult visible + "New notes" to start over
 * - "error":      error banner with the API's friendly message + retry;
 *                 the student's notes are restored to the textarea so a
 *                 failed call never eats their text
 *
 * The full StudyNotes artifact stays in state; Day 3's tabbed view and
 * Day 5's localStorage persistence both plug into this component.
 * ============================================================================
 */

"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, RotateCcw, PenLine } from "lucide-react";
import { NotesInput } from "@/components/notes-input";
import { NotesResult } from "@/components/notes-result";
import type { StudyNotes } from "@/types/notes";

type BuddyStatus = "input" | "generating" | "result" | "error";

export function NotesBuddy() {
  const [status, setStatus] = useState<BuddyStatus>("input");
  const [result, setResult] = useState<StudyNotes | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Kept so a failed generation can restore the student's text into the input
  const [lastNotes, setLastNotes] = useState("");

  const handleGenerate = useCallback(async (notes: string) => {
    setStatus("generating");
    setError(null);
    setLastNotes(notes);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });

      const data = await res.json();

      if (!res.ok) {
        // The API always returns { error: "<friendly copy>" } on failure
        setError(typeof data?.error === "string" ? data.error : "Something went wrong. Please try again in a moment.");
        setStatus("error");
        return;
      }

      setResult(data as StudyNotes);
      setStatus("result");
    } catch {
      // Network failure — fetch itself threw
      setError("Could not reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setStatus("input");
  }, []);

  const handleNewNotes = useCallback(() => {
    setResult(null);
    setLastNotes("");
    setError(null);
    setStatus("input");
  }, []);

  return (
    <div className="flex w-full flex-1 flex-col gap-4 overflow-hidden rounded-xl border border-border bg-surface p-4 sm:p-6">
      {/* ----------------------------------------------------------------- */}
      {/* Error banner — friendly API message + retry, notes are preserved    */}
      {/* ----------------------------------------------------------------- */}
      <AnimatePresence>
        {status === "error" && error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            role="alert"
            className="flex shrink-0 items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-4"
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-danger" />
            <div className="flex-1">
              <p className="text-sm text-text-primary">{error}</p>
              <button
                onClick={handleRetry}
                className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover focus:outline-none focus:underline"
              >
                <RotateCcw size={14} />
                Try again — your notes are still below
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ----------------------------------------------------------------- */}
      {/* Main view: input form OR generated result                           */}
      {/* Result mode pins the title row + tab bar; only the panel scrolls,   */}
      {/* so "New notes" and the tabs are always reachable on long content.   */}
      {/* ----------------------------------------------------------------- */}
      {status === "result" && result ? (
        <>
          <div className="flex shrink-0 items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">
              Your study material
            </h2>
            <button
              onClick={handleNewNotes}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <PenLine size={14} />
              New notes
            </button>
          </div>
          <NotesResult result={result} />
        </>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NotesInput
            onGenerate={handleGenerate}
            isGenerating={status === "generating"}
            initialNotes={lastNotes}
          />
        </div>
      )}
    </div>
  );
}
