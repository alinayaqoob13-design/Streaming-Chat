/**
 * ============================================================================
 * COMPONENT TESTS — components/flashcards-view.tsx
 * ============================================================================
 * Both modes: browse (flip + navigation) and practice (flip-then-mark,
 * missed re-queue, session score screen).
 *
 * Note: framer-motion runs in jsdom without issue here — we assert on the
 * DOM contract (aria-labels, button states), not on animation frames.
 * ============================================================================
 */

import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlashcardsView } from "@/components/flashcards-view";
import type { Flashcard } from "@/types/notes";

const CARDS: Flashcard[] = [
  { front: "What is a process?", back: "A program in execution." },
  { front: "What is a thread?", back: "A lightweight unit of execution." },
  { front: "What is a PCB?", back: "Process Control Block — stores process metadata." },
];

function getCard(): HTMLElement {
  return screen.getByRole("button", { name: /flashcard:|answer:/i });
}

describe("FlashcardsView — browse mode", () => {
  it("shows the first card front with position", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    expect(screen.getByText("Card 1 of 3 — click the card to flip")).toBeInTheDocument();
    expect(screen.getByText("What is a process?")).toBeInTheDocument();
  });

  it("flips the card on click", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(getCard());
    expect(getCard()).toHaveAccessibleName("Answer: A program in execution.");
  });

  it("navigates with next/previous and disables at the ends", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    const prev = screen.getByRole("button", { name: "Previous card" });
    const next = screen.getByRole("button", { name: "Next card" });

    expect(prev).toBeDisabled();
    fireEvent.click(next);
    expect(screen.getByText("Card 2 of 3 — click the card to flip")).toBeInTheDocument();
    expect(prev).toBeEnabled();

    fireEvent.click(next);
    expect(next).toBeDisabled(); // last card
  });

  it("jumps via dot indicators", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(screen.getByRole("button", { name: "Go to card 3" }));
    expect(screen.getByText("Card 3 of 3 — click the card to flip")).toBeInTheDocument();
  });
});

describe("FlashcardsView — practice mode", () => {
  it("keeps the mark buttons disabled until the card is flipped", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(screen.getByRole("button", { name: /practice this deck/i }));

    expect(screen.getByRole("button", { name: /know it/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /still learning/i })).toBeDisabled();

    fireEvent.click(getCard());
    expect(screen.getByRole("button", { name: /know it/i })).toBeEnabled();
  });

  it("completes a perfect session and shows the score screen", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(screen.getByRole("button", { name: /practice this deck/i }));

    for (let i = 0; i < CARDS.length; i++) {
      fireEvent.click(getCard()); // flip
      fireEvent.click(screen.getByRole("button", { name: /know it/i }));
    }

    expect(screen.getByText("3 of 3 known")).toBeInTheDocument();
    expect(screen.getByText(/Perfect session/)).toBeInTheDocument();
  });

  it("re-queues a missed card once", () => {
    render(<FlashcardsView flashcards={[CARDS[0]]} />);
    fireEvent.click(screen.getByRole("button", { name: /practice this deck/i }));

    // Miss it once — the card must come back (2 of 2)
    fireEvent.click(getCard());
    fireEvent.click(screen.getByRole("button", { name: /still learning/i }));
    expect(screen.getByText(/2 of 2/)).toBeInTheDocument();

    // Know it on the re-queued appearance — session ends
    fireEvent.click(getCard());
    fireEvent.click(screen.getByRole("button", { name: /know it/i }));
    expect(screen.getByText("1 of 1 known")).toBeInTheDocument();
    expect(screen.getByText(/1 card still need/)).toBeInTheDocument();
  });

  it("offers a missed-only review after an imperfect session", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(screen.getByRole("button", { name: /practice this deck/i }));

    // Know the first, miss the other two (each re-queued once)
    fireEvent.click(getCard());
    fireEvent.click(screen.getByRole("button", { name: /know it/i }));
    for (let i = 0; i < 4; i++) {
      // remaining appearances: 2 originals + 2 re-queued misses
      fireEvent.click(getCard());
      fireEvent.click(screen.getByRole("button", { name: /still learning/i }));
    }

    expect(screen.getByText("1 of 3 known")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /review 2 missed/i }));
    expect(screen.getByText(/1 of 2 ·/)).toBeInTheDocument();
  });

  it("returns to browse mode from the score screen", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(screen.getByRole("button", { name: /practice this deck/i }));
    fireEvent.click(screen.getByRole("button", { name: /exit practice/i }));
    expect(screen.getByText("Card 1 of 3 — click the card to flip")).toBeInTheDocument();
  });
});
