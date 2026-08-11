/**
 * ============================================================================
 * SHARE LINK HELPERS — lib/share-link.ts
 * ============================================================================
 */

import { describe, it, expect } from "vitest";
import { encodeStudySet, decodeStudySet, buildShareUrl } from "@/lib/share-link";
import type { SavedStudySet } from "@/types/notes";

const SET: SavedStudySet = {
  id: "share-test",
  title: "Shared Notes",
  summary: "A short summary.",
  sourceNotes: "These are the source notes.",
  createdAt: 1_700_000_000_000,
  flashcards: [{ front: "Q?", back: "A." }],
  quiz: [
    {
      question: "Q?",
      options: ["A", "B", "C", "D"],
      correctIndex: 0,
      explanation: "Because.",
    },
  ],
};

describe("share-link", () => {
  it("round-trips a study set through encode/decode", () => {
    const encoded = encodeStudySet(SET);
    expect(encoded).toBeTruthy();
    expect(decodeStudySet(encoded!)).toEqual(SET);
  });

  it("handles Unicode notes (e.g. Urdu) without throwing", () => {
    const urdu: SavedStudySet = { ...SET, title: "اردو نوٹس", sourceNotes: "یہ ایک مثال ہے۔" };
    const encoded = encodeStudySet(urdu);
    expect(encoded).toBeTruthy();
    expect(decodeStudySet(encoded!)).toEqual(urdu);
  });

  it("returns null for corrupt or non-base64 payloads", () => {
    expect(decodeStudySet("not-valid-base64!!!")).toBeNull();
    expect(decodeStudySet("")).toBeNull();
  });

  it("returns null for JSON that doesn't match the SavedStudySet shape", () => {
    const encoded = btoa(encodeURIComponent(JSON.stringify({ id: "x", title: "y" })));
    expect(decodeStudySet(encoded)).toBeNull();
  });

  it("builds a full /share?s=... URL", () => {
    const url = buildShareUrl(SET, "https://example.com");
    expect(url).toMatch(/^https:\/\/example\.com\/share\?s=/);
    const encoded = url!.split("s=")[1];
    expect(decodeStudySet(encoded)).toEqual(SET);
  });
});
