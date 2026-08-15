/**
 * ============================================================================
 * FLASHCARDS VIEW — BROWSE + PRACTICE + STUDY (SRS) MODES
 * ============================================================================
 *
 * Three ways to use the generated deck:
 *
 * BROWSE (default): the flip-card deck from Day 3 — click to flip, arrows /
 * arrow keys to move, dot navigation.
 *
 * PRACTICE: an active-recall session inspired by Quizlet's Learn mode and
 * Anki (see research: spacerep.app, flashrecall.app/blog/anki-and-quizlet):
 * - The deck is shuffled
 * - The student flips the card, then honestly marks "Know it" or
 *   "Still learning" — buttons stay disabled until the card is flipped,
 *   so a mark always follows a recall attempt
 * - Missed cards are re-queued ONCE at the end of the session (a gentle
 *   nod to spaced repetition without a full SM-2 scheduler)
 * - The session ends with a score screen: full-deck restart, missed-only
 *   review, or back to browse
 *
 * STUDY (Phase 6): a full spaced-repetition review built on a simplified
 * SM-2. Only due cards (never reviewed, or nextReviewAt <= today) are queued,
 * in most-overdue-first order. After flipping, the student rates recall with
 * "Again" / "Good" / "Easy"; each rating reschedules the card via lib/srs.ts
 * and the orchestrator persists it back into the saved study set. This mode
 * is additive — browse and practice work exactly as before.
 *
 * Entirely client-side: all three modes cost no tokens and work offline.
 * ============================================================================
 */

"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, RotateCw, Check, X, GraduationCap, Undo2, CalendarClock, Zap, Sparkles, Loader2, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyCardRating, countDueCards, isCardDue, type CardRating } from "@/lib/srs";
import type { Flashcard } from "@/types/notes";

interface FlashcardsViewProps {
  flashcards: Flashcard[];
  /** Source notes — enables the per-card "Explain differently" feature. */
  sourceNotes?: string;
  /** Called when the study (SRS) flow rates a card — lets the parent persist. */
  onRateCard?: (index: number, updated: Flashcard) => void;
  /** Browse starts at this card instead of 0 — used by Weak Areas jumps. */
  initialIndex?: number;
}

type Mode = "browse" | "practice" | "study" | "done";

// Per-card Explain Differently state — keyed by real flashcard index so a
// fetched explanation survives walking back and forth through the deck.
interface ExplainState {
  status: "loading" | "done" | "error";
  explanation?: string;
}

function shuffledIndices(length: number): number[] {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function FlashcardsView({ flashcards, sourceNotes, onRateCard, initialIndex }: FlashcardsViewProps) {
  // ---- Browse state -------------------------------------------------------
  // Clamped so a stale Weak-Areas jump index can never push the deck past
  // its last card (the component remounts per tab switch, so this is read
  // once at mount — no effect needed).
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex ?? 0, flashcards.length - 1))
  );
  const [flipped, setFlipped] = useState(false);

  // ---- Practice state -----------------------------------------------------
  const [mode, setMode] = useState<Mode>("browse");
  const [queue, setQueue] = useState<number[]>([]);
  const [pointer, setPointer] = useState(0);
  const [known, setKnown] = useState<number[]>([]);
  const [missed, setMissed] = useState<number[]>([]);
  // Cards already re-queued once — prevents an endless loop on repeat misses
  const [requeued, setRequeued] = useState<number[]>([]);

  // ---- Study (SRS) state --------------------------------------------------
  // The session is a snapshot of the due-card indices taken at start; ratings
  // reschedule cards live, so the queued order never needs to change mid-run.
  const [studyQueue, setStudyQueue] = useState<number[]>([]);
  const [studyPointer, setStudyPointer] = useState(0);

  // ---- Explain Differently state (Phase 5) ------------------------------
  const [explains, setExplains] = useState<Record<number, ExplainState>>({});
  // Per-card toggle: show the fetched explanation or the original answer back
  const [showOriginal, setShowOriginal] = useState<Record<number, boolean>>({});

  // ---- Listen (text-to-speech) state ------------------------------------
  // Reads the visible card side aloud via the browser's speechSynthesis —
  // free, offline, and genuinely useful for language-heavy decks (Urdu
  // renders RTL but cannot be read by a screen reader for study; hearing the
  // pronunciation of both the term and its definition closes that gap).
  // No-ops in browsers without the API (the button then never renders).
  const [speakingSide, setSpeakingSide] = useState<"front" | "back" | null>(null);
  const speechSupportedRef = useRef(
    typeof window !== "undefined" && "speechSynthesis" in window
  );

  const stopSpeaking = useCallback(() => {
    if (!speechSupportedRef.current) return;
    // Optional chaining: environments where the API disappears mid-session
    // (test teardown, iframes) must no-op instead of throwing.
    window.speechSynthesis?.cancel();
    setSpeakingSide(null);
  }, []);

  // Speak the given card side; pressing again (or while the other side is
  // speaking) stops the old utterance and starts the new one.
  const speakSide = useCallback(
    (side: "front" | "back", text: string) => {
      if (!speechSupportedRef.current || !window.speechSynthesis?.speak) return;
      window.speechSynthesis?.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      // Arabic-script text (Urdu present in the notes) gets an Urdu voice
      // and locale; everything else defaults to the OS/browser language.
      const isArabicScript = /[\u0600-\u06FF]/.test(text);
      if (isArabicScript) utterance.lang = "ur-PK";
      utterance.rate = 0.95;
      utterance.onend = () => setSpeakingSide(null);
      utterance.onerror = () => setSpeakingSide(null);
      setSpeakingSide(side);
      window.speechSynthesis.speak(utterance);
    },
    []
  );

  // Never leave ghost audio behind when the deck unmounts (tab switch, new
  // study set, …).
  useEffect(() => {
    return () => {
      if (speechSupportedRef.current) window.speechSynthesis?.cancel();
    };
  }, []);

  // ---- Browse search (front/back text filter) ------------------------------
  // Practice/study run on the FULL deck, so their buttons hide while a query
  // is active instead of silently narrowing a session (see browse header).
  const [query, setQuery] = useState("");
  const filteredCards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return flashcards
      .map((c, i) => ({ card: c, index: i }))
      .filter(
        ({ card }) =>
          card.front.toLowerCase().includes(q) || card.back.toLowerCase().includes(q)
      );
  }, [query, flashcards]);
  const searchActive = filteredCards !== null;

  const total = searchActive ? filteredCards.length : flashcards.length;

  // Which card is on screen right now, in any mode. "done" keeps reading the
  // practice queue so the score screen still has a valid card (the early
  // return below must never fire on a finished session).
  const searchHit = searchActive ? filteredCards[Math.min(index, filteredCards.length - 1)] : null;
  const currentIndex = searchHit
    ? searchHit.index // the REAL card index, so SRS/explain key lookups stay honest
    : mode === "study"
      ? studyQueue[studyPointer]
      : mode === "practice" || mode === "done"
        ? queue[pointer]
        : index;
  const card = searchHit ? searchHit.card : flashcards[currentIndex];

  // Flip-card faces, shared by the animated (browse/practice/study) and the
  // instant (search) render paths below.
  const cardFace = (
    <>
      {/* Front — the question/term */}
      <div className="card-face card-paper absolute inset-0 flex flex-col rounded-2xl border border-border bg-surface-elevated p-6 shadow-2xl shadow-black/50">
        <span className="h-1.5 w-16 rounded-full bg-accent" aria-hidden="true" />
        <span className="mt-3 text-[10px] font-medium uppercase tracking-widest text-text-muted">
          Question
        </span>
        <span className="flex flex-1 items-center justify-center overflow-y-auto">
          <span className="font-display text-lg font-medium leading-relaxed text-text-primary sm:text-xl">
            {card.front}
          </span>
        </span>
        <RotateCw size={14} className="self-end text-text-muted" aria-hidden="true" />
      </div>

      {/* Back — the answer, pre-rotated so it reads correctly */}
      <div className="card-face card-paper absolute inset-0 flex flex-col rounded-2xl border border-accent/40 bg-user-bubble p-6 shadow-2xl shadow-black/50 [transform:rotateY(180deg)]">
        <span className="h-1.5 w-16 rounded-full bg-accent" aria-hidden="true" />
        <span className="mt-3 text-[10px] font-medium uppercase tracking-widest text-accent">
          Answer
        </span>
        <span className="flex flex-1 items-center justify-center overflow-y-auto">
          <span className="text-base leading-relaxed text-text-primary sm:text-lg">
            {card.back}
          </span>
        </span>
        <RotateCw size={14} className="self-end text-text-muted" aria-hidden="true" />
      </div>
    </>
  );

  // Review load at a glance — powers the "N cards due today" chip
  const dueCount = useMemo(() => countDueCards(flashcards), [flashcards]);

  const goTo = useCallback((next: number) => {
    setIndex(next);
    setFlipped(false); // never leak the answer of the next card
    stopSpeaking(); // a card change must never drag old speech along
  }, [stopSpeaking]);

  const prev = useCallback(() => goTo(Math.max(0, index - 1)), [goTo, index]);
  const next = useCallback(() => goTo(Math.min(total - 1, index + 1)), [goTo, index, total]);

  // ---- Practice actions ---------------------------------------------------

  const startPractice = useCallback((indices?: number[]) => {
    setQueue(indices ?? shuffledIndices(total));
    setPointer(0);
    setKnown([]);
    setMissed([]);
    setRequeued([]);
    setFlipped(false);
    stopSpeaking();
    setMode("practice");
  }, [total, stopSpeaking]);

  const exitPractice = useCallback(() => {
    setMode("browse");
    setFlipped(false);
    stopSpeaking();
  }, [stopSpeaking]);

  const mark = useCallback(
    (result: "known" | "missed") => {
      const cardIdx = queue[pointer];
      if (result === "known") {
        setKnown((k) => (k.includes(cardIdx) ? k : [...k, cardIdx]));
      } else {
        setMissed((m) => (m.includes(cardIdx) ? m : [...m, cardIdx]));
        // Re-queue once: see this card again at the end of the session
        if (!requeued.includes(cardIdx)) {
          setQueue((q) => [...q, cardIdx]);
          setRequeued((r) => [...r, cardIdx]);
        }
      }
      setFlipped(false);
      stopSpeaking(); // next card, silence the old one
      const nextPointer = pointer + 1;
      if (nextPointer >= queue.length + (result === "missed" && !requeued.includes(cardIdx) ? 1 : 0)) {
        setMode("done");
      } else {
        setPointer(nextPointer);
      }
    },
    [queue, pointer, requeued, stopSpeaking]
  );

  // ---- Study (SRS) actions ------------------------------------------------
  // NOTE: all hooks must stay above the `if (!card) return null` early return
  // below — a conditional hook placement would break the Rules of Hooks.

  // Queue only what is due right now, most-overdue first: never-reviewed
  // cards (null) lead, then the oldest nextReviewAt dates.
  const startStudy = useCallback(() => {
    const due = flashcards
      .map((c, i) => ({ index: i, card: c }))
      .filter(({ card: c }) => isCardDue(c))
      .sort((a, b) => {
        const aNext = a.card.nextReviewAt ?? null;
        const bNext = b.card.nextReviewAt ?? null;
        if (aNext === null && bNext === null) return 0;
        if (aNext === null) return -1;
        if (bNext === null) return 1;
        return new Date(aNext).getTime() - new Date(bNext).getTime();
      })
      .map(({ index }) => index);
    setStudyQueue(due);
    setStudyPointer(0);
    setFlipped(false);
    stopSpeaking();
    setMode("study");
  }, [flashcards, stopSpeaking]);

  const exitStudy = useCallback(() => {
    setMode("browse");
    setFlipped(false);
    setStudyQueue([]);
    setStudyPointer(0);
    stopSpeaking();
  }, [stopSpeaking]);

  // Rate the visible card, hand the rescheduled card to the parent for
  // persistence, then advance. The last rating drops back to browse — the
  // updated "N due today" chip instantly reflects the new schedule.
  const rateCard = useCallback(
    (rating: CardRating) => {
      const cardIdx = studyQueue[studyPointer];
      const rated = flashcards[cardIdx];
      if (!rated) return;
      onRateCard?.(cardIdx, applyCardRating(rated, rating));
      setFlipped(false);
      if (studyPointer + 1 >= studyQueue.length) {
        setMode("browse");
        setStudyQueue([]);
        setStudyPointer(0);
      } else {
        setStudyPointer((p) => p + 1);
      }
    },
    [studyQueue, studyPointer, flashcards, onRateCard]
  );

  // -------------------------------------------------------------------------
  // Keyboard shortcuts — the deck is heavily keyboard-driven already, so the
  // whole mode set lives on one handler:
  //   browse:   ← → walk the deck, Space/Enter flip
  //   practice: Space/Enter flip, 1 = still learning, 2 = know it
  //   study:    Space/Enter flip, 1 = Again, 2 = Good, 3 = Easy
  // Keys are ignored while an interactive element is focused (buttons already
  // consume Space/Enter; typing in an input must never flip or rate). Declared
  // AFTER mark/rateCard — the effect depends on them and TDZ would throw.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT", "[contenteditable]"].includes(target.tagName)) return;

      if (mode === "browse") {
        if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
        if (e.key === "ArrowRight") { e.preventDefault(); next(); }
      }

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }

      // Ratings only make sense after a recall attempt — same gate as the
      // disabled buttons (1/2/3 only while the card is face-up)
      if (mode === "practice" && flipped) {
        if (e.key === "1") mark("missed");
        if (e.key === "2") mark("known");
      }
      if (mode === "study" && flipped) {
        if (e.key === "1") rateCard("again");
        if (e.key === "2") rateCard("good");
        if (e.key === "3") rateCard("easy");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, prev, next, mark, rateCard, flipped]);

  // ---- Explain Differently actions ---------------------------------------
  // Fetches ONE card's alternate explanation from /api/notes/explain. The
  // original answer is never touched — it stays on the card back, and the
  // toggle below can show it again at any time.
  const explainCard = useCallback(async () => {
    const cardIdx = currentIndex;
    if (cardIdx === undefined || !card || !sourceNotes || explains[cardIdx]?.status === "loading") return;
    setExplains((e) => ({ ...e, [cardIdx]: { status: "loading" } }));
    try {
      const res = await fetch("/api/notes/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notes: sourceNotes,
          card: { front: card.front, back: card.back },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || typeof data.explanation !== "string") {
        throw new Error(data?.error ?? "request failed");
      }
      setExplains((e) => ({
        ...e,
        [cardIdx]: { status: "done", explanation: data.explanation },
      }));
    } catch {
      setExplains((e) => ({ ...e, [cardIdx]: { status: "error" } }));
    }
  }, [currentIndex, card, sourceNotes, explains]);

  const toggleOriginal = useCallback((cardIdx: number) => {
    setShowOriginal((s) => ({ ...s, [cardIdx]: !s[cardIdx] }));
  }, []);

  if (!card) return null;

  const missedCount = missed.length;

  // Explain Differently — state of the visible card (read-only view here)
  const explainState = explains[currentIndex];
  const showingOriginal = Boolean(showOriginal[currentIndex]);

  // Listen — reads the currently visible side aloud (front until flipped)
  const currentSide: "front" | "back" = flipped ? "back" : "front";
  const currentText = currentSide === "front" ? card.front : card.back;
  const listenButton = speechSupportedRef.current ? (
    <button
      onClick={() => (speakingSide ? stopSpeaking() : speakSide(currentSide, currentText))}
      aria-pressed={speakingSide !== null}
      aria-label={speakingSide ? "Stop reading the card aloud" : "Read the visible side of the card aloud"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-accent",
        speakingSide
          ? "bg-accent/15 text-accent hover:bg-accent/25"
          : "bg-surface-elevated text-text-secondary hover:bg-border hover:text-text-primary"
      )}
    >
      {speakingSide ? <VolumeX size={13} /> : <Volume2 size={13} />}
      {speakingSide ? "Stop" : "Listen"}
    </button>
  ) : null;

  return (
    // flex-1 lets the whole workspace fill the panel (see NotesResult's
    // min-h-full tabpanel) — the deck below then absorbs the leftover space
    // and centers the card, so card + status + dots + navigation + explain
    // comfortably share one viewport without nested scrolling.
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-4">
      {/* ----------------------------------------------------------------- */}
      {/* Mode header                                                         */}
      {/* ----------------------------------------------------------------- */}
      {mode === "browse" ? (
        <>
          <div className="flex w-full max-w-xl flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-text-muted" aria-live="polite">
              {searchActive
                ? total === 0
                  ? "No cards match your search"
                  : `Card ${index + 1} of ${total} matching — click to flip`
                : `Card ${index + 1} of ${total} — click the card to flip`}
            </p>
            {listenButton}
          </div>
          {/* Search — filters the deck by front/back text; hiding practice/study
              while active keeps sessions aligned with the full deck */}
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
              setFlipped(false);
            }}
            placeholder="Search cards…"
            aria-label="Search flashcards"
            className="w-full max-w-xs rounded-lg border border-border bg-surface-elevated px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {!searchActive && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {/* Review load at a glance — live SRS due count */}
              <span
                aria-live="polite"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                  dueCount > 0
                    ? "bg-accent/15 text-accent"
                    : "bg-surface-elevated text-text-muted"
                )}
              >
                <CalendarClock size={13} />
                {dueCount === 0
                  ? "All caught up — no cards due today"
                  : `${dueCount} card${dueCount === 1 ? "" : "s"} due today`}
              </span>
              <button
                onClick={startStudy}
                disabled={dueCount === 0}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  "focus:outline-none focus:ring-2 focus:ring-accent",
                  dueCount > 0
                    ? "bg-surface text-text-primary hover:bg-border"
                    : "cursor-not-allowed bg-surface-elevated text-text-muted"
                )}
              >
                <CalendarClock size={15} />
                Study due cards
              </button>
              <button
                onClick={() => startPractice()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <GraduationCap size={15} />
                Practice this deck
              </button>
            </div>
          )}
        </>
      ) : mode === "study" ? (
        <div className="flex w-full max-w-xl items-center justify-between">
          <p className="text-xs text-text-muted" aria-live="polite">
            Reviewing due cards · {studyPointer + 1} of {studyQueue.length}
          </p>
          <div className="flex items-center gap-2">
            {listenButton}
            <button
              onClick={exitStudy}
              className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary focus:outline-none focus:underline"
            >
              <Undo2 size={12} />
              Exit study
            </button>
          </div>
        </div>
      ) : mode === "practice" ? (
        <div className="flex w-full max-w-xl items-center justify-between">
          <p className="text-xs text-text-muted" aria-live="polite">
            {pointer + 1} of {queue.length} ·{" "}
            <span className="text-success">{known.length} known</span> ·{" "}
            <span className="text-danger">{missedCount} missed</span>
          </p>
          <div className="flex items-center gap-2">
            {listenButton}
            <button
              onClick={exitPractice}
              className="inline-flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text-primary focus:outline-none focus:underline"
            >
              <Undo2 size={12} />
              Exit practice
            </button>
          </div>
        </div>
      ) : null}

      {/* ----------------------------------------------------------------- */}
      {/* Session complete                                                    */}
      {/* ----------------------------------------------------------------- */}
      {mode === "done" && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-border bg-surface-elevated p-8 text-center"
        >
          <GraduationCap size={32} className="text-accent" />
          <div>
            <p className="font-display text-2xl font-semibold text-text-primary">
              {known.length} of {total} known
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {missedCount === 0
                ? "Perfect session — every card recalled."
                : `${missedCount} card${missedCount === 1 ? "" : "s"} still need work. Missed cards were shown twice.`}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {missedCount > 0 && (
              <button
                onClick={() => startPractice(missed)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover focus:outline-none focus:ring-2 focus:ring-accent"
              >
                Review {missedCount} missed
              </button>
            )}
            <button
              onClick={() => startPractice()}
              className="rounded-lg bg-surface px-4 py-2.5 text-sm text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Practice full deck
            </button>
            <button
              onClick={exitPractice}
              className="rounded-lg bg-surface px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-border hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Back to browse
            </button>
          </div>
        </motion.div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Flip card — shared by browse and practice                           */}
      {/* ----------------------------------------------------------------- */}
      {mode !== "done" && (
        /* flex-1 + justify-center: the deck is the workspace's breathing
           room. The flip card sits centered in whatever height the panel
           can spare (capped by the flip card's own max-h), instead of the
           whole study view being squeezed into a fixed-size box. */
        <div className="perspective-card relative flex min-h-0 w-full max-w-xl flex-1 flex-col justify-center">
          {!searchActive ? (
            /* Page-turn slide between cards/modes — skipped while a search
               query is active, where an instant swap beats a slide. Adding
               the key ALSO remounts the button so it never keeps focus. */
            <AnimatePresence mode="wait">
              <motion.button
                key={`${mode}-${currentIndex}-${pointer}`}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.18 }}
                onClick={() => setFlipped((f) => !f)}
                aria-label={flipped ? `Answer: ${card.back}` : `Flashcard: ${card.front}. Activate to reveal the answer.`}
                className="relative flex min-h-0 w-full flex-1 flex-col justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl"
              >
                {/* Static card-sized box: the deck shadows live here so they
                    track the flip card's dynamic height exactly but never
                    flip with it (a real deck's back cards stay put). */}
                <div className="relative h-full min-h-64 w-full max-h-80 sm:min-h-72 sm:max-h-96">
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 translate-y-1.5 -rotate-2 rounded-2xl border border-border bg-surface"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 translate-y-0.5 rotate-1 rounded-2xl border border-border bg-surface-elevated/60"
                  />
                  <motion.div
                    animate={{ rotateY: flipped ? 180 : 0, scale: flipped ? 0.95 : 1 }}
                    transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                    className="preserve-3d absolute inset-0"
                  >
                    {cardFace}
                  </motion.div>
                </div>
              </motion.button>
            </AnimatePresence>
          ) : (
            <button
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? `Answer: ${card.back}` : `Flashcard: ${card.front}. Activate to reveal the answer.`}
              className="relative flex min-h-0 w-full flex-1 flex-col justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-2xl"
            >
              {/* Static card-sized box — see the animated path above */}
              <div className="relative h-full min-h-64 w-full max-h-80 sm:min-h-72 sm:max-h-96">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 translate-y-1.5 -rotate-2 rounded-2xl border border-border bg-surface"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 translate-y-0.5 rotate-1 rounded-2xl border border-border bg-surface-elevated/60"
                />
                <div
                  className={cn(
                    "preserve-3d absolute inset-0 transition-transform duration-500",
                    flipped && "rotate-y-180"
                  )}
                >
                  {cardFace}
                </div>
              </div>
            </button>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Explain differently — per-card alternate explanation (Phase 5).     */}
      {/* Hidden when no source notes are available: the feature is grounded  */}
      {/* in the student's own notes, so without them it would be a lie.      */}
      {/* ----------------------------------------------------------------- */}
      {mode !== "done" && sourceNotes && (
        <div className="flex w-full max-w-xl flex-col items-center gap-2">
          {explainState?.status === "loading" && (
            <button
              disabled
              className="inline-flex cursor-wait items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-xs text-text-muted"
            >
              <Loader2 size={13} className="animate-spin" />
              Explaining this card…
            </button>
          )}

          {explainState?.status === "error" && (
            <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2">
              <span className="text-xs text-danger">Couldn't explain this card right now.</span>
              <button
                onClick={explainCard}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover focus:outline-none focus:underline"
              >
                <RotateCw size={12} />
                Try again
              </button>
            </div>
          )}

          {explainState?.status === "done" && explainState.explanation && (
            <div className="w-full rounded-xl border border-accent/30 bg-accent/10 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-widest text-accent">
                  {showingOriginal ? "Original answer" : "Explained differently"}
                </span>
                <button
                  onClick={() => toggleOriginal(currentIndex)}
                  className="min-h-[44px] text-xs text-text-muted underline-offset-2 transition-colors hover:text-text-primary hover:underline focus:outline-none focus:underline"
                >
                  {showingOriginal ? "Show explanation" : "Show original answer"}
                </button>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-text-primary">
                {showingOriginal ? card.back : explainState.explanation}
              </p>
            </div>
          )}

          {!explainState && (
            <button
              onClick={explainCard}
              className="inline-flex items-center gap-1.5 rounded-lg bg-surface-elevated px-3 py-2 text-xs text-text-primary transition-colors hover:bg-border focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <Sparkles size={13} />
              Explain differently
            </button>
          )}
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Practice answer buttons — enabled only AFTER a recall attempt       */}
      {/* ----------------------------------------------------------------- */}
      {mode === "practice" && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => mark("missed")}
            disabled={!flipped}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-danger",
              flipped
                ? "bg-danger/15 text-danger hover:bg-danger/25"
                : "cursor-not-allowed bg-surface-elevated text-text-muted"
            )}
          >
            <X size={16} />
            Still learning
          </button>
          <button
            onClick={() => mark("known")}
            disabled={!flipped}
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-success",
              flipped
                ? "bg-success/15 text-success hover:bg-success/25"
                : "cursor-not-allowed bg-surface-elevated text-text-muted"
            )}
          >
            <Check size={16} />
            Know it
          </button>
        </div>
      )}
      {mode === "practice" && !flipped && (
        <p className="-mt-2 text-[11px] text-text-muted">
          Flip it with Space first, then mark honestly — 1 = still learning, 2 = know it
        </p>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Study rating buttons — SRS mode, enabled only AFTER a recall       */}
      {/* attempt. Each rating reschedules the card via simplified SM-2       */}
      {/* (lib/srs.ts) and hands the result to the parent for persistence.    */}
      {/* ----------------------------------------------------------------- */}
      {mode === "study" && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => rateCard("again")}
            disabled={!flipped}
            aria-label="Again — did not recall, review tomorrow"
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-danger",
              flipped
                ? "bg-danger/15 text-danger hover:bg-danger/25"
                : "cursor-not-allowed bg-surface-elevated text-text-muted"
            )}
          >
            <RotateCw size={16} className="-scale-x-100" />
            Again
          </button>
          <button
            onClick={() => rateCard("good")}
            disabled={!flipped}
            aria-label="Good — recalled with some effort"
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-accent",
              flipped
                ? "bg-accent/15 text-accent hover:bg-accent/25"
                : "cursor-not-allowed bg-surface-elevated text-text-muted"
            )}
          >
            <Check size={16} />
            Good
          </button>
          <button
            onClick={() => rateCard("easy")}
            disabled={!flipped}
            aria-label="Easy — recalled instantly"
            className={cn(
              "inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-sm font-medium transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-success",
              flipped
                ? "bg-success/15 text-success hover:bg-success/25"
                : "cursor-not-allowed bg-surface-elevated text-text-muted"
            )}
          >
            <Zap size={16} />
            Easy
          </button>
        </div>
      )}
      {mode === "study" && !flipped && (
        <p className="-mt-2 text-[11px] text-text-muted">
          Flip it with Space, then rate — 1 = Again, 2 = Good, 3 = Easy
        </p>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* Browse navigation                                                   */}
      {/* ----------------------------------------------------------------- */}
      {mode === "browse" && (
        <div className="flex items-center gap-3">
          <button
            onClick={prev}
            disabled={index === 0}
            aria-label="Previous card"
            className={cn(
              "flex min-w-[44px] min-h-[44px] h-10 w-10 items-center justify-center rounded-lg transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-accent",
              index === 0
                ? "cursor-not-allowed text-text-muted"
                : "bg-surface-elevated text-text-primary hover:bg-border"
            )}
          >
            <ChevronLeft size={18} />
          </button>

          {/* Dot indicators — also direct navigation; follow the search filter */}
          <div className="flex items-center gap-1.5">
            {(searchActive ? filteredCards : flashcards).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                aria-label={`Go to card ${i + 1}`}
                className={cn(
                  "min-w-[44px] min-h-[44px] h-1.5 rounded-full transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-accent",
                  i === index ? "w-5 bg-accent" : "w-1.5 bg-border hover:bg-text-muted"
                )}
              />
            ))}
          </div>

          <button
            onClick={next}
            disabled={index === total - 1}
            aria-label="Next card"
            className={cn(
              "flex min-w-[44px] min-h-[44px] h-10 w-10 items-center justify-center rounded-lg transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-accent",
              index === total - 1
                ? "cursor-not-allowed text-text-muted"
                : "bg-surface-elevated text-text-primary hover:bg-border"
            )}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
