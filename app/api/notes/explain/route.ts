/**
 * ============================================================================
 * EXPLAIN DIFFERENTLY API ROUTE
 * ============================================================================
 *
 * Per-card companion to /api/notes and /api/notes/chat: when a student marks
 * a flashcard "Again" in review (or just wants another take), this route
 * produces a fresh, differently-worded explanation of that one card,
 * grounded in the student's own source notes.
 *
 * Security:
 * - API key is server-side only (same env guard as every other route)
 * - The source notes are validated with the same limits as /api/notes and
 *   embedded into the system prompt SERVER-SIDE — the client can never
 *   inject prompt text
 * - Card shape (front/back strings) is validated before any tokens are spent
 * ============================================================================
 */

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  DEFAULT_MODEL,
  EXPLAIN_CARD_SYSTEM_PROMPT,
  EXPLAIN_CARD_CONFIG,
  NOTES_INPUT_LIMITS,
  ERROR_MESSAGES,
  classifyModelError,
} from "@/lib/config";

// The whole response is a single explanation string — schema-validated so
// the client never parses raw model text.
const explainSchema = z.object({
  explanation: z.string().min(1),
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/notes/explain
 * Body: { notes: string, card: { front: string, back: string } }
 * Returns: { explanation: string }
 */
export async function POST(req: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // 1. Parse and validate — before any tokens are spent
    // -----------------------------------------------------------------------
    const body = await req.json().catch(() => null);
    const notes = body?.notes;
    const card = body?.card;

    if (typeof notes !== "string" || notes.trim().length === 0) {
      return jsonError(ERROR_MESSAGES.notesInvalid, 400);
    }
    const trimmedNotes = notes.trim();
    if (trimmedNotes.length < NOTES_INPUT_LIMITS.minChars) {
      return jsonError(ERROR_MESSAGES.notesTooShort, 400);
    }
    if (trimmedNotes.length > NOTES_INPUT_LIMITS.maxChars) {
      return jsonError(ERROR_MESSAGES.notesTooLong, 400);
    }

    if (
      !card ||
      typeof card !== "object" ||
      typeof card.front !== "string" ||
      typeof card.back !== "string" ||
      card.front.trim().length === 0 ||
      card.back.trim().length === 0
    ) {
      return jsonError("Invalid request: card front and back are required", 400);
    }

    // -----------------------------------------------------------------------
    // 2. Check API key configuration
    // -----------------------------------------------------------------------
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error("[API/notes/explain] GOOGLE_GENERATIVE_AI_API_KEY is not configured");
      return jsonError(ERROR_MESSAGES.apiKeyMissing, 500);
    }

    // -----------------------------------------------------------------------
    // 3. Generate the differently-worded explanation
    // -----------------------------------------------------------------------
    const { object, usage } = await generateObject({
      model: google(DEFAULT_MODEL),
      // Notes are appended here, on the server — same grounding model as
      // the follow-up chat, so answers cannot drift to outside knowledge.
      system: EXPLAIN_CARD_SYSTEM_PROMPT + trimmedNotes,
      prompt: `Flashcard I could not recall:\nFront: ${card.front}\nAnswer: ${card.back}\n\nExplain this differently:`,
      schema: explainSchema,
      maxTokens: EXPLAIN_CARD_CONFIG.maxTokens,
      temperature: EXPLAIN_CARD_CONFIG.temperature,
    });

    console.log(`[API/notes/explain] Explained card "${card.front.slice(0, 40)}". Usage: ${JSON.stringify(usage)}`);

    // -----------------------------------------------------------------------
    // 4. Return the validated explanation
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
    // Classify provider failures (rate limits, context length) into friendly
    // copy; everything else stays generic. See classifyModelError in
    // lib/config.ts — it reads the SDK's structured statusCode, not just
    // exception text.
    const { message, status } = classifyModelError(error);
    if (status === 500) {
      console.error("[API/notes/explain] Unhandled error:", error);
    } else {
      console.warn(`[API/notes/explain] Provider error (${status}):`, error);
    }
    return jsonError(message, status);
  }
}

/**
 * GET /api/notes/explain
 * Health check endpoint — smoke-test the feature without consuming tokens.
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      feature: "explain-differently",
      model: DEFAULT_MODEL,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}