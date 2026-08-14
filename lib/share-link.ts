/**
 * ============================================================================
 * SHARE LINK HELPERS
 * ============================================================================
 *
 * Zero-backend sharing: a saved study set is serialized to JSON, URI-encoded,
 * and base64url-encoded so it fits in a URL query param. The recipient opens
 * /share?s=<encoded> and can import it into their own localStorage.
 *
 * Notes:
 * - encodeURIComponent + btoa handles Unicode safely (btoa alone chokes on
 *   non-Latin1 characters, e.g. Urdu notes)
 * - The base64 output is made URL-safe (base64url: + -> -, / -> _, strip =)
 *   BEFORE it goes into the query string. Plain base64 breaks silently here:
 *   the URL parser decodes "+" to a space, which corrupts the payload.
 *   Decoding accepts BOTH formats, so share links created before this fix
 *   still open.
 * - Decoding validates the top-level shape AND the per-item flashcards/quiz
 *   shape (the same strictness as a JSON backup import); SRS fields are
 *   optional and fall back to defaults just like a JSON backup import
 * - Very large sets (>~20 KB of source notes) can produce long URLs; that is
 *   an honest limitation of a no-backend design
 * ============================================================================
 */

import type { SavedStudySet } from "@/types/notes";

/** btoa -> base64url: swap + and / for URL-safe chars, drop padding (=). */
function toBase64Url(standard: string): string {
  return standard.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * atob that tolerates the URL-decoded query param:
 * - modern base64url payloads: restore -/_ back to +/ and re-add padding
 * - legacy plain-base64 payloads: "+" already arrived as a space — atob
 *   discards whitespace per spec, so the raw string still decodes
 */
function decodeBase64Decoded(input: string): string {
  const urlSafe = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = urlSafe.padEnd(urlSafe.length + ((4 - (urlSafe.length % 4)) % 4), "=");
  return atob(padded);
}

/**
 * Serialize a study set into a URL-safe base64 string.
 * Returns null if the set cannot be encoded.
 */
export function encodeStudySet(set: SavedStudySet): string | null {
  try {
    return toBase64Url(btoa(encodeURIComponent(JSON.stringify(set))));
  } catch {
    return null;
  }
}

/**
 * Decode a share-link payload back into a SavedStudySet.
 * Returns null for corrupt, truncated, or mismatched shapes.
 */
export function decodeStudySet(encoded: string): SavedStudySet | null {
  try {
    const json = decodeURIComponent(decodeBase64Decoded(encoded));
    const data = JSON.parse(json) as unknown;

    if (typeof data !== "object" || data === null) return null;
    const candidate = data as Record<string, unknown>;

    if (typeof candidate.id !== "string" || candidate.id.length === 0) return null;
    if (typeof candidate.title !== "string" || candidate.title.length === 0) return null;
    if (typeof candidate.summary !== "string" || candidate.summary.length === 0) return null;
    if (typeof candidate.createdAt !== "number" || !Number.isFinite(candidate.createdAt)) return null;
    if (typeof candidate.sourceNotes !== "string") return null;
    if (!Array.isArray(candidate.flashcards) || candidate.flashcards.length === 0) return null;
    if (!Array.isArray(candidate.quiz)) return null;

    // Item-level validation — same strictness as the .json backup restore.
    // A crafted payload with a bad correctIndex would otherwise land in
    // localStorage and render garbage (or crash the review panel).
    const flashcards = (candidate.flashcards as unknown[])
      .filter(
        (c): c is { front: string; back: string } =>
          typeof (c as { front?: unknown }).front === "string" &&
          (c as { front: string }).front.length > 0 &&
          typeof (c as { back?: unknown }).back === "string"
      )
      .map((c) => ({ front: c.front, back: c.back }));
    if (flashcards.length === 0) return null;

    const quiz = (candidate.quiz as unknown[])
      .filter(
        (q): q is { question: string; options: string[]; correctIndex: number; explanation?: string } =>
          typeof (q as { question?: unknown }).question === "string" &&
          Array.isArray((q as { options?: unknown }).options) &&
          (q as { options: unknown[] }).options.length >= 2 &&
          (q as { options: unknown[] }).options.every((o) => typeof o === "string") &&
          Number.isInteger((q as { correctIndex?: unknown }).correctIndex)
      )
      .map((q) => ({
        question: q.question,
        options: q.options.slice(0, 4),
        correctIndex: Math.max(0, Math.min(q.correctIndex, q.options.length - 1)),
        explanation:
          typeof q.explanation === "string"
            ? q.explanation
            : "No explanation included in share link.",
      }));

    return {
      id: candidate.id,
      title: candidate.title,
      summary: candidate.summary,
      sourceNotes: candidate.sourceNotes,
      createdAt: candidate.createdAt,
      language: candidate.language === "ur" ? "ur" : candidate.language === "en" ? "en" : undefined,
      flashcards,
      quiz,
    } as SavedStudySet;
  } catch {
    return null;
  }
}

/** Build a full /share?s=... URL for the current origin. */
export function buildShareUrl(set: SavedStudySet, origin: string = window.location.origin): string | null {
  const encoded = encodeStudySet(set);
  if (!encoded) return null;
  return `${origin}/share?s=${encoded}`;
}