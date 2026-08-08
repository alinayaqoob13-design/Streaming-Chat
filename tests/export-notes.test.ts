/**
 * ============================================================================
 * EXPORT TESTS — lib/export-notes.ts
 * ============================================================================
 * The exported Markdown is a capstone artifact (students hand it in, print
 * it), so its structure is verified precisely: sections, numbering, and
 * the answer markers. downloadMarkdown touches the DOM/Blob API and is
 * covered separately with mocks.
 * ============================================================================
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { studySetToMarkdown, downloadMarkdown } from "@/lib/export-notes";
import type { StudyNotes } from "@/types/notes";

const sampleSet: StudyNotes = {
  summary: "### Processes\n* A program in execution.",
  flashcards: [
    { front: "What is a process?", back: "A program in execution." },
    { front: "What is a thread?", back: "A lightweight unit of execution." },
  ],
  quiz: [
    {
      question: "Where does the Calvin cycle occur?",
      options: ["Thylakoid", "Stroma", "Nucleus", "Membrane"],
      correctIndex: 1,
      explanation: "The notes place it in the stroma.",
    },
  ],
};

describe("studySetToMarkdown()", () => {
  it("uses the title as the document heading", () => {
    const md = studySetToMarkdown(sampleSet, "OS Lecture 7");
    expect(md.startsWith("# OS Lecture 7")).toBe(true);
  });

  it("falls back to a default title", () => {
    expect(studySetToMarkdown(sampleSet).startsWith("# Study Notes")).toBe(true);
  });

  it("includes all three sections", () => {
    const md = studySetToMarkdown(sampleSet);
    expect(md).toContain("## Summary");
    expect(md).toContain("## Flashcards");
    expect(md).toContain("## Quiz");
  });

  it("embeds the summary verbatim", () => {
    expect(studySetToMarkdown(sampleSet)).toContain(sampleSet.summary);
  });

  it("numbers every flashcard with front and back", () => {
    const md = studySetToMarkdown(sampleSet);
    expect(md).toContain("**1. What is a process?**");
    expect(md).toContain("**2. What is a thread?**");
    expect(md).toContain("A lightweight unit of execution.");
  });

  it("letters quiz options and marks the correct one", () => {
    const md = studySetToMarkdown(sampleSet);
    expect(md).toContain("- A. Thylakoid");
    expect(md).toContain("- B. Stroma ✅");
    expect(md).not.toContain("- A. Thylakoid ✅");
  });

  it("adds the answer letter and explanation after each question", () => {
    const md = studySetToMarkdown(sampleSet);
    expect(md).toContain("_Answer: B — The notes place it in the stroma._");
  });

  it("includes a generated date line when createdAt is given", () => {
    const md = studySetToMarkdown(sampleSet, "T", new Date(2026, 7, 10).getTime());
    expect(md).toContain("_Generated August 10, 2026");
  });
});

describe("downloadMarkdown()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a blob URL, clicks a link, and revokes the URL", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window, "URL", {
      value: { createObjectURL, revokeObjectURL },
      configurable: true,
    });
    const click = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreate(tag);
      if (tag === "a") el.click = click;
      return el;
    });

    downloadMarkdown("notes.md", "# Hello");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
