/**
 * ============================================================================
 * STUDY NOTES TYPE DEFINITIONS
 * ============================================================================
 * Shared types for the AI Study Notes Buddy feature.
 * Used across client and server boundaries (API route <-> UI components).
 *
 * The shape here must stay in sync with the zod schema in
 * app/api/notes/route.ts — the schema validates what Gemini returns,
 * these types describe it to TypeScript.
 * ============================================================================
 */

// One flashcard: question/term on the front, answer/definition on the back.
export interface Flashcard {
  front: string;
  back: string;
  // ---------------------------------------------------------------------------
  // SPACED REPETITION (SRS) STATE — Phase 6, optional and client-maintained.
  // ---------------------------------------------------------------------------
  // These fields are written by the SRS review UI (see lib/srs.ts for the
  // simplified SM-2 algorithm) and persisted on the flashcard inside the saved
  // study set — the API never emits them, so they stay optional and old saved
  // sets (or freshly generated ones) simply fall back to the defaults in
  // lib/srs.ts. cardId is a deterministic content hash of front+back, so SRS
  // history keeps matching the same card across reloads of the same set.
  cardId?: string; // stable id — derived from front+back when absent
  easeFactor?: number; // SM-2 ease multiplier, default 2.5
  intervalDays?: number; // days until the next review, default 0
  repetitions?: number; // consecutive successful reviews in a row, default 0
  lastReviewedAt?: string | null; // ISO date of the last rating, null = never
  nextReviewAt?: string | null; // ISO date when the card becomes due, null = never reviewed → due now
  missCount?: number; // Phase 6B: how many times this card was rated "Again" (defaults to 0 via ?? 0)
}

// One multiple-choice quiz question.
// correctIndex points into options[] (0-based) — the UI checks answers locally,
// so no second API call is needed when the user answers.
export interface QuizQuestion {
  question: string;
  options: string[]; // exactly 4 options
  correctIndex: number; // 0..3
  explanation: string; // shown after answering, right or wrong
  // Phase 6B: how many times this question was answered wrong. Client-
  // maintained and optional, just like the flashcard SRS fields — the API
  // never emits it, old artifacts simply read as 0 misses.
  missCount?: number;
}

// The full structured artifact generated from one set of pasted notes.
export interface StudyNotes {
  summary: string; // markdown
  flashcards: Flashcard[];
  quiz: QuizQuestion[];
}

// One saved generation, persisted to localStorage so the student can
// reopen past study sets. ChatMessage[] follow-up conversation is attached
// in Week-1 Day 4 work; the id/title/createdAt shell exists from Day 1.
export interface SavedStudySet extends StudyNotes {
  id: string;
  title: string; // derived from the first line of the pasted notes
  createdAt: number;
  sourceNotes: string; // original pasted text, needed for follow-up chat
  language?: OutputLanguage; // absent = "en" (sets saved before this field existed)
}

// Request body for POST /api/notes
export interface NotesRequest {
  notes: string;
  options?: GenerationOptions;
}

// ---------------------------------------------------------------------------
// GENERATION OPTIONS
// ---------------------------------------------------------------------------
// Student-controlled knobs for /api/notes. Every value is validated/clamped
// again in the route — the client is only a suggestion.

// easy = simple recall, medium = recall + understanding, hard = application
export type QuizDifficulty = "easy" | "medium" | "hard";

// en = English, ur = Urdu (اردو) — the result view renders ur right-to-left
export type OutputLanguage = "en" | "ur";

export interface GenerationOptions {
  difficulty: QuizDifficulty;
  flashcardCount: number; // clamped to schema bounds (3..12) in the route
  quizCount: number; // clamped to schema bounds (2..8) in the route
  language: OutputLanguage;
}

export const DEFAULT_GENERATION_OPTIONS: GenerationOptions = {
  difficulty: "medium",
  flashcardCount: 8,
  quizCount: 5,
  language: "en",
};
