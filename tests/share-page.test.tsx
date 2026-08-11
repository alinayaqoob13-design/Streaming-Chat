/**
 * ============================================================================
 * SHARE IMPORT PAGE — app/share/page.tsx
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SharePage from "@/app/share/page";
import { encodeStudySet } from "@/lib/share-link";
import type { SavedStudySet } from "@/types/notes";

const navigationMock = vi.hoisted(() => ({
  params: new URLSearchParams(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => navigationMock.params,
  useRouter: () => ({ push: navigationMock.push }),
}));

const SET: SavedStudySet = {
  id: "imported-set",
  title: "Operating Systems",
  summary: "Processes and threads.",
  sourceNotes: "A process is a program in execution.",
  createdAt: 1_700_000_000_000,
  flashcards: [{ front: "Process?", back: "Program in execution." }],
  quiz: [
    {
      question: "What is a process?",
      options: ["Program", "File", "CPU", "Thread"],
      correctIndex: 0,
      explanation: "From the notes.",
    },
  ],
};

describe("SharePage", () => {
  beforeEach(() => {
    localStorage.clear();
    navigationMock.params = new URLSearchParams();
    navigationMock.push.mockClear();
  });

  it("shows a preview and imports a valid shared set", async () => {
    const encoded = encodeStudySet(SET)!;
    navigationMock.params = new URLSearchParams({ s: encoded });

    render(<SharePage />);
    await waitFor(() => expect(screen.getByText("Operating Systems")).toBeInTheDocument());
    expect(screen.getByText("1 flashcards")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /import into my library/i }));
    await waitFor(() => expect(navigationMock.push).toHaveBeenCalledWith("/study-set/imported-set"));

    const stored = JSON.parse(localStorage.getItem("capstone-study-sets") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("imported-set");
  });

  it("shows an invalid-link screen for a missing payload", async () => {
    render(<SharePage />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /invalid share link/i })).toBeInTheDocument()
    );
  });

  it("shows an invalid-link screen for a corrupt payload", async () => {
    navigationMock.params = new URLSearchParams({ s: "garbage" });

    render(<SharePage />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /invalid share link/i })).toBeInTheDocument()
    );
  });
});
