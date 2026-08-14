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

import { describe, it, expect, vi, afterEach } from "vitest";
import { useState } from "react";
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

describe("FlashcardsView — browse search", () => {
  it("filters the deck by front/back text and reports position in the match set", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.change(screen.getByLabelText(/search flashcards/i), { target: { value: "thread" } });

    expect(screen.getByText("Card 1 of 1 matching — click to flip")).toBeInTheDocument();
    expect(screen.getByText("What is a thread?")).toBeInTheDocument();
    expect(screen.queryByText("What is a process?")).not.toBeInTheDocument();
    expect(screen.queryByText("What is a PCB?")).not.toBeInTheDocument();
  });

  it("shows an empty state when nothing matches", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.change(screen.getByLabelText(/search flashcards/i), { target: { value: "zzz" } });
    expect(screen.getByText("No cards match your search")).toBeInTheDocument();
  });

  it("hides practice/study actions and shrinks the dots during a search", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.change(screen.getByLabelText(/search flashcards/i), { target: { value: "pcb" } });

    expect(screen.queryByRole("button", { name: /practice this deck/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /study due cards/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go to card 2" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to card 1" })).toBeInTheDocument();

    // Clearing the query restores the full deck
    fireEvent.change(screen.getByLabelText(/search flashcards/i), { target: { value: "" } });
    expect(screen.getByText("Card 1 of 3 — click the card to flip")).toBeInTheDocument();
  });
});

describe("FlashcardsView — keyboard shortcuts", () => {
  it("flips with Space in browse mode", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.keyDown(window, { key: " " });
    expect(getCard()).toHaveAccessibleName("Answer: A program in execution.");
  });

  it("rates practice progress with the 1/2 keys after flipping", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(screen.getByRole("button", { name: /practice this deck/i }));
    // Real users focus the button after clicking it — Space would re-click it.
    // Blur to reach the window key handler, like clicking the card would.
    (document.activeElement as HTMLElement | null)?.blur?.();
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "1" }); // missed

    // Status line is "N of M · K known · J missed" with the counts in their
    // own spans — assert per-part so split-up text still matches. The queue
    // is 4 long: 3 unique cards + 1 reserved re-queue slot.
    expect(screen.getByText(/2 of 4/)).toBeInTheDocument();
    expect(screen.getByText("0 known")).toBeInTheDocument();
    expect(screen.getByText("1 missed")).toBeInTheDocument();
  });

  it("rates study (SRS) cards with 1/2/3 after flipping", () => {
    const onRateCard = vi.fn();
    render(<FlashcardsView flashcards={CARDS} sourceNotes="source" onRateCard={onRateCard} />);
    fireEvent.click(screen.getByRole("button", { name: /study due cards/i }));
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "3" }); // Easy

    expect(onRateCard).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ front: "What is a process?" })
    );
  });

  it("ignores keys typed into the search field", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    const search = screen.getByLabelText(/search flashcards/i);
    fireEvent.keyDown(search, { key: " ", target: search });
    // Space must not flip the card — the card still shows its front
    expect(getCard()).toHaveAccessibleName(/flashcard:/i);
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

describe("FlashcardsView — study (SRS) mode", () => {
  const NOT_DUE: Flashcard = {
    front: "already reviewed",
    back: "scheduled far in the future",
    nextReviewAt: "2099-01-01T00:00:00.000Z",
  };

  // Minics the real orchestrator: ratings update the flashcards, so SRS state
  // (and the due chip) visibly changes while a session runs.
  function Harness({ cards }: { cards: Flashcard[] }) {
    const [state, setState] = useState(cards);
    return (
      <FlashcardsView
        flashcards={state}
        onRateCard={(index, updated) =>
          setState((prev) => prev.map((c, i) => (i === index ? updated : c)))
        }
      />
    );
  }

  function rateInStudy(ratingName: RegExp, times: number) {
    // Flip, rate, advance — per card in the study queue
    for (let i = 0; i < times; i++) {
      fireEvent.click(getCard());
      fireEvent.click(screen.getByRole("button", { name: ratingName }));
    }
  }

  it("shows the due-count chip and queues only due cards", () => {
    render(<Harness cards={[...CARDS, NOT_DUE]} />);
    expect(screen.getByText("3 cards due today")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /study due cards/i }));
    expect(screen.getByText(/Reviewing due cards · 1 of 3/)).toBeInTheDocument();

    // Review all three due cards — the not-due card is never queued
    rateInStudy(/^Good/, 3);
    expect(screen.getByText("Card 1 of 4 — click the card to flip")).toBeInTheDocument();
    expect(screen.getByText("All caught up — no cards due today")).toBeInTheDocument();
  });

  it("disables the study button when nothing is due", () => {
    render(<FlashcardsView flashcards={[NOT_DUE]} />);
    expect(screen.getByText("All caught up — no cards due today")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /study due cards/i })).toBeDisabled();
  });

  it("keeps the rating buttons disabled until the card is flipped", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(screen.getByRole("button", { name: /study due cards/i }));
    expect(screen.getByRole("button", { name: /^Again/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Good/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Easy/ })).toBeDisabled();

    fireEvent.click(getCard());
    expect(screen.getByRole("button", { name: /^Good/ })).toBeEnabled();
  });

  it("reports the rating to the parent with the rescheduled card", () => {
    const onRateCard = vi.fn();
    render(<FlashcardsView flashcards={CARDS} onRateCard={onRateCard} />);
    fireEvent.click(screen.getByRole("button", { name: /study due cards/i }));

    fireEvent.click(getCard());
    fireEvent.click(screen.getByRole("button", { name: /^Good/ }));
    expect(onRateCard).toHaveBeenCalledTimes(1);
    expect(onRateCard.mock.calls[0][0]).toBe(0);
    expect(onRateCard.mock.calls[0][1]).toMatchObject({
      cardId: expect.any(String),
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 1,
      lastReviewedAt: expect.any(String),
      nextReviewAt: expect.any(String),
    });
  });

  it("resets scheduling when a card is rated Again", () => {
    const onRateCard = vi.fn();
    render(<FlashcardsView flashcards={CARDS} onRateCard={onRateCard} />);
    fireEvent.click(screen.getByRole("button", { name: /study due cards/i }));

    fireEvent.click(getCard());
    fireEvent.click(screen.getByRole("button", { name: /^Again/ }));
    expect(onRateCard.mock.calls[0][1]).toMatchObject({
      intervalDays: 1,
      repetitions: 0,
      // Phase 6B: an Again rating also records a miss for weak-area tracking
      missCount: 1,
    });
    expect(onRateCard.mock.calls[0][1].easeFactor).toBeLessThan(2.5);
  });

  it("starts browse at a given initialIndex", () => {
    render(<FlashcardsView flashcards={CARDS} initialIndex={2} />);
    expect(screen.getByText("Card 3 of 3 — click the card to flip")).toBeInTheDocument();
  });

  it("clamps an out-of-range initialIndex to the last card", () => {
    render(<FlashcardsView flashcards={CARDS} initialIndex={99} />);
    expect(screen.getByText("Card 3 of 3 — click the card to flip")).toBeInTheDocument();
  });

  it("exits a study session back to browse", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(screen.getByRole("button", { name: /study due cards/i }));
    fireEvent.click(screen.getByRole("button", { name: /exit study/i }));
    expect(screen.getByText("Card 1 of 3 — click the card to flip")).toBeInTheDocument();
  });
});

describe("FlashcardsView — explain differently", () => {
  const NOTES = "Threads are lightweight units of execution sharing memory.";

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not render the feature without source notes", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    expect(screen.queryByRole("button", { name: /explain differently/i })).not.toBeInTheDocument();
  });

  it("fetches an alternate explanation grounded in the notes and shows it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        explanation: "Think of a thread as one errand run inside the process's house.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<FlashcardsView flashcards={CARDS} sourceNotes={NOTES} />);
    fireEvent.click(screen.getByRole("button", { name: /explain differently/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/notes/explain");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.notes).toBe(NOTES);
    expect(body.card).toEqual({ front: CARDS[0].front, back: CARDS[0].back });

    expect(await screen.findByText(/one errand run/)).toBeInTheDocument();
  });

  it("keeps the original answer one toggle away", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ explanation: "An alternate phrasing of the answer." }),
      })
    );

    render(<FlashcardsView flashcards={CARDS} sourceNotes={NOTES} />);
    fireEvent.click(screen.getByRole("button", { name: /explain differently/i }));
    await screen.findByText(/alternate phrasing/);

    // The panel switches to the original answer text (the card back is always
    // in the DOM behind the 3D flip, so assert on the panel's label instead
    // of the text itself)
    fireEvent.click(screen.getByRole("button", { name: /show original answer/i }));
    expect(screen.getByText("Original answer")).toBeInTheDocument();
    expect(screen.queryByText(/alternate phrasing/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /show explanation/i }));
    expect(screen.getByText(/alternate phrasing/)).toBeInTheDocument();
  });

  it("shows an inline error and retries without a reload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "boom" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ explanation: "Second attempt worked." }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<FlashcardsView flashcards={CARDS} sourceNotes={NOTES} />);
    fireEvent.click(screen.getByRole("button", { name: /explain differently/i }));

    expect(await screen.findByText(/couldn't explain this card/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByText("Second attempt worked.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
