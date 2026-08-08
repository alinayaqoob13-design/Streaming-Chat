/**
 * ============================================================================
 * NOTES FOLLOW-UP CHAT API ROUTE
 * ============================================================================
 *
 * Streaming companion to /api/notes: after a study set is generated, the
 * student can ask follow-up questions about THEIR notes. Responses stream
 * token-by-token via streamText (the client uses useChat).
 *
 * Security:
 * - The notes are validated with the same limits as /api/notes and embedded
 *   into the system prompt SERVER-SIDE — the client sends conversation
 *   messages only, never prompt text
 * - Message shape is validated with the same whitelist as /api/chat
 * - Answers are constrained to the notes via NOTES_FOLLOWUP_SYSTEM_PROMPT
 * ============================================================================
 */

import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest } from "next/server";
import {
  DEFAULT_MODEL,
  GENERATION_CONFIG,
  NOTES_FOLLOWUP_SYSTEM_PROMPT,
  NOTES_INPUT_LIMITS,
  ERROR_MESSAGES,
} from "@/lib/config";

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/notes/chat
 * Body: { notes: string, messages: { role, content }[] }
 * Returns: streaming text response (Vercel AI SDK data stream format)
 */
export async function POST(req: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // 1. Parse and validate: notes + message array
    // -----------------------------------------------------------------------
    const body = await req.json().catch(() => null);
    const notes = body?.notes;
    const messages = body?.messages;

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

    if (!Array.isArray(messages)) {
      return jsonError("Invalid request: messages must be an array", 400);
    }

    // Same defense-in-depth whitelist as /api/chat
    const validMessages = messages.filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        typeof m === "object" &&
        m !== null &&
        ["user", "assistant"].includes(m.role) &&
        typeof m.content === "string"
    );

    if (validMessages.length === 0) {
      return jsonError("Invalid request: no valid messages found", 400);
    }

    // -----------------------------------------------------------------------
    // 2. Check API key configuration
    // -----------------------------------------------------------------------
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error("[API/notes/chat] GOOGLE_GENERATIVE_AI_API_KEY is not configured");
      return jsonError(ERROR_MESSAGES.apiKeyMissing, 500);
    }

    // -----------------------------------------------------------------------
    // 3. Stream the follow-up answer
    // -----------------------------------------------------------------------
    const result = streamText({
      model: google(DEFAULT_MODEL),
      // Notes are appended to the prompt here, on the server — the client
      // cannot widen or replace the assistant's grounding
      system: NOTES_FOLLOWUP_SYSTEM_PROMPT + trimmedNotes,
      messages: validMessages,
      maxTokens: GENERATION_CONFIG.maxTokens,
      temperature: GENERATION_CONFIG.temperature,
      topP: GENERATION_CONFIG.topP,
      onFinish: ({ finishReason, usage }) => {
        console.log(`[API/notes/chat] Stream finished. Reason: ${finishReason}, Usage: ${JSON.stringify(usage)}`);
      },
      onError: (error) => {
        console.error("[API/notes/chat] Streaming error:", error);
      },
    });

    return result.toDataStreamResponse({
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[API/notes/chat] Unhandled error:", error);
    return jsonError(ERROR_MESSAGES.generic, 500);
  }
}
