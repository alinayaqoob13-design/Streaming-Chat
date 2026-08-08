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
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
