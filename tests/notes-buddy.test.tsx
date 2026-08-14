/**
 * ============================================================================
 * COMPONENT TESTS — components/notes-buddy.tsx (orchestrator)
 * ============================================================================
 * A thin integration slice of the orchestrator: generate → result screen →
 * back to input → undo a history deletion. The AI SDK is not involved here
 * (the /api/notes fetch is stubbed), so no tokens are spent and the whole
 * flow runs in jsdom.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NotesBuddy from "@/components/notes-buddy";
import type { StudyNotes } from "@/types/notes";

// NotesBuddy uses the Next.js app router for deep-linking study sets; jsdom
// has no router, so we provide a minimal mock for these integration tests.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
}));

const ARTIFACT: StudyNotes = {
  summary: "### Processes\n* A program in execution.",
  flashcards: [
    { front: "What is a process?", back: "A program in execution." },
    { front: "What is a thread?", back: "A lightweight unit." },
  ],
  quiz: [
    {
      question: "What is a process?",
      options: ["A program in execution", "A file", "A CPU", "A thread"],
      correctIndex: 0,
      explanation: "Directly from the notes.",
    },
  ],
};

describe("NotesBuddy", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ARTIFACT }) as Response)
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function generateStudySet(notes: string) {
    render(<NotesBuddy />);
    fireEvent.change(screen.getByLabelText(/lecture notes/i), { target: { value: notes } });
    fireEvent.click(screen.getByRole("button", { name: /generate study material/i }));
    await waitFor(() => expect(screen.getByText("Your study material")).toBeInTheDocument());
  }

  it("generates, persists to localStorage, and reopens the history row", async () => {
    await generateStudySet("A process is a program in execution. Threads are lightweight.");

    // Result screen → back to the input screen
    fireEvent.click(screen.getByRole("button", { name: /new notes/i }));
    expect(screen.getByLabelText(/lecture notes/i)).toBeInTheDocument();

    // History row derived from the first notes line (title is ellipsis-
    // truncated past 60 chars, so assert on the prefix)
    expect(screen.getAllByText((c) => c.startsWith("A process is a program"))[0]).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("capstone-study-sets") ?? "[]")).toHaveLength(1);
  });

  it("shows the Undo toast after a history delete and restores the set", async () => {
    await generateStudySet("Memory management is the job of the OS.");

    fireEvent.click(screen.getByRole("button", { name: /new notes/i }));
    // History lives behind the "Recent study sets" popover in the top bar
    fireEvent.click(screen.getByRole("button", { name: /recent study sets/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /delete study set/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /delete study set/i }));

    // Toast uses role=status and splits the title across elements — assert on
    // the container text instead of a single fragment.
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent(/Deleted "Memory management is the job of the OS\."/);
    expect(toast).toHaveTextContent(/Undo/);

    // localStorage loses the set — and the recent-sets button disappears
    // with it (nothing left to list)
    expect(JSON.parse(localStorage.getItem("capstone-study-sets") ?? "[]")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: /recent study sets/i })
    ).not.toBeInTheDocument();

    // …until Undo is hit
    fireEvent.click(screen.getByRole("button", { name: /undo/i }));
    // The toast leaves via AnimatePresence, whose exit outlives the click in
    // jsdom — wait for the exit rather than asserting immediately.
    await waitFor(
      () => expect(screen.queryByText(/Deleted /)).not.toBeInTheDocument(),
      { timeout: 2000 }
    );
    expect(screen.getAllByText("Memory management is the job of the OS.")[0]).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("capstone-study-sets") ?? "[]")).toHaveLength(1);
  });

  it("New Study Set on the input screen clears the current draft back to the hero", async () => {
    render(<NotesBuddy />);
    const textarea = screen.getByLabelText(/lecture notes/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "A half-written draft that must not survive." } });
    expect(textarea.value).not.toBe("");

    // The sidebar's New Study Set button (desktop rail is always in the DOM)
    fireEvent.click(screen.getAllByRole("button", { name: /new study set/i })[0]);

    await waitFor(() =>
      expect((screen.getByLabelText(/lecture notes/i) as HTMLTextAreaElement).value).toBe("")
    );
    // The hero welcome returns for a fresh start
    await waitFor(() =>
      expect(screen.getByText(/Turn lecture notes into/i)).toBeInTheDocument()
    );
  });

  it("opens the export menu with Word and PDF options on the result screen", async () => {
    await generateStudySet("Memory management is the job of the OS.");

    fireEvent.click(screen.getByRole("button", { name: /export study set/i }));
    expect(screen.getByRole("menuitem", { name: /word document/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /pdf/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /markdown/i })).toBeInTheDocument();

    // Escape closes the menu
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("menuitem", { name: /word document/i })).not.toBeInTheDocument();
  });
});