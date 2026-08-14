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
import { studySetToMarkdown, downloadMarkdown, summaryToText, downloadText, studySetToWordHtml } from "@/lib/export-notes";
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

describe("studySetToWordHtml()", () => {
  it("wraps the set in a Word-compatible HTML document", () => {
    const html = studySetToWordHtml(sampleSet, "OS Lecture 7");
    expect(html).toContain('xmlns:w="urn:schemas-microsoft-com:office:word"');
    expect(html).toContain("<h1>OS Lecture 7</h1>");
  });

  it("converts the summary's markdown to HTML (headings, bullets)", () => {
    const html = studySetToWordHtml(sampleSet);
    expect(html).toContain("<h3>Processes</h3>");
    expect(html).toContain("<li>A program in execution.</li>");
    expect(html).not.toContain("###");
  });

  it("includes flashcards, quiz options and answer markers", () => {
    const html = studySetToWordHtml(sampleSet);
    expect(html).toContain("<strong>What is a process?</strong>");
    expect(html).toContain("B. Stroma ✓");
    expect(html).toContain("Answer: B — The notes place it in the stroma.");
  });

  it("escapes HTML in user/model text so the doc can never break", () => {
    const evil: StudyNotes = {
      summary: "A <b>bold</b> claim & more",
      flashcards: [{ front: "1 < 2", back: "a & b" }],
      quiz: [],
    };
    const html = studySetToWordHtml(evil);
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
    expect(html).toContain("a &amp; b");
    expect(html).not.toContain("<b>bold</b>");
  });
});

describe("summaryToText()", () => {
  it("leads with the title and a plain SUMMARY header", () => {
    const txt = summaryToText(sampleSet, "OS Lecture 7");
    expect(txt.startsWith("OS Lecture 7")).toBe(true);
    expect(txt).toContain("SUMMARY");
  });

  it("strips markdown syntax so the file reads as plain text", () => {
    const txt = summaryToText(sampleSet);
    expect(txt).toContain("Processes"); // ### Processes heading text survives
    expect(txt).not.toContain("###");
    expect(txt).not.toContain("* A program in execution."); // bullet glyph gone
    expect(txt).toContain("• A program in execution.");
  });

  it("keeps the summary body verbatim once stripped", () => {
    const txt = summaryToText(sampleSet);
    expect(txt).toContain("A program in execution.");
  });
});

describe("downloadText()", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("downloads a text/plain blob named .txt", () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:txt");
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

    downloadText("summary.txt", "hello summary");

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/plain;charset=utf-8");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:txt");
  });
});
