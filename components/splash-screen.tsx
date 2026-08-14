/**
 * ============================================================================
 * SPLASH SCREEN — BROWSER-SESSION STARTUP OVERLAY
 * ============================================================================
 *
 * A brief, premium splash shown on the first load of each browser session
 * (tab), before the app settles into its main view.
 *
 * Persistence: sessionStorage key `hasSeenSplash` (per project convention
 * names are camelCase scoped keys) — NEVER localStorage:
 *   - first load in a new tab/session → splash plays
 *   - reload in the same tab        → splash is skipped (sessionStorage
 *                                     survives reloads)
 *   - internal navigation/re-render → splash is skipped
 *   - a genuinely new tab/session   → splash may play again
 *
 * Timing: minimum visible duration ~1.6s + 0.45s fade (total ~2s). Never
 * artificially delayed beyond that — if the app is ready immediately the
 * splash still completes its minimum so the intro never flashes.
 *
 * Motion: entry fade + gentle scale, a subtle repeat opacity pulse on the
 * icon, and a hairline progress bar. prefers-reduced-motion collapses all
 * of it to a plain fade (see useReducedMotion below).
 *
 * IMPORTANT: this is an OVERLAY, not a substitute for the app. Children
 * (NotesBuddy + header) mount and hydrate normally underneath — no state
 * is reset, nothing reloads. Children are inert / pointer-events-none only
 * while the overlay is visible so keyboard focus cannot leak behind it.
 * ============================================================================
 */

"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

// sessionStorage key — scoped to the tab so every fresh session gets one
// splash and reloads in the same tab don't. Never use localStorage here.
const SPLASH_KEY = "hasSeenSplash";
// Minimum time the splash stays fully visible before the fade begins.
const MIN_VISIBLE_MS = 1600;
// Duration of the exit fade before the overlay unmounts.
const FADE_MS = 450;

function readSplashSeen(): boolean {
  try {
    return sessionStorage.getItem(SPLASH_KEY) === "true";
  } catch {
    // Storage unavailable (private mode etc.) — just don't block startup.
    return false;
  }
}

function writeSplashSeen() {
  try {
    sessionStorage.setItem(SPLASH_KEY, "true");
  } catch {
    // Best-effort: splash re-shows next session, harmless.
  }
}

export function SplashGate({ children }: { children: React.ReactNode }) {
  // Startup state is tri-state, and the DEFAULT must never be "app visible":
  //   - null  → startup unresolved (SSR + first client render) — a neutral
  //             opaque frame is shown INSTEAD of children, so the home
  //             screen can never flash before the sessionStorage check runs
  //   - true  → splash overlay owns the screen (children inert underneath)
  //   - false → resolved: straight into the app (same-tab reload)
  // React 19 supports boolean-ish state cleanly; keep the initial value null
  // so SSR and hydration paint the identical neutral tree (no mismatch).
  const [showSplash, setShowSplash] = useState<boolean | null>(null);
  const [leaving, setLeaving] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // Session already saw the splash → resolve straight into the app.
    if (readSplashSeen()) {
      setShowSplash(false);
      return;
    }

    // Otherwise: play the splash, hold for the minimum duration, record
    // "seen" BEFORE the fade (a reload mid-fade must not replay it), then
    // unmount. The app underneath never remounts.
    setShowSplash(true);
    let cancelled = false;
    const holdTimer = window.setTimeout(() => {
      writeSplashSeen();
      setLeaving(true);
      window.setTimeout(() => {
        if (!cancelled) setShowSplash(false);
      }, reduceMotion ? 0 : FADE_MS);
    }, MIN_VISIBLE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(holdTimer);
    };
  }, [reduceMotion]);

  return (
    <>
      {/* The real app mounts immediately underneath — inert + click-through
          only while the splash owns the screen. Children are NOT rendered at
          all while startup is unresolved (null) so the first paint is the
          neutral frame, never the app. */}
      <div inert={showSplash ? true : undefined} className={showSplash ? "pointer-events-none select-none" : undefined}>
        {showSplash !== null && children}
      </div>

      {/* Neutral startup frame — opaque background, no content. Guarantees a
          clean first paint whether this session ends up playing the splash
          (fresh) or jumping straight into the app (same-tab reload). */}
      {showSplash === null && <div aria-hidden className="fixed inset-0 z-50 bg-background" />}

      {showSplash && <SplashOverlay leaving={leaving} reduceMotion={Boolean(reduceMotion)} />}
    </>
  );
}

function SplashOverlay({ leaving, reduceMotion }: { leaving: boolean; reduceMotion: boolean }) {
  const eased = [0.4, 0, 0.2, 1] as const;
  const enterDuration = reduceMotion ? 0 : 0.4;
  const popDuration = reduceMotion ? 0 : 0.5;

  return (
    <motion.div
      role="status"
      aria-label="AI Study Notes Buddy is loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: leaving ? (reduceMotion ? 0 : 0.4) : enterDuration }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background px-6 text-center"
    >
      {/* App mark — soft rose tile, same accent language as the rest of the UI */}
      <motion.div
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: popDuration, ease: eased, delay: 0.05 }}
        className="flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/15 shadow-[0_0_24px_var(--color-accent-glow)]"
      >
        <motion.span
          animate={reduceMotion ? { opacity: 1 } : { opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="flex"
        >
          <Sparkles size={28} className="text-accent" aria-hidden />
        </motion.span>
      </motion.div>

      {/* Wordmark — the existing brand, font-display like the page header */}
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: popDuration, ease: eased, delay: 0.12 }}
        className="flex flex-col items-center gap-2"
      >
        <h1 className="font-display text-2xl font-semibold text-text-primary sm:text-3xl">
          AI Study Notes Buddy
        </h1>
        <p className="max-w-sm text-sm text-text-secondary">
          Paste lecture notes — get a summary, flashcards &amp; a quiz
        </p>
      </motion.div>

      {/* Minimal hairline progress — a calm pulse, not a spinner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: enterDuration, delay: 0.3 }}
        className="h-1 w-24 overflow-hidden rounded-full bg-surface-elevated"
        aria-hidden
      >
        <motion.div
          className="h-full w-full rounded-full bg-accent"
          initial={{ scaleX: 0 }}
          animate={reduceMotion ? { scaleX: 0.6 } : { scaleX: [0, 1, 0.6] }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          style={{ originX: 0 }}
        />
      </motion.div>
    </motion.div>
  );
}