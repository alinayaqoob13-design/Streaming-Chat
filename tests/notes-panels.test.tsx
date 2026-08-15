/**
 * ============================================================================
 * COMPONENT TESTS — notes-history, notes-result, notes-chat
 * ============================================================================
 * Small, focused suites for the remaining interactive components.
 * notes-chat's useChat is mocked — the streaming transport is the SDK's
 * job, ours is the panel contract (suggestions, message list, states).
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotesHistory } from "@/components/notes-history";
import { NotesResult } from "@/components/notes-result";
import type { SavedStudySet, StudyNotes } from "@/types/notes";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const SET: StudyNotes = {
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

const SAVED: SavedStudySet = {
  ...SET,
  id: "set-1",
  title: "Operating Systems — Lecture 7",
  createdAt: new Date(2026, 7, 10).getTime(),
  sourceNotes: "A process is a program in execution. Threads are lightweight units.",
  language: "en",
};

// ---------------------------------------------------------------------------
// NotesHistory
// ---------------------------------------------------------------------------
describe("NotesHistory", () => {
  it("renders nothing when there are no saved sets", () => {
    const { container } = render(
      <NotesHistory sets={[]} onOpen={vi.fn()} onDelete={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists sets with title, counts, and date", () => {
    render(
      <NotesHistory sets={[SAVED]} onOpen={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("Operating Systems — Lecture 7")).toBeInTheDocument();
    expect(screen.getByText("2 flashcards · 1 quiz questions")).toBeInTheDocument();
    expect(screen.getByText("Aug 10")).toBeInTheDocument();
  });

  it("opens a set on row click and deletes via the trash button", () => {
    const onOpen = vi.fn();
    const onDelete = vi.fn();
    render(<NotesHistory sets={[SAVED]} onOpen={onOpen} onDelete={onDelete} />);

    fireEvent.click(screen.getByText("Operating Systems — Lecture 7"));
    expect(onOpen).toHaveBeenCalledWith(SAVED);

    fireEvent.click(screen.getByRole("button", { name: /delete study set/i }));
    expect(onDelete).toHaveBeenCalledWith("set-1");
  });

  it("filters the list by title or flashcard term", async () => {
    const other: SavedStudySet = {
      ...SET,
      id: "set-2",
      title: "Databases — Lecture 2",
      createdAt: SAVED.createdAt,
      sourceNotes: "…",
      // Unique card so the flashcard search can discriminate the sets
      flashcards: [{ front: "What is a primary key?", back: "A unique row identifier." }],
    };
    render(
      <NotesHistory sets={[SAVED, other]} onOpen={vi.fn()} onDelete={vi.fn()} />
    );

    // Title match
    fireEvent.change(screen.getByLabelText(/search saved study sets/i), {
      target: { value: "operating" },
    });
    expect(screen.getByText("Operating Systems — Lecture 7")).toBeInTheDocument();
    // Non-matching rows linger briefly for the AnimatePresence exit — wait it out
    await waitFor(() =>
      expect(screen.queryByText("Databases — Lecture 2")).not.toBeInTheDocument()
    );

    // Flashcard-term match (only the DATABASES set carries a unique term)
    fireEvent.change(screen.getByLabelText(/search saved study sets/i), {
      target: { value: other.flashcards[0].front },
    });
    await waitFor(() =>
      expect(screen.queryByText("Operating Systems — Lecture 7")).not.toBeInTheDocument()
    );
    expect(screen.getByText("Databases — Lecture 2")).toBeInTheDocument();

    // No matches → friendly empty state, list is gone
    fireEvent.change(screen.getByLabelText(/search saved study sets/i), {
      target: { value: "zzz-no-such-term" },
    });
    expect(screen.getByText(/no saved sets match/i)).toBeInTheDocument();
  });

  it("does not render share/restore controls — delete only per row", () => {
    render(
      <NotesHistory sets={[SAVED]} onOpen={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: /export study set/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/restore backup/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete study set/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NotesResult (tabs)
// ---------------------------------------------------------------------------
describe("NotesResult", () => {
  it("shows the summary tab by default", () => {
    render(<NotesResult result={SET} />);
    expect(screen.getByText("A program in execution.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /summary/i })).toHaveAttribute("aria-selected", "true");
  });

  it("switches to flashcards and quiz tabs", async () => {
    render(<NotesResult result={SET} />);

    fireEvent.click(screen.getByRole("tab", { name: /flashcards \(2\)/i }));
    expect(await screen.findByText(/Card 1 of 2/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /quiz \(1\)/i }));
    expect(await screen.findByText("What is a process?")).toBeInTheDocument();
  });

  it("renders the panel right-to-left for Urdu output", () => {
    const { container } = render(<NotesResult result={SET} language="ur" />);
    expect(container.querySelector('[dir="rtl"]')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NotesResult — Weak Areas (Phase 6B)
// ---------------------------------------------------------------------------
describe("NotesResult — Weak Areas", () => {
  const WEAK_SET: StudyNotes = {
    summary: "x",
    flashcards: [
      { front: "Missed card A", back: "back of A", missCount: 3 },
      { front: "Shaky card B", back: "back of B", missCount: 2 },
      { front: "Clean card C", back: "back of C" },
    ],
    quiz: [
      {
        question: "Tricky question?",
        options: ["a", "b", "c", "d"],
        correctIndex: 0,
        explanation: "e",
        missCount: 2,
      },
    ],
  };

  it("counts qualifying items on the tab and lists them sorted by misses", async () => {
    render(<NotesResult result={WEAK_SET} />);
    fireEvent.click(screen.getByRole("tab", { name: /weak areas \(3\)/i }));

    expect(await screen.findByText("Missed card A")).toBeInTheDocument();
    expect(screen.getByText("Shaky card B")).toBeInTheDocument();
    expect(screen.getByText("Tricky question?")).toBeInTheDocument();
    // Below threshold — filtered out entirely
    expect(screen.queryByText("Clean card C")).not.toBeInTheDocument();
    // Most-missed first, ties keep source order
    const badges = screen.getAllByText(/^\d+ misses?$/);
    expect(badges[0]).toHaveTextContent("3 misses");
  });

  it("shows an empty state when nothing qualifies", async () => {
    render(<NotesResult result={SET} />);
    fireEvent.click(screen.getByRole("tab", { name: /weak areas \(0\)/i }));
    expect(await screen.findByText("No weak areas yet")).toBeInTheDocument();
  });

  it("jumps to a specific flashcard from a weak item", async () => {
    render(<NotesResult result={WEAK_SET} />);
    fireEvent.click(screen.getByRole("tab", { name: /weak areas \(3\)/i }));
    fireEvent.click(await screen.findByRole("button", { name: /review flashcard 2/i }));

    // Landed on the flashcards tab at exactly that card
    expect(await screen.findByText("Card 2 of 3 — click the card to flip")).toBeInTheDocument();
    expect(screen.getByText("Shaky card B")).toBeInTheDocument();
  });

  it("jumps to a specific quiz question from a weak item", async () => {
    render(<NotesResult result={WEAK_SET} />);
    fireEvent.click(screen.getByRole("tab", { name: /weak areas \(3\)/i }));
    fireEvent.click(await screen.findByRole("button", { name: /review question 1/i }));

    expect(await screen.findByText("Tricky question?")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// NotesChat (mocked useChat)
// ---------------------------------------------------------------------------
const appendMock = vi.fn();
const stopMock = vi.fn();
const reloadMock = vi.fn();
let chatState: {
  messages: { id: string; role: string; content: string }[];
  status: string;
  error: Error | undefined;
};

vi.mock("ai/react", () => ({
  useChat: () => ({
    messages: chatState.messages,
    status: chatState.status,
    error: chatState.error,
    append: appendMock,
    stop: stopMock,
    reload: reloadMock,
  }),
}));

import { NotesChat } from "@/components/notes-chat";

describe("NotesChat", () => {
  beforeEach(() => {
    appendMock.mockReset();
    chatState = { messages: [], status: "ready", error: undefined };
  });

  it("shows suggested questions in the empty state and sends them via append", () => {
    render(<NotesChat notes="some notes" />);
    fireEvent.click(screen.getByRole("button", { name: /most exam-worthy/i }));
    expect(appendMock).toHaveBeenCalledWith({
      role: "user",
      content: "Which points are most exam-worthy?",
    });
  });

  it("uses the notes-focused placeholder", () => {
    render(<NotesChat notes="some notes" />);
    expect(screen.getByPlaceholderText(/ask a question about your notes/i)).toBeInTheDocument();
  });

  it("renders the conversation when messages exist", () => {
    chatState.messages = [
      { id: "1", role: "user", content: "Where is the Calvin cycle?" },
      { id: "2", role: "assistant", content: "In the stroma." },
    ];
    render(<NotesChat notes="some notes" />);
    expect(screen.getByText("Where is the Calvin cycle?")).toBeInTheDocument();
    expect(screen.getByText("In the stroma.")).toBeInTheDocument();
  });

  it("shows the error banner when the stream fails", () => {
    chatState.error = new Error("boom");
    render(<NotesChat notes="some notes" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i);
  });
});
