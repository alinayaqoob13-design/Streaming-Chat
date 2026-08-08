/**
 * ============================================================================
 * API ROUTE TESTS — app/api/chat/route.ts (legacy streaming chat)
 * ============================================================================
 * Same pattern as the notes routes: direct handler calls, mocked AI SDK.
 * Covers the message-array whitelist, API-key guard, and streaming success.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST, GET } from "@/app/api/chat/route";
import type { NextRequest } from "next/server";

const streamText = vi.fn();
vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => streamText(...args),
}));
vi.mock("@ai-sdk/google", () => ({
  google: vi.fn(() => "mock-model"),
}));

const VALID_MESSAGES = [{ role: "user", content: "Hello" }];

function mockReq(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    streamText.mockReset();
    streamText.mockReturnValue({
      toDataStreamResponse: (opts?: { headers?: Record<string, string> }) =>
        new Response("stream", { status: 200, headers: opts?.headers }),
    });
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = "test-key";
  });

  afterEach(() => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  });

  it("rejects a non-array messages field", async () => {
    const res = await POST(mockReq({ messages: "nope" }));
    expect(res.status).toBe(400);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("rejects when no valid messages remain after filtering", async () => {
    const res = await POST(mockReq({ messages: [{ role: "user", content: 42 }] }));
    expect(res.status).toBe(400);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("returns 500 when the API key is not configured", async () => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const res = await POST(mockReq({ messages: VALID_MESSAGES }));
    expect(res.status).toBe(500);
    expect(streamText).not.toHaveBeenCalled();
  });

  it("streams on success with security headers", async () => {
    const res = await POST(mockReq({ messages: VALID_MESSAGES }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const call = streamText.mock.calls[0][0];
    expect(call.messages).toEqual(VALID_MESSAGES);
    expect(call.system).toBeTruthy();
  });
});

describe("GET /api/chat", () => {
  it("returns a health payload", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.model).toBeTruthy();
    expect(body.timestamp).toBeTruthy();
  });
});
