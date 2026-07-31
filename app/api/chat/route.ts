/**
 * ============================================================================
 * STREAMING CHAT API ROUTE
 * ============================================================================
 * 
 * Server-side handler for AI chat streaming.
 * Uses the AI SDK's streamText with the Google Gemini provider.
 * 
 * Security:
 * - API key is server-side only (process.env.GOOGLE_GENERATIVE_AI_API_KEY)
 * - No client can access or override the model config
 * - Input is validated before reaching the LLM
 * ============================================================================
 */

import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { NextRequest } from "next/server";
import { SYSTEM_PROMPT, DEFAULT_MODEL, GENERATION_CONFIG, ERROR_MESSAGES } from "@/lib/config";

/**
 * POST /api/chat
 * Accepts a conversation history and returns a streaming text response.
 */
export async function POST(req: NextRequest) {
  try {
    // -----------------------------------------------------------------------
    // 1. Parse and validate request body
    // -----------------------------------------------------------------------
    const body = await req.json();
    const { messages } = body;

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid request: messages must be an array" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate message shape (defense-in-depth)
    const validMessages = messages.filter(
      (m): m is { role: "user" | "assistant" | "system"; content: string } =>
        typeof m === "object" &&
        m !== null &&
        ["user", "assistant", "system"].includes(m.role) &&
        typeof m.content === "string"
    );

    if (validMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid request: no valid messages found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // -----------------------------------------------------------------------
    // 2. Check API key configuration
    // -----------------------------------------------------------------------
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error("[API] GOOGLE_GENERATIVE_AI_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: ERROR_MESSAGES.apiKeyMissing }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // -----------------------------------------------------------------------
    // 3. Stream the response using AI SDK
    // -----------------------------------------------------------------------
    // streamText handles:
    // - SSE formatting
    // - Token-by-token streaming
    // - Abort signal propagation
    // - Error handling mid-stream
    const result = streamText({
      model: google(DEFAULT_MODEL),
      system: SYSTEM_PROMPT,
      messages: validMessages,
      maxTokens: GENERATION_CONFIG.maxTokens,
      temperature: GENERATION_CONFIG.temperature,
      topP: GENERATION_CONFIG.topP,
      // onFinish is called when the stream completes (success or error)
      onFinish: ({ finishReason, usage }) => {
        console.log(`[API] Stream finished. Reason: ${finishReason}, Usage: ${JSON.stringify(usage)}`);
      },
      // onError catches unhandled errors during streaming
      onError: (error) => {
        console.error("[API] Streaming error:", error);
      },
    });

    // -----------------------------------------------------------------------
    // 4. Return the stream as an SSE response
    // -----------------------------------------------------------------------
    // The AI SDK's toDataStreamResponse() converts the stream to the
    // standard Vercel AI SDK data stream format (v1).
    // This is what useChat expects on the client side.
    return result.toDataStreamResponse({
      headers: {
        // Prevent caching of streaming responses
        "Cache-Control": "no-cache, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });

  } catch (error) {
    console.error("[API] Unhandled error in chat route:", error);
    return new Response(
      JSON.stringify({ error: ERROR_MESSAGES.generic }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * GET /api/chat
 * Health check endpoint for the chat API.
 */
export async function GET() {
  return new Response(
    JSON.stringify({
      status: "ok",
      model: DEFAULT_MODEL,
      timestamp: new Date().toISOString(),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
