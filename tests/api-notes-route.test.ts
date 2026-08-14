/**
 * ============================================================================
 * API ROUTE TESTS — app/api/notes/route.ts
 * ============================================================================
 * The route handler is called directly with a minimal request stub — no
 * server needed. The AI SDK is mocked, so validation and prompt-building
 * are tested without spending a single token.
 *
 * What is covered:
 * - All four input-validation branches (invalid, too short, too long, ok)
 * - Option validation: enum whitelist + count clamping into schema bounds
 * - Prompt building: difficulty/counts/Urdu instructions reach the model call
 * - API-key guard and the success path
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/notes/route";
import type { NextRequest } from "next/server";

// --- Mocks ------------------------------------------------------------------
// generateObject is the only network-touching piece; replace it and assert
// on the arguments the route passes in (system prompt, counts).
const generateObject = vi.fn();
vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObject(...args),
}));
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-model"),
}));

const VALID_NOTES =
  "Photosynthesis converts light energy into chemical energy in chloroplasts. " +
  "Light reactions make ATP and NADPH; the Calvin cycle fixes CO2 into glucose.";

const MOCK_OBJECT = {
  summary: "### Summary\n* point",
  flashcards: [
    { front: "f1", back: "b1" },
    { front: "f2", back: "b2" },
    { front: "f3", back: "b3" },
  ],
  quiz: [
    { question: "q1?", options: ["a", "b", "c", "d"], correctIndex: 0, explanation: "e" },
    { question: "q2?", options: ["a", "b", "c", "d"], correctIndex: 1, explanation: "e" },
  ],
};

function mockReq(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

describe("POST /api/notes", () => {
  beforeEach(() => {
    generateObject.mockReset();
    generateObject.mockResolvedValue({ object: MOCK_OBJECT, usage: {} });
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  });

  it("rejects a missing notes field", async () => {
    const res = await POST(mockReq({ wrong: true }));
    expect(res.status).toBe(400);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("rejects notes shorter than the minimum", async () => {
    const res = await POST(mockReq({ notes: "hi" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/short/i);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("rejects notes longer than the maximum", async () => {
    const res = await POST(mockReq({ notes: "x".repeat(15001) }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/too long/i);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns 500 when the API key is not configured", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const res = await POST(mockReq({ notes: VALID_NOTES }));
    expect(res.status).toBe(500);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("returns the generated artifact on success", async () => {
    const res = await POST(mockReq({ notes: VALID_NOTES }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(await res.json()).toEqual(MOCK_OBJECT);
  });

  it("sends the notes to the model inside the prompt", async () => {
    await POST(mockReq({ notes: VALID_NOTES }));
    const call = generateObject.mock.calls[0][0];
    expect(call.prompt).toContain(VALID_NOTES);
  });

  it("uses default options (8 flashcards / 5 quiz / medium) when none are given", async () => {
    await POST(mockReq({ notes: VALID_NOTES }));
    const call = generateObject.mock.calls[0][0];
    expect(call.system).toContain("exactly 8 flashcards");
    expect(call.system).toContain("exactly 5 quiz questions");
    expect(call.system).toContain("Mix recall with understanding");
  });

  it("clamps out-of-range counts into the schema bounds", async () => {
    await POST(mockReq({ notes: VALID_NOTES, options: { flashcardCount: 99, quizCount: 0 } }));
    const call = generateObject.mock.calls[0][0];
    expect(call.system).toContain("exactly 12 flashcards"); // max
    expect(call.system).toContain("exactly 2 quiz questions"); // min
  });

  it("whitelists difficulty and applies its instruction", async () => {
    await POST(mockReq({ notes: VALID_NOTES, options: { difficulty: "hard" } }));
    expect(generateObject.mock.calls[0][0].system).toContain("application and analysis");
  });

  it("falls back to medium for an unknown difficulty", async () => {
    await POST(mockReq({ notes: VALID_NOTES, options: { difficulty: "impossible" } }));
    expect(generateObject.mock.calls[0][0].system).toContain("Mix recall with understanding");
  });

  it("adds the Urdu instruction when language is 'ur'", async () => {
    await POST(mockReq({ notes: VALID_NOTES, options: { language: "ur" } }));
    expect(generateObject.mock.calls[0][0].system).toContain("Urdu");
  });

  it("does not add the Urdu instruction for invalid or default language", async () => {
    await POST(mockReq({ notes: VALID_NOTES, options: { language: "fr" } }));
    expect(generateObject.mock.calls[0][0].system).not.toContain("Urdu");
  });

  it("maps a 429 statusCode to the rate-limit message", async () => {
    generateObject.mockRejectedValueOnce(
      Object.assign(new Error("rate limit exceeded"), { statusCode: 429 })
    );
    const res = await POST(mockReq({ notes: VALID_NOTES }));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toMatch(/too many messages/i);
  });

  it("maps a 400 context-length error to the context message", async () => {
    generateObject.mockRejectedValueOnce(
      Object.assign(new Error("context length exceeded"), { statusCode: 400 })
    );
    const res = await POST(mockReq({ notes: VALID_NOTES }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/quite long/i);
  });

  it("keeps the text-based 429 fallback for non-SDK errors", async () => {
    generateObject.mockRejectedValueOnce(new Error("429 Too Many Requests"));
    const res = await POST(mockReq({ notes: VALID_NOTES }));
    expect(res.status).toBe(429);
  });
});
