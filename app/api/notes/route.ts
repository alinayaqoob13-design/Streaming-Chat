/**
 * ============================================================================
 * STUDY NOTES API ROUTE
 * ============================================================================
 *
 * Server-side handler for the AI Study Notes Buddy feature.
 * Takes pasted lecture notes and returns structured study material
 * (summary + flashcards + quiz) as validated JSON.
 *
 * Unlike /api/chat this does NOT stream — it uses the AI SDK's generateObject
 * with a zod schema, because the UI needs the complete structured artifact
 * (three tabs) at once, and schema validation guarantees the shape.
 *
 * Security:
 * - API key is server-side only (process.env.GOOGLE_GENERATIVE_AI_API_KEY)
 * - Input is validated (type + length) before any tokens are spent
 * - The zod schema constrains what the model can return — the client never
 *   parses raw model output
 * ============================================================================
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  DEFAULT_MODEL,
  NOTES_SYSTEM_PROMPT,
  NOTES_GENERATION_CONFIG,
  NOTES_INPUT_LIMITS,
  ERROR_MESSAGES,
} from "@/lib/config";

// ---------------------------------------------------------------------------
// RESPONSE SCHEMA
// ---------------------------------------------------------------------------
// Must stay in sync with the StudyNotes interface in types/notes.ts.
// .min()/.max() bounds keep the model from returning empty artifacts or
// runaway arrays that would blow the token budget.
const studyNotesSchema = z.object({
  summary: z.string().min(1),
  flashcards: z
    .array(
      z.object({
        front: z.string().min(1),
        back: z.string().min(1),
      })
    )
    .min(3)
    .max(12),
  quiz: z
    .array(
      z.object({
        question: z.string().min(1),
        options: z.array(z.string().min(1)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: z.string().min(1),
      })
    )
    .min(2)
    .max(8),
});

// Small JSON response helper to keep the route body readable.
function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/notes
 * Body: { notes: string }
 * Returns: StudyNotes JSON (summary, flashcards, quiz)
 */
export async function POST(req: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // 1. Parse and validate input — before any tokens are spent
    // -----------------------------------------------------------------------
    const body = await req.json().catch(() => null);
    const notes = body?.notes;

    if (typeof notes !== "string" || notes.trim().length === 0) {
      return jsonError(ERROR_MESSAGES.notesInvalid, 400);
    }

    const trimmed = notes.trim();

    if (trimmed.length < NOTES_INPUT_LIMITS.minChars) {
      return jsonError(ERROR_MESSAGES.notesTooShort, 400);
    }

    if (trimmed.length > NOTES_INPUT_LIMITS.maxChars) {
      return jsonError(ERROR_MESSAGES.notesTooLong, 400);
    }

    // -----------------------------------------------------------------------
    // 2. Check API key configuration
    // -----------------------------------------------------------------------
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error("[API/notes] GOOGLE_GENERATIVE_AI_API_KEY is not configured");
      return jsonError(ERROR_MESSAGES.apiKeyMissing, 500);
    }

    // -----------------------------------------------------------------------
    // 3. Generate structured study material
    // -----------------------------------------------------------------------
    // generateObject forces the model to conform to the zod schema; if the
    // model returns invalid JSON the SDK retries/repairs before throwing.
    const { object, usage } = await generateObject({
      model: google(DEFAULT_MODEL),
      system: NOTES_SYSTEM_PROMPT,
      prompt: `Here are the student's notes:\n\n${trimmed}`,
      schema: studyNotesSchema,
      maxTokens: NOTES_GENERATION_CONFIG.maxTokens,
      temperature: NOTES_GENERATION_CONFIG.temperature,
    });

    console.log(`[API/notes] Generated study set. Usage: ${JSON.stringify(usage)}`);

    // -----------------------------------------------------------------------
    // 4. Return the validated artifact
    // -----------------------------------------------------------------------
    return new Response(JSON.stringify(object), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // Map provider rate limits to friendly copy; everything else is generic.
    const message = error instanceof Error ? error.message : "";
    if (message.includes("429") || /rate.?limit/i.test(message)) {
      console.warn("[API/notes] Rate limited by provider");
      return jsonError(ERROR_MESSAGES.rateLimit, 429);
    }
    console.error("[API/notes] Unhandled error:", error);
    return jsonError(ERROR_MESSAGES.generic, 500);
  }
}

/**
 * GET /api/notes
 * Health check endpoint — smoke-test the feature without consuming tokens.
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      feature: "study-notes-buddy",
      model: DEFAULT_MODEL,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
