/**
 * ============================================================================
 * FILE IMPORT HELPERS
 * ============================================================================
 *
 * Turns a local file into text that can be dropped straight into the notes
 * textarea — killing the app's biggest stated limitation ("no file upload"):
 *
 *  - .txt / .md: read as UTF-8 text via FileReader (zero dependencies)
 *  - PDF: text layer extraction via pdfjs-dist, loaded lazily (dynamic
 *    import) so the ~1MB parser never touches the initial page load
 *
 * PDFs parsed this way are TEXT PDFs (born as text, not scanned images);
 * scanned/image-only PDFs have no text layer and return empty text — the UI
 * surfaces that honestly instead of pretending.
 *
 * Pure client-side: nothing leaves the browser, no tokens are spent.
 * ============================================================================
 */

/** File picker `accept` value — mirror of the type checks below. */
export const ACCEPTED_FILE_TYPES = ".txt,.md,.pdf,text/plain,text/markdown,application/pdf";

/** Never parse past this many PDF pages — bounds worst-case parse time. */
export const MAX_PDF_PAGES = 200;

/** PDF detection by MIME, with a name fallback for mislabeled servers. */
export function isPdf(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/** Read any text-based file as UTF-8. */
export function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("could not read the file"));
    reader.readAsText(file);
  });
}

/**
 * Extract the text layer of a PDF. pdfjs-dist is imported lazily — it is a
 * heavy ESM module and the design needs no it until a PDF is actually chosen.
 *
 * Safety rails:
 * - doc.destroy() runs in finally, so a mid-parse failure can never leak the
 *   worker/PDF document
 * - Parsing stops at MAX_PDF_PAGES — a pathological "5,000-page" file must
 *   not turn into a multi-minute parse loop
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // The worker is loaded from a CDN pinned to the installed parser version —
  // loading it via bundler asset pipelines is brittle across Next versions.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

  const data = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data }).promise;

  try {
    const pages: string[] = [];
    const pagesToRead = Math.min(doc.numPages, MAX_PDF_PAGES);
    for (let pageNo = 1; pageNo <= pagesToRead; pageNo++) {
      const page = await doc.getPage(pageNo);
      const content = await page.getTextContent();
      // Items are TextItem (has "str") or TextMarkedContent (decorative) —
      // only the former carries actual text. Items often carry their own
      // leading/trailing spaces, so whitespace is normalized after joining.
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) pages.push(pageText);
    }

    return pages.join("\n\n");
  } finally {
    // Guaranteed release whether the loop completed or threw midway.
    // Promise.resolve() tolerates mocks/older builds whose destroy() returns
    // nothing.
    await Promise.resolve(doc.destroy()).catch(() => undefined);
  }
}

/** Route a file to the right extractor. */
export async function extractTextFromFile(file: File): Promise<string> {
  if (isPdf(file)) return extractPdfText(file);
  return readAsText(file);
}