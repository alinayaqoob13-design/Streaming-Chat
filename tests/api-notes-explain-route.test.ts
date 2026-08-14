/**
 * ============================================================================
 * API ROUTE TESTS — app/api/notes/explain/route.ts
 * ============================================================================
 * The route handler is called directly with a minimal request stub — no
 * server needed. The AI SDK is mocked, so validation and prompt-building
 * are tested without spending a single token.
 *
 * What is covered:
 * - All validation branches (notes missing/short/long, malformed card)
 * - API-key guard and the success path
 * - The card and the source notes reach the model call server-side
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/notes/explain/route";
import type { NextRequest } from "next/server";

// --- Mocks ------------------------------------------------------------------
const generateObject = vi.fn();
vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObject(...args),
}));
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-model"),
}));

const VALID_NOTES =
  "Threads are lightweight units of execution that share a process's memory. " +
  "Context switching between threads is cheaper than between processes.";

const VALID_CARD = {
  front: "What is a thread?",
  back: "A lightweight unit of execution sharing the process's memory.",
};

function mockReq(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

describe("POST /api/notes/explain", () => {
  beforeEach(() => {
    generateObject.mockReset();
    generateObject.mockResolvedValue({
      object: { explanation: "Think of a thread as one errand run inside the house of the process." },
      usage: {},
    });
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  });

  it("rejects a missing notes field", async () => {
    const res = await POST(mockReq({ card: VALID_CARD }));
    expect(res.status).toBe(400);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("rejects notes outside the length limits", async () => {
    const short = await POST(mockReq({ notes: "hi", card: VALID_CARD }));
    expect(short.status).toBe(400);
    const long = await POST(
      mockReq({ notes: "x".repeat(15001), card: VALID_CARD })
    );
    expect(long.status).toBe(400);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("rejects a malformed card (missing or blank sides)", async () => {
    const missing = await POST(mockReq({ notes: VALID_NOTES, card: { front: "f" } }));
    expect(missing.status).toBe(400);
    const blank = await POST(mockReq({ notes: VALID_NOTES, card: { front: "  ", back: "b" } }));
    expect(blank.status).toBe(400);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns 500 when the API key is not configured", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const res = await POST(mockReq({ notes: VALID_NOTES, card: VALID_CARD }));
    expect(res.status).toBe(500);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns the validated explanation on success", async () => {
    const res = await POST(mockReq({ notes: VALID_NOTES, card: VALID_CARD }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    const body = await res.json();
    expect(body.explanation).toMatch(/one errand run/);
  });

  it("grounds the call in the source notes and the card, server-side", async () => {
    await POST(mockReq({ notes: VALID_NOTES, card: VALID_CARD }));
    const call = generateObject.mock.calls[0][0];
    expect(call.system).toContain(VALID_NOTES);
    expect(call.prompt).toContain(VALID_CARD.front);
    expect(call.prompt).toContain(VALID_CARD.back);
  });

  it("maps a 429 statusCode to the rate-limit message", async () => {
    generateObject.mockRejectedValueOnce(
      Object.assign(new Error("rate limit exceeded"), { statusCode: 429 })
    );
    const res = await POST(mockReq({ notes: VALID_NOTES, card: VALID_CARD }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/too many messages/i);
  });

  it("maps a 400 context-length error to the context message", async () => {
    generateObject.mockRejectedValueOnce(
      Object.assign(new Error("context length exceeded"), { statusCode: 400 })
    );
    const res = await POST(mockReq({ notes: VALID_NOTES, card: VALID_CARD }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/quite long/i);
  });
});