/**
 * ============================================================================
 * COMPONENT TESTS — components/notes-input.tsx
 * ============================================================================
 * The 3-state Generate button, length hints, character counter, and the
 * generation-options chips — the whole pre-generation contract.
 * ============================================================================
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("keeps Generate disabled with empty input", () => {
    render(<NotesInput onGenerate={vi.fn()} isGenerating={false} />);
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

    fireEvent.click(screen.getByRole("radio", { name: "Hard" }));
    fireEvent.click(screen.getByRole("radio", { name: "12" }));
    fireEvent.click(screen.getByRole("radio", { name: "اردو" }));
    typeNotes(LONG_ENOUGH);
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
});
