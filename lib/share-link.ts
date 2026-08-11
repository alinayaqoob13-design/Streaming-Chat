/**
 * ============================================================================
 * SHARE LINK HELPERS
 * ============================================================================
 *
 * Zero-backend sharing: a saved study set is serialized to JSON, URI-encoded,
 * and base64-encoded so it fits in a URL query param. The recipient opens
 * /share?s=<encoded> and can import it into their own localStorage.
 *
 * Notes:
 * - encodeURIComponent + btoa handles Unicode safely (btoa alone chokes on
 *   non-Latin1 characters, e.g. Urdu notes)
 * - Decoding validates the bare minimum shape; SRS fields are optional and
 *   fall back to defaults just like a JSON backup import
 * - Very large sets (>~20 KB of source notes) can produce long URLs; that is
 *   an honest limitation of a no-backend design
 * ============================================================================
 */

import type { SavedStudySet } from "@/types/notes";

/**
 * Serialize a study set into a URL-safe base64 string.
 * Returns null if the set cannot be encoded.
 */
export function encodeStudySet(set: SavedStudySet): string | null {
  try {
    return btoa(encodeURIComponent(JSON.stringify(set)));
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
    const json = decodeURIComponent(atob(encoded));
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

    return candidate as unknown as SavedStudySet;
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
