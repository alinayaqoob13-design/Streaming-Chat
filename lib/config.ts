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
} as const;
