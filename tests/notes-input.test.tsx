/**
 * ============================================================================
 * COMPONENT TESTS — components/notes-input.tsx
 * ============================================================================
 * The 3-state Generate button, length hints, character counter, and the
 * generation-options chips — the whole pre-generation contract.
 * ============================================================================
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotesInput } from "@/components/notes-input";
import { DEFAULT_GENERATION_OPTIONS } from "@/types/notes";

const LONG_ENOUGH =
  "Photosynthesis converts light energy into chemical energy inside the chloroplasts.";

function typeNotes(text: string) {
  fireEvent.change(screen.getByLabelText("Lecture notes"), { target: { value: text } });
}

describe("NotesInput", () => {
  it("shows the hero empty state while the textarea is empty", () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);
    expect(screen.getByText(/Turn lecture notes into/i)).toBeInTheDocument();
    // "Flashcards" also appears as an options label — assert at least one exists
    expect(screen.getAllByText("Flashcards").length).toBeGreaterThan(0);
  });

  it("fills the textarea with sample notes in one click", () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);
    fireEvent.click(screen.getByRole("button", { name: /try with sample notes/i }));
    const textarea = screen.getByLabelText("Lecture notes") as HTMLTextAreaElement;
    expect(textarea.value.length).toBeGreaterThan(30);
    expect(screen.getByRole("button", { name: /generate study material/i })).toBeEnabled();
  });

  it("hides Generate in hero mode and keeps it disabled until enough text", () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);
    // Hero mode: the options chips + Generate are part of compose mode only
    expect(
      screen.queryByRole("button", { name: /generate study material/i })
    ).not.toBeInTheDocument();
    typeNotes("too short");
    expect(screen.getByRole("button", { name: /generate study material/i })).toBeDisabled();
  });

  it("shows the too-short hint below the minimum and hides it above", () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);
    typeNotes("short text here");
    expect(screen.getByText(/Add a little more/i)).toBeInTheDocument();

    typeNotes(LONG_ENOUGH);
    expect(screen.queryByText(/Add a little more/i)).not.toBeInTheDocument();
  });

  it("enables Generate once the minimum is met and submits trimmed notes + default options", () => {
    const onGenerate = vi.fn();
    render(<NotesInput onGenerate={onGenerate} isGenerating={false} />);
    typeNotes("  " + LONG_ENOUGH + "  ");

    fireEvent.click(screen.getByRole("button", { name: /generate study material/i }));
    expect(onGenerate).toHaveBeenCalledWith(LONG_ENOUGH, DEFAULT_GENERATION_OPTIONS);
  });

  it("submits via Ctrl+Enter", () => {
    const onGenerate = vi.fn();
    render(<NotesInput onGenerate={onGenerate} isGenerating={false} />);
    const textarea = screen.getByLabelText("Lecture notes");
    fireEvent.change(textarea, { target: { value: LONG_ENOUGH } });
    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("lets the student change difficulty, counts, and language", () => {
    const onGenerate = vi.fn();
    render(<NotesInput onGenerate={onGenerate} isGenerating={false} />);

    // Compose mode first — the option chips exist only after first text
    typeNotes(LONG_ENOUGH);
    fireEvent.click(screen.getByRole("radio", { name: "Hard" }));
    fireEvent.click(screen.getByRole("radio", { name: "12" }));
    fireEvent.click(screen.getByRole("radio", { name: "اردو" }));
    fireEvent.click(screen.getByRole("button", { name: /generate study material/i }));

    expect(onGenerate).toHaveBeenCalledWith(LONG_ENOUGH, {
      difficulty: "hard",
      flashcardCount: 12,
      quizCount: 5,
      language: "ur",
    });
  });

  it("warns and blocks when the notes exceed the maximum", () => {
    const onGenerate = vi.fn();
    render(<NotesInput onGenerate={onGenerate} isGenerating={false} />);
    typeNotes("x".repeat(15001));

    expect(screen.getByText(/too long/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate study material/i })).toBeDisabled();
  });

  it("shows the character counter against the limit", () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);
    typeNotes(LONG_ENOUGH);
    expect(
      screen.getByText(`${LONG_ENOUGH.length.toLocaleString()} / ${(15000).toLocaleString()}`)
    ).toBeInTheDocument();
  });

  it("locks the textarea and shows the staged progress while in flight", () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={true} initialNotes={LONG_ENOUGH} />);
    expect(screen.getByLabelText("Lecture notes")).toBeDisabled();
    // The Generate button swaps out for the staged progress list
    expect(screen.queryByRole("button", { name: /generate study material/i })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: /generation progress/i })).toBeInTheDocument();
    expect(screen.getByText(/Reading your notes/i)).toBeInTheDocument();
  });

  it("transitions hero → compose on the sample button and stays in compose when text is cleared", async () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);
    expect(screen.queryByRole("radio", { name: "Hard" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /try with sample notes/i }));
    // Compose mode: options chips + Generate revealed, hero collapsing away
    await waitFor(
      () => expect(screen.queryByText(/Turn lecture notes into/i)).not.toBeInTheDocument(),
      { timeout: 2000 }
    );
    expect(screen.getByRole("radio", { name: "Hard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate study material/i })).toBeEnabled();

    // Clearing everything must NOT pop the hero back — compose mode sticks
    // (no repeated in/out flicker while deleting)
    fireEvent.change(screen.getByLabelText("Lecture notes"), { target: { value: "" } });
    expect(screen.queryByText(/Turn lecture notes into/i)).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Hard" })).toBeInTheDocument();
  });

  it("transitions hero → compose when the student starts typing their own notes", () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);
    expect(screen.queryByRole("radio", { name: "Hard" })).not.toBeInTheDocument();

    typeNotes("Typing my own notes — first meaningful interaction.");
    expect(screen.getByRole("radio", { name: "Hard" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate study material/i })).toBeEnabled();
  });

  it("Back to Home returns to the hero and discards the draft after confirmation", async () => {
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmSpy);
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);
    typeNotes(LONG_ENOUGH);
    // Wait for the hero's AnimatePresence exit before asserting compose mode
    await waitFor(() =>
      expect(screen.queryByText(/Turn lecture notes into/i)).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /back to home/i }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText(/Turn lecture notes into/i)).toBeInTheDocument()
    );
    expect((screen.getByLabelText("Lecture notes") as HTMLTextAreaElement).value).toBe("");
    vi.unstubAllGlobals();
  });

  it("Back to Home keeps the compose view when the discard confirmation is cancelled", async () => {
    const confirmSpy = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmSpy);
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);
    typeNotes(LONG_ENOUGH);
    await waitFor(() =>
      expect(screen.queryByText(/Turn lecture notes into/i)).not.toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /back to home/i }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/Turn lecture notes into/i)).not.toBeInTheDocument();
    expect((screen.getByLabelText("Lecture notes") as HTMLTextAreaElement).value).toBe(LONG_ENOUGH);
    vi.unstubAllGlobals();
  });

  it("hides Back to Home while generation is in flight", () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={true} initialNotes={LONG_ENOUGH} />);
    expect(screen.queryByRole("button", { name: /back to home/i })).not.toBeInTheDocument();
  });

  it("explains how to unlock Generate when compose mode is empty", () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);
    typeNotes(LONG_ENOUGH);
    // Clearing the text keeps compose mode (no hero flicker) — and now the
    // student sees WHY the Generate button is disabled instead of a dead button
    typeNotes("");
    expect(screen.getByText(/characters unlock Generate/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate study material/i })).toBeDisabled();
  });

  it("highlights the matching preview card when an artifact button is clicked (Phase 9)", () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);

    const summaryBtn = screen.getByRole("button", { name: /^summary$/i });
    const flashcardsBtn = screen.getByRole("button", { name: /^flashcards$/i });
    const quizBtn = screen.getByRole("button", { name: /^quiz$/i });

    // No selection initially — all cards at full opacity, none scaled
    const summaryCard = screen.getByLabelText("Summary preview");
    const flashcardCard = screen.getByRole("button", { name: /flip flashcard/i });
    const quizCard = screen.getByLabelText("Quiz preview");
    [summaryCard, flashcardCard, quizCard].forEach((card) =>
      expect(card.className).not.toContain("opacity-60")
    );

    // Selecting Summary emphasizes its card and dims the other two
    fireEvent.click(summaryBtn);
    expect(summaryBtn).toHaveAttribute("aria-pressed", "true");
    expect(summaryCard.className).toContain("scale-[1.02]");
    expect(summaryCard.className).toContain("border-accent/60");
    expect(flashcardCard.className).toContain("opacity-60");
    expect(quizCard.className).toContain("opacity-60");
    expect(flashcardsBtn).toHaveAttribute("aria-pressed", "false");

    // Switching to Flashcards moves the emphasis
    fireEvent.click(flashcardsBtn);
    expect(flashcardCard.className).toContain("scale-[1.02]");
    expect(summaryCard.className).toContain("opacity-60");

    // Clicking the active button again deselects — everything returns
    fireEvent.click(flashcardsBtn);
    expect(flashcardsBtn).toHaveAttribute("aria-pressed", "false");
    expect(flashcardCard.className).not.toContain("scale-[1.02]");
    expect(flashcardCard.className).not.toContain("opacity-60");
    expect(summaryCard.className).not.toContain("opacity-60");
  });

  it("shows the compact How-it-works strip in hero mode and hides it in compose mode", async () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);

    expect(screen.getByText("Paste your notes")).toBeInTheDocument();
    expect(screen.getByText("AI generates study material")).toBeInTheDocument();
    expect(screen.getByText("Study & track progress")).toBeInTheDocument();

    // Leaving the hero (first interaction) removes the strip with it
    typeNotes("Typing my own notes — hero exits.");
    await waitFor(() =>
      expect(screen.queryByText("Paste your notes")).not.toBeInTheDocument()
    );
  });
});
