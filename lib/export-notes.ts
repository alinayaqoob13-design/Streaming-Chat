/**
 * ============================================================================
 * STUDY SET EXPORT HELPERS
 * ============================================================================
 *
 * Turns a generated study set into a portable Markdown document and triggers
 * a browser download. Pure client-side — the artifact is already local, so
 * exporting costs no tokens and works offline.
 *
 * Used by the Download button in NotesBuddy's result view. The Print button
 * (window.print + the print stylesheet in globals.css) covers "save as PDF".
 * ============================================================================
 */

import type { StudyNotes } from "@/types/notes";

/**
 * Serialize a study set to Markdown.
 * Quiz answers and explanations are included at the bottom of each question
 * so the export is a complete revision document, not a puzzle.
 */
export function studySetToMarkdown(
  set: StudyNotes,
  title = "Study Notes",
  createdAt?: number
): string {
  const lines: string[] = [`# ${title}`, ""];

  if (createdAt) {
    lines.push(
      `_Generated ${new Date(createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })} — AI Study Notes Buddy_`,
      ""
    );
  }

  lines.push("## Summary", "", set.summary.trim(), "");

  lines.push("## Flashcards", "");
  set.flashcards.forEach((card, i) => {
    lines.push(`**${i + 1}. ${card.front}**`, "", card.back, "");
  });

  lines.push("## Quiz", "");
  set.quiz.forEach((q, i) => {
    lines.push(`**${i + 1}. ${q.question}**`, "");
    q.options.forEach((opt, oi) => {
      const marker = oi === q.correctIndex ? " ✅" : "";
      lines.push(`- ${String.fromCharCode(65 + oi)}. ${opt}${marker}`);
    });
    lines.push("", `_Answer: ${String.fromCharCode(65 + q.correctIndex)} — ${q.explanation}_`, "");
  });

  return lines.join("\n");
}

/** Trigger a browser download of a text file (no server involved). */
export function downloadMarkdown(filename: string, markdown: string): void {
  downloadFile(filename, new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
}

/**
 * Serialize a study set's SUMMARY to plain text — the .txt export.
 * Common markdown syntax (headings, bold/italic, bullets, code spans) is
 * stripped so the file reads like a clean text document, not a raw dump.
 */
export function summaryToText(
  set: StudyNotes,
  title = "Study Notes",
  createdAt?: number
): string {
  const lines: string[] = [title, ""];

  if (createdAt) {
    lines.push(
      `Generated ${new Date(createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })} — AI Study Notes Buddy`,
      ""
    );
  }

  lines.push("SUMMARY", "", stripMarkdown(set.summary.trim()), "");

  return lines.join("\n");
}

/** Lightweight markdown → plain text stripper for the .txt export. */
function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^[-*+]\s+/gm, "• ") // bullets
    .replace(/`([^`]+)`/g, "$1") // code spans
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); // links → link text
}

/** Trigger a browser download of a .txt file. */
export function downloadText(filename: string, text: string): void {
  downloadFile(filename, new Blob([text], { type: "text/plain;charset=utf-8" }));
}

/** Trigger a browser download of a .json backup file. */
export function downloadJson(filename: string, data: unknown): void {
  downloadFile(
    filename,
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" })
  );
}

/** Shared download helper — link click on a blob URL, then revoke. */
function downloadFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
