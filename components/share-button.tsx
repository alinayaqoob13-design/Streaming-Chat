/**
 * ============================================================================
 * SHARE BUTTON — COPY A /share?s=... LINK
 * ============================================================================
 *
 * Lives in the result header. One click copies a zero-backend share URL to the
 * clipboard and briefly shows a confirmation state. Gracefully degrades if the
 * set is too large to encode or the clipboard API is unavailable.
 * ============================================================================
 */

"use client";

import { useState, useCallback } from "react";
import { Share2, Check, AlertCircle } from "lucide-react";
import { buildShareUrl } from "@/lib/share-link";
import type { SavedStudySet } from "@/types/notes";

interface ShareButtonProps {
  studySet: SavedStudySet;
}

type ShareState = "idle" | "copied" | "error";

export function ShareButton({ studySet }: ShareButtonProps) {
  const [state, setState] = useState<ShareState>("idle");

  const handleClick = useCallback(async () => {
    const url = buildShareUrl(studySet);
    if (!url) {
      setState("error");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
      window.setTimeout(() => setState("idle"), 2000);
    } catch {
      setState("error");
    }
  }, [studySet]);

  const icon =
    state === "copied" ? <Check size={14} /> : state === "error" ? <AlertCircle size={14} /> : <Share2 size={14} />;

  const label =
    state === "copied"
      ? "Link copied"
      : state === "error"
        ? "Could not copy"
        : "Share this set";

  return (
    <button
      onClick={handleClick}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-sm text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
    >
      {icon}
      <span className="hidden sm:inline">{state === "idle" ? "Share" : label}</span>
    </button>
  );
}
