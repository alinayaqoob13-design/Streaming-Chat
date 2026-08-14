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

// ---------------------------------------------------------------------------
// WORD EXPORT (.doc)
// ---------------------------------------------------------------------------
// Word opens HTML documents served as application/msword just fine — a real
// .doc download with zero dependencies. The UTF-8 BOM keeps Urdu text intact.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Minimal markdown → HTML for the summary (headings, bold/italic, bullets, code). */
function summaryMarkdownToHtml(md: string): string {
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  const out: string[] = [];
  let inList = false;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const bullet = /^[-*+]\s+/.test(line);
    if (!bullet && inList) {
      out.push("</ul>");
      inList = false;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      out.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
    } else if (bullet) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(line.replace(/^[-*+]\s+/, ""))}</li>`);
    } else if (line !== "") {
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

/** Serialize a study set to a Word-compatible HTML document. */
export function studySetToWordHtml(
  set: StudyNotes,
  title = "Study Notes",
  createdAt?: number
): string {
  const parts: string[] = [`<h1>${escapeHtml(title)}</h1>`];

  if (createdAt) {
    parts.push(
      `<p><em>Generated ${new Date(createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })} — AI Study Notes Buddy</em></p>`
    );
  }

  parts.push("<h2>Summary</h2>", summaryMarkdownToHtml(set.summary.trim()));

  parts.push("<h2>Flashcards</h2>", "<ol>");
  set.flashcards.forEach((card) => {
    parts.push(`<li><strong>${escapeHtml(card.front)}</strong> — ${escapeHtml(card.back)}</li>`);
  });
  parts.push("</ol>");

  parts.push("<h2>Quiz</h2>", "<ol>");
  set.quiz.forEach((q) => {
    parts.push(`<li><p>${escapeHtml(q.question)}</p><ul>`);
    q.options.forEach((opt, oi) => {
      parts.push(
        `<li>${String.fromCharCode(65 + oi)}. ${escapeHtml(opt)}${oi === q.correctIndex ? " ✓" : ""}</li>`
      );
    });
    parts.push(
      `</ul><p><em>Answer: ${String.fromCharCode(65 + q.correctIndex)} — ${escapeHtml(q.explanation)}</em></p></li>`
    );
  });
  parts.push("</ol>");

  return `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(
    title
  )}</title></head><body>${parts.join("\n")}</body></html>`;
}

/** Trigger a browser download of a Word (.doc) file. */
export function downloadWord(filename: string, html: string): void {
  downloadFile(filename, new Blob(["\ufeff" + html], { type: "application/msword;charset=utf-8" }));
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
