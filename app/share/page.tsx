/**
 * ============================================================================
 * SHARE IMPORT PAGE — /share?s=<encoded-study-set>
 * ============================================================================
 *
 * Receives a zero-backend share link, decodes the study set, and lets the
 * recipient preview + import it into their own localStorage. If the payload is
 * missing, corrupt, or too large, a friendly error screen is shown.
 *
 * Client-only: the encoded set lives in the URL; no server storage is involved.
 * ============================================================================
 */

"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Download, FileText, Layers, ListChecks, AlertCircle } from "lucide-react";
import { decodeStudySet } from "@/lib/share-link";
import type { SavedStudySet } from "@/types/notes";

const STORAGE_KEY = "capstone-study-sets";
const MAX_SAVED_SETS = 20;

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
    // Storage full — UI disables import below
  }
}

function Loading() {
  return (
    <main className="flex h-screen w-full items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-text-secondary">Checking shared notes…</p>
      </div>
    </main>
  );
}

function InvalidShare({ onHome }: { onHome: () => void }) {
  return (
    <main className="flex h-screen w-full items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-8 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated">
          <AlertCircle size={28} className="text-danger" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-text-primary">Invalid share link</h1>
          <p className="mt-1 text-sm text-text-secondary">
            This link looks broken, expired, or was copied incompletely. Ask the sender to share again.
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

function SharePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const encoded = searchParams.get("s");

  const [set, setSet] = useState<SavedStudySet | null | undefined>(undefined);
  const [imported, setImported] = useState(false);

  useEffect(() => {
    if (!encoded) {
      setSet(null);
      return;
    }
    setSet(decodeStudySet(encoded));
  }, [encoded]);

  if (set === undefined) return <Loading />;
  if (set === null) return <InvalidShare onHome={() => router.push("/")} />;

  const handleImport = () => {
    const existing = loadSets();
    const withoutDuplicate = existing.filter((s) => s.id !== set.id);
    const next = [set, ...withoutDuplicate].slice(0, MAX_SAVED_SETS);
    saveSets(next);
    setImported(true);
    router.push(`/study-set/${set.id}`);
  };

  const existingCount = loadSets().length;
  const storageFull = existingCount >= MAX_SAVED_SETS && !loadSets().some((s) => s.id === set.id);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
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
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 sm:p-8"
      >
        <div className="mb-6 text-center">
          <h1 className="font-display text-xl font-semibold text-text-primary">Shared study set</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Someone shared this set with you. Import it to save it in your browser.
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-border bg-surface-elevated p-4">
          <p className="font-display text-lg font-medium text-text-primary">{set.title}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-text-secondary">
              <FileText size={12} />
              Summary
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-text-secondary">
              <Layers size={12} />
              {set.flashcards.length} flashcards
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-xs text-text-secondary">
              <ListChecks size={12} />
              {set.quiz.length} quiz questions
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleImport}
            disabled={imported || storageFull}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={16} />
            {imported ? "Imported" : storageFull ? "Storage full — delete a set first" : "Import into my library"}
          </button>
          <button
            onClick={() => router.push("/")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface-elevated px-4 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
          >
            <ArrowLeft size={16} />
            Back home
          </button>
        </div>
      </motion.div>
    </main>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<Loading />}>
      <SharePageInner />
    </Suspense>
  );
}
