/**
 * ============================================================================
 * ONBOARDING WELCOME — FIRST-VISIT OVERLAY
 * ============================================================================
 *
 * A one-time, three-step welcome shown on the first ever visit, teaching the
 * three things the app can do (paste & generate, study, track & chat) before
 * the user touches anything.
 *
 * Persistence: localStorage key `capstone-onboarding-done` (per project
 * convention, study-set persistence uses the `capstone-` scope):
 *   - first ever visit (flag unset) → the dialog opens once the splash
 *     clears; it sits on top of the real app, which mounts underneath
 *   - any later visit (flag set)    → the dialog never opens again, even a
 *     full browser restart
 *
 * The flag is written BEFORE the exit animation starts — a reload mid-exit
 * must not re-show the welcome.
 *
 * Interaction: 3 slides (Next/Back), Skip on every step, Escape dismisses,
 * and the primary action is auto-focused. The final step's button reads
 * "Start studying". Children are inert / pointer-events-none while the
 * dialog is open so keyboard focus cannot leak behind it.
 *
 * Motion: dialog + backdrop fades, slides drift horizontally, dots pulse.
 * prefers-reduced-motion collapses everything to plain fades with the x
 * drift removed (see useReducedMotion below).
 * ============================================================================
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Brain, MessageCircle } from "lucide-react";

// localStorage key — "done" means the welcome has been dismissed once,
// forever. Never use sessionStorage here: this is a lifetime flag.
const ONBOARDING_KEY = "capstone-onboarding-done";
// Exit fade before the overlay unmounts (mirrors the splash's timing).
const EXIT_MS = 220;

function readOnboardingDone(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  } catch {
    // Storage unavailable (private mode etc.) — just don't block startup:
    // the welcome silently never shows.
    return true;
  }
}

function writeOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "true");
  } catch {
    // Best-effort: the welcome politely re-shows next visit, harmless.
  }
}

// Three slides, one per core capability. Keep the copy short — it must fit
// on a 320px phone in three lines or fewer.
const SLIDES = [
  {
    icon: Sparkles,
    title: "Paste & generate",
    body: "Paste lecture notes — or drop in a .txt or .md file — and Gemini returns a summary, flashcards and a quiz.",
  },
  {
    icon: Brain,
    title: "Study the smart way",
    body: "Flip cards, drill what you missed, and let spaced repetition resurface due cards at the right moment.",
  },
  {
    icon: MessageCircle,
    title: "Track & chat",
    body: "Quiz scores, weak areas and daily streaks — plus a chat that answers only from your notes, saved in your browser.",
  },
] as const;

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Startup unresolved until the localStorage check runs — the home screen
  // must never flash before it (same tri-state rule as SplashGate).
  const [ready, setReady] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // First EVER visit → show the welcome. Any visit after that, skip.
    // Read in an effect (not the initializer) so SSR and hydration render
    // the same tree, then the dialog pops in on the client only.
    if (!readOnboardingDone()) setOpen(true);
    setReady(true);
  }, []);

  const handleDismiss = useCallback(() => {
    // Record "done" BEFORE the fade — a reload mid-exit must not re-show.
    writeOnboardingDone();
    setLeaving(true);
    window.setTimeout(() => setOpen(false), reduceMotion ? 0 : EXIT_MS);
  }, [reduceMotion]);

  return (
    <>
      {/* The real app mounts immediately underneath — inert + click-through
          while the dialog owns the screen, and NOT rendered at all until the
          startup check resolves, so the first paint is the neutral frame. */}
      <div inert={open ? true : undefined} className={open ? "pointer-events-none select-none" : undefined}>
        {ready && children}
      </div>

      {/* Neutral startup frame — sits under the splash (z-50) so it is only
          visible in the one edge case the splash skips (same-tab reload). */}
      {!ready && <div aria-hidden className="fixed inset-0 z-40 bg-background" />}

      {open && <OnboardingDialog leaving={leaving} onDismiss={handleDismiss} />}
    </>
  );
}

function OnboardingDialog({
  leaving,
  onDismiss,
}: {
  leaving: boolean;
  onDismiss: () => void;
}) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const isLast = step === SLIDES.length - 1;
  const Slide = SLIDES[step];

  // Auto-focus the primary action when the dialog opens and when the slide
  // changes, so keyboard users land exactly where the action is.
  useEffect(() => {
    primaryRef.current?.focus();
  }, [step]);

  // Escape dismisses the welcome (flag included) from any step.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  // The new slide fades in from the direction of travel (same style as the
  // splash's enter-only motion — each slide is keyed, so switching is a
  // fresh mount with no waiting exit phase).
  const goNext = () => {
    setDir(1);
    if (isLast) onDismiss();
    else setStep((s) => s + 1);
  };
  const goBack = () => {
    setDir(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const slideEase = [0.4, 0, 0.2, 1] as const;
  const slideDuration = reduceMotion ? 0 : 0.2;
  const drift = (d: 1 | -1) => (reduceMotion ? 0 : d * 18);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop — dim + blur so the app reads as inactive behind the card */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: leaving ? 0 : 1 }}
        transition={{ duration: leaving ? (reduceMotion ? 0 : EXIT_MS / 1000) : (reduceMotion ? 0 : 0.2) }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to AI Study Notes Buddy"
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: leaving ? 0 : 1, scale: leaving ? (reduceMotion ? 1 : 0.98) : 1, y: leaving ? (reduceMotion ? 0 : 8) : 0 }}
        transition={{ duration: leaving ? (reduceMotion ? 0 : EXIT_MS / 1000) : (reduceMotion ? 0 : 0.25), ease: slideEase }}
        className="relative w-full max-w-sm rounded-2xl border border-surface-elevated bg-surface p-6 shadow-[0_24px_64px_rgba(0,0,0,0.5)]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-text-primary">
            Welcome
          </h2>
          <span className="text-xs font-medium text-text-muted" aria-hidden>
            {step + 1} / {SLIDES.length}
          </span>
        </div>

        {/* Slide body — keyed by step, fades in from the direction of
            travel (no waiting exit phase, so swaps are instant) */}
        <div className="min-h-[8.5rem]">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: drift(dir) }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: slideDuration, ease: slideEase }}
            className="flex flex-col items-center gap-3 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-accent/30 bg-accent/15">
              <Slide.icon size={22} className="text-accent" aria-hidden />
            </span>
            <h3 className="font-display text-base font-semibold text-text-primary">
              {Slide.title}
            </h3>
            <p className="text-sm leading-relaxed text-text-secondary">{Slide.body}</p>
          </motion.div>
        </div>

        {/* Progress dots — current slide swells to a pill (matches the
            pager idiom elsewhere in the app) */}
        <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden>
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === step ? "w-5 bg-accent" : "w-1.5 bg-border"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-accent/10 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Skip
          </button>

          <div className="flex items-center gap-2">
            {!isLast && (
              <button
                type="button"
                onClick={goBack}
                disabled={step === 0}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-accent/10 hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:invisible"
              >
                Back
              </button>
            )}
            <button
              ref={primaryRef}
              type="button"
              onClick={goNext}
              className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {isLast ? "Start studying" : "Next"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}