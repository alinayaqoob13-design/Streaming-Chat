/**
 * ============================================================================
 * COMPONENT TESTS — flashcards-view.tsx "Listen" (text-to-speech)
 * ============================================================================
 *
 * Covers the speechSynthesis integration on the flip deck: the button reads
 * the visible side aloud, stops on request, prefers an Urdu voice/locale for
 * Arabic-script text, and cancels speech when the card changes.
 *
 * jsdom has no speechSynthesis, so the global API is stubbed before render;
 * the component feature-detects it with `in window` at mount time.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlashcardsView } from "@/components/flashcards-view";
import type { Flashcard } from "@/types/notes";

const CARDS: Flashcard[] = [
  { front: "What is a process?", back: "A program in execution." },
  { front: "یہ ایک کارڈ ہے۔", back: "یہ اس کا جواب ہے۔" },
];

class MockUtterance {
  text: string;
  lang: string | undefined;
  rate: number | undefined;
  voice: unknown;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

const speakMock = vi.fn();
const cancelMock = vi.fn();

beforeEach(() => {
  speakMock.mockClear();
  cancelMock.mockClear();
  vi.stubGlobal("SpeechSynthesisUtterance", MockUtterance);
  vi.stubGlobal("speechSynthesis", {
    speak: speakMock,
    cancel: cancelMock,
    getVoices: () => [],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function listenButton(): HTMLElement {
  return screen.getByRole("button", { name: /read the visible side/i });
}

describe("FlashcardsView — Listen (text-to-speech)", () => {
  it("speaks the visible card side and toggles to Stop", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(listenButton());

    expect(speakMock).toHaveBeenCalledTimes(1);
    const utterance = speakMock.mock.calls[0][0] as MockUtterance;
    expect(utterance.text).toBe("What is a process?");

    // Button flips to the Stop state while speaking…
    expect(screen.getByRole("button", { name: /stop reading/i })).toBeInTheDocument();
    // …and pressing it again cancels.
    fireEvent.click(screen.getByRole("button", { name: /stop reading/i }));
    expect(cancelMock).toHaveBeenCalled();
  });

  it("speaks the back after flipping", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(screen.getByRole("button", { name: /flashcard:|answer:/i })); // flip
    fireEvent.click(listenButton());

    const utterance = speakMock.mock.calls[0][0] as MockUtterance;
    expect(utterance.text).toBe("A program in execution.");
  });

  it("sets the Urdu locale for Arabic-script card text", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    fireEvent.click(listenButton());

    const utterance = speakMock.mock.calls[0][0] as MockUtterance;
    expect(utterance.text).toBe("یہ ایک کارڈ ہے۔");
    expect(utterance.lang).toBe("ur-PK");
  });

  it("cancels speech when navigating to another card", () => {
    render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(listenButton());
    // speakSide itself cancels once to kill any prior speech…
    expect(cancelMock).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    // …and goTo cancels again so old speech never rides along.
    expect(cancelMock).toHaveBeenCalledTimes(2);
  });

  it("stops speaking on unmount (no ghost audio)", () => {
    const { unmount } = render(<FlashcardsView flashcards={CARDS} />);
    fireEvent.click(listenButton());
    unmount();
    expect(cancelMock).toHaveBeenCalled();
  });
});