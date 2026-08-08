/**
 * ============================================================================
 * MODEL CONFIGURATION MODULE
 * ============================================================================
 * 
 * All AI model settings, system prompts, and generation parameters live here.
 * This is the single source of truth for the LLM configuration.
 * 
 * Why this matters:
 * - FE-07 will extend this module for multi-model support
 * - Keeping prompts and params in one place makes A/B testing trivial
 * - Server-side only — this file is never bundled to the client
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// MODEL SELECTION
// ---------------------------------------------------------------------------
// Default model for streaming chat. Can be overridden via GOOGLE_MODEL env var.
// Uses Google Gemini (free tier via AI Studio) — no paid API key required.
export const DEFAULT_MODEL = process.env.GOOGLE_MODEL || "gemini-3.1-flash-lite";

// ---------------------------------------------------------------------------
// GENERATION PARAMETERS
// ---------------------------------------------------------------------------
// These control the "personality" and creativity of responses.
// Temperature: 0 = deterministic, 1 = highly creative
// Max tokens: hard ceiling to prevent runaway generation and control costs
export const GENERATION_CONFIG = {
  maxTokens: 2048,
  temperature: 0.7,
  topP: 0.9,
} as const;

// ---------------------------------------------------------------------------
// SYSTEM PROMPT
// ---------------------------------------------------------------------------
// This prompt shapes every response. It is sent once at the top of the
// conversation context and defines the assistant's role, tone, and constraints.
// 
// Guidelines for editing:
// - Keep it concise but specific
// - Define the assistant's persona clearly
// - Add guardrails for sensitive topics
// - Include formatting preferences
// ---------------------------------------------------------------------------
export const SYSTEM_PROMPT = `You are CapstoneAI, a helpful, knowledgeable, and precise assistant built for a 2026 frontend engineering capstone project.

## Role & Tone
- You are a senior technical mentor with a warm, encouraging demeanor.
- You explain complex topics clearly, using analogies when helpful.
- You are concise but thorough — prioritize clarity over brevity.

## Capabilities
- Frontend architecture and design patterns
- React, Next.js, TypeScript, and modern CSS
- AI SDK integration and streaming patterns
- Performance optimization and accessibility
- Code review and debugging assistance

## Constraints
- Always provide code examples in TypeScript when discussing implementation.
- Use semantic HTML and accessibility best practices in all UI suggestions.
- If asked about topics outside frontend engineering, politely redirect or provide a high-level overview.
- Never generate harmful, illegal, or unethical content.
- When uncertain, say so rather than hallucinating.

## Formatting
- Use markdown for structure: headers, lists, code blocks.
- For code blocks, always specify the language for syntax highlighting.
- Break long explanations into digestible sections with clear headings.`;

// ---------------------------------------------------------------------------
// STUDY NOTES BUDDY — PROMPT & GENERATION CONFIG
// ---------------------------------------------------------------------------
// Used by POST /api/notes (generateObject with a zod schema), NOT by the
// streaming chat route. Kept separate from SYSTEM_PROMPT because the two
// features have different goals: chat is conversational, notes generation
// must be deterministic and strictly structured.
export const NOTES_SYSTEM_PROMPT = `You are a study assistant that turns raw lecture notes into structured study material for university students.

## Task
Given the student's pasted notes, produce exactly three artifacts:

1. **summary** — A concise markdown summary of the notes. Use short headings and bullet points. Capture definitions, key concepts, and relationships. Do not invent facts that are not in the notes; if the notes are thin, say so briefly instead of padding.

2. **flashcards** — 6 to 10 flashcards. Each front is a term, name, or short question; each back is a one-or-two sentence answer taken from the notes. Cover the most exam-worthy points first.

3. **quiz** — 4 to 6 multiple-choice questions. Each has exactly 4 options, one correctIndex (0-based) pointing to the right option, and a one-sentence explanation of why that answer is correct. Distractors must be plausible but clearly wrong given the notes.

## Constraints
- Ground everything in the provided notes. Never import outside knowledge that contradicts or extends them.
- Keep language simple and student-friendly.
- If the input is not study material (e.g. gibberish, a shopping list), still return valid output: summarize what was given and make the flashcards/quiz as useful as possible from it.`;

// Lower temperature than chat: structured study material should be accurate
// and reproducible, not creative. maxTokens is higher because the response
// carries summary + flashcards + quiz in one JSON payload.
export const NOTES_GENERATION_CONFIG = {
  maxTokens: 4096,
  temperature: 0.4,
} as const;

// Input limits for pasted notes — validated in the API route before any
// tokens are spent. The max caps prompt size to control cost and latency.
export const NOTES_INPUT_LIMITS = {
  minChars: 30,
  maxChars: 15000,
} as const;

// Follow-up chat about a generated study set (POST /api/notes/chat).
// The notes themselves are embedded by the route — the client never
// controls the prompt, only the conversation messages.
export const NOTES_FOLLOWUP_SYSTEM_PROMPT = `You are a study assistant helping a university student understand their own lecture notes.

## Rules
- Answer strictly from the notes provided below. They are the entire universe of this conversation.
- If the answer is not in the notes, say so in one sentence — never import outside knowledge.
- Keep answers short and student-friendly. Use simple language, small examples from the notes when useful.
- If the student asks for memory tricks, comparisons, or quick revisions of the notes, help — that is still grounded in the notes.

## The student's notes
`;

// ---------------------------------------------------------------------------
// STREAMING CONFIG
// ---------------------------------------------------------------------------
// Controls how the stream behaves on the wire.
export const STREAM_CONFIG = {
  // Send chunks as soon as they are generated (low latency)
  // vs. buffer for smoother rendering (higher latency)
  // For this capstone, we prioritize low latency.
  flushIntervalMs: 0,
} as const;

// ---------------------------------------------------------------------------
// ERROR MESSAGES
// ---------------------------------------------------------------------------
// User-facing error copy. Keep these friendly and actionable.
export const ERROR_MESSAGES = {
  generic: "Something went wrong. Please try again in a moment.",
  rateLimit: "I'm receiving too many messages right now. Please wait a few seconds and try again.",
  contextLength: "This conversation has gotten quite long. Starting fresh might help.",
  apiKeyMissing: "The AI service is not configured correctly. Please contact support.",
  notesTooShort: "Your notes look a bit short — paste at least a few sentences so I can make useful study material.",
  notesTooLong: "These notes are too long for one go. Try splitting them into smaller sections.",
  notesInvalid: "Could not read your notes. Please paste plain text and try again.",
} as const;
