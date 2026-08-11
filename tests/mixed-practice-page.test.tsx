/**
 * ============================================================================
 * MIXED PRACTICE PAGE — app/mixed-practice/page.tsx
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import MixedPracticePage from "@/app/mixed-practice/page";
import type { SavedStudySet } from "@/types/notes";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const SET: SavedStudySet = {
  id: "set-a",
  title: "Set A",
  summary: "Summary A",
  sourceNotes: "Notes A",
  createdAt: 1,
  flashcards: [],
  quiz: [
    {
      question: "Q1 from A",
      options: ["a", "b", "c", "d"],
      correctIndex: 0,
      explanation: "Because A.",
    },
  ],
};

const SET2: SavedStudySet = {
  ...SET,
  id: "set-b",
  title: "Set B",
  quiz: [
    {
      question: "Q1 from B",
      options: ["a", "b", "c", "d"],
      correctIndex: 1,
      explanation: "Because B.",
    },
  ],
};

describe("MixedPracticePage", () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
  });

  it("shows an empty state when there are no saved sets", async () => {
    render(<MixedPracticePage />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /nothing to practice yet/i })).toBeInTheDocument()
    );
  });

  it("renders a mixed quiz from saved sets", async () => {
    localStorage.setItem("capstone-study-sets", JSON.stringify([SET, SET2]));
    render(<MixedPracticePage />);

    await waitFor(() => expect(screen.getByText("Mixed practice")).toBeInTheDocument());
    expect(screen.getByText(/questions from \d saved set/i)).toBeInTheDocument();
    // At least one of the two questions should appear
    expect(
      screen.queryByText("Q1 from A") ?? screen.queryByText("Q1 from B")
    ).toBeInTheDocument();
  });

  it("records a miss on the source set when a question is answered wrong", async () => {
    localStorage.setItem("capstone-study-sets", JSON.stringify([SET]));
    render(<MixedPracticePage />);

    await waitFor(() => expect(screen.getByText("Q1 from A")).toBeInTheDocument());

    // Click a wrong option (index 1)
    fireEvent.click(screen.getByRole("button", { name: "b" }));

    const stored = JSON.parse(localStorage.getItem("capstone-study-sets") ?? "[]");
    expect(stored[0].quiz[0].missCount).toBe(1);
  });
});
