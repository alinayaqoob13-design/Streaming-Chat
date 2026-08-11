/**
 * ============================================================================
 * STUDY SET DEEP LINK — /study-set/:id
 * ============================================================================
 *
 * Sharable URL for any saved study set. The set itself lives only in the
 * browser's localStorage (capstone-study-sets), so this page is a client
 * component: it reads storage on mount, verifies the id exists, then hands
 * control to NotesBuddy with initialSetId. If the id is missing or corrupted,
 * a friendly "Set not found" screen is shown with a way back home.
 *
 * Why not server-render: localStorage is not available during SSR; rendering
 * the same loading state on server and client avoids a hydration mismatch.
 * ============================================================================
 */

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileX } from "lucide-react";
import { motion } from "framer-motion";
import NotesBuddy from "@/components/notes-buddy";

const STORAGE_KEY = "capstone-study-sets";

function Loading() {
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
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <p className="text-sm text-text-secondary">Opening your study set…</p>
      </div>
    </main>
  );
}

function NotFound({ onHome }: { onHome: () => void }) {
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
          <FileX size={28} className="text-text-muted" />
        </div>
        <div>
          <h1 className="font-display text-xl font-semibold text-text-primary">
            Study set not found
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            This link may be old, or the set was deleted from this browser.
            Study sets live only in your local storage.
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

export default function StudySetPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : null;

  // null = still checking, false = definitely missing, true = found
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (!id) {
      setExists(false);
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const sets = stored ? (JSON.parse(stored) as unknown[]) : [];
      const found =
        Array.isArray(sets) && sets.some((s) => typeof s === "object" && s !== null && (s as { id?: unknown }).id === id);
      setExists(found);
    } catch {
      setExists(false);
    }
  }, [id]);

  if (exists === null) return <Loading />;
  if (!id || exists === false) return <NotFound onHome={() => router.push("/")} />;

  return <NotesBuddy initialSetId={id} />;
}
