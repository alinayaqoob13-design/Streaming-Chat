/**
 * ============================================================================
 * UNIT TESTS — lib/file-import.ts
 * ============================================================================
 * Covers the text extraction helpers behind the Import file button:
 * plain text reading, PDF detection, and the pdfjs-driven PDF path (with
 * pdfjs-dist mocked, so the parser itself is never downloaded in tests).
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  ACCEPTED_FILE_TYPES,
  isPdf,
  readAsText,
  extractTextFromFile,
  extractPdfText,
} from "@/lib/file-import";

function textFile(name: string, content: string, type = "text/plain"): File {
  return new File([content], name, { type });
}

// jsdom's File has no arrayBuffer() — polyfill it for the PDF paths.
function pdfFile(): File {
  const file = new File(["fake"], "notes.pdf", { type: "application/pdf" });
  (file as File & { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () => new ArrayBuffer(8);
  return file;
}

describe("isPdf", () => {
  it("detects by MIME type", () => {
    expect(isPdf(new File([""], "notes", { type: "application/pdf" }))).toBe(true);
  });

  it("falls back to the file extension", () => {
    expect(isPdf(textFile("notes.PDF", "x", "application/octet-stream"))).toBe(true);
    expect(isPdf(textFile("notes.txt", "x"))).toBe(false);
  });
});

describe("readAsText", () => {
  it("returns the file contents as a string", async () => {
    expect(await readAsText(textFile("notes.txt", "hello study notes"))).toBe("hello study notes");
  });

  it("handles multi-line content", async () => {
    const text = "line 1\nline 2\n";
    expect(await readAsText(textFile("notes.md", text, "text/markdown"))).toBe(text);
  });
});

describe("extractTextFromFile", () => {
  it("reads text files directly", async () => {
    const file = textFile("notes.txt", "direct text path");
    expect(await extractTextFromFile(file)).toBe("direct text path");
  });

it("routes PDFs through the pdfjs extractor", async () => {
    const pdf = pdfFile();
    const text = await extractTextFromFile(pdf);
    expect(text).toContain("Page one.");
  });
});

describe("extractPdfText", () => {
  // Mock pdfjs-dist: the module is dynamically imported inside the function,
  // and vitest's mock hoisting makes dynamic imports resolve to the stub.
  beforeEach(() => {
    vi.mock("pdfjs-dist", () => ({
      version: "99.0.0",
      GlobalWorkerOptions: { workerSrc: "" },
      // pdf.js returns the loading task synchronously and resolves via .promise
      getDocument: vi.fn(() => ({
        promise: Promise.resolve({
          numPages: 2,
          getPage: vi.fn(async (n: number) => ({
            getTextContent: async () => ({
              items: n === 1 ? [{ str: "Page one." }] : [{ str: "Page two." }, { str: " more." }],
            }),
          })),
          destroy: vi.fn(),
        }),
      })),
    }));
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("pins the worker to the imported parser version", async () => {
    const pdf = pdfFile();
    await extractPdfText(pdf);
    const pdfjs = await import("pdfjs-dist");
    expect(pdfjs.GlobalWorkerOptions.workerSrc).toContain("pdfjs-dist@99.0.0");
  });

  it("joins the text layer of every page", async () => {
    const pdf = pdfFile();
    const text = await extractPdfText(pdf);
    expect(text).toContain("Page one.");
    expect(text).toContain("Page two. more.");
  });
});

describe("ACCEPTED_FILE_TYPES", () => {
  it("covers txt, markdown, and PDF", () => {
    expect(ACCEPTED_FILE_TYPES).toContain(".txt");
    expect(ACCEPTED_FILE_TYPES).toContain(".md");
    expect(ACCEPTED_FILE_TYPES).toContain(".pdf");
  });
});
