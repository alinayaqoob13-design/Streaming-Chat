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
}

// One multiple-choice quiz question.
// correctIndex points into options[] (0-based) — the UI checks answers locally,
// so no second API call is needed when the user answers.
export interface QuizQuestion {
  question: string;
  options: string[]; // exactly 4 options
  correctIndex: number; // 0..3
  explanation: string; // shown after answering, right or wrong
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
}

// Request body for POST /api/notes
export interface NotesRequest {
  notes: string;
}
