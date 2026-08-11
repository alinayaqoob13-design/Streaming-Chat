/**
 * ============================================================================
 * DEEP-LINK PAGE TESTS — app/study-set/[id]/page.tsx
 * ============================================================================
 * The page is a thin client-side loader: it checks localStorage for the id in
 * the URL, renders NotesBuddy when found, and shows a 404 otherwise.
 * NotesBuddy itself is mocked so these tests stay focused on routing logic.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StudySetPage from "@/app/study-set/[id]/page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "set-abc" }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/components/notes-buddy", () => ({
  default: function MockNotesBuddy({ initialSetId }: { initialSetId?: string }) {
    return <div data-testid="notes-buddy">{initialSetId}</div>;
  },
}));

describe("StudySetPage", () => {
  beforeEach(() => {
    localStorage.clear();
    pushMock.mockClear();
  });

  it("renders NotesBuddy with the id when the saved set exists", async () => {
    localStorage.setItem(
      "capstone-study-sets",
      JSON.stringify([{ id: "set-abc", title: "OS Lecture" }])
    );

    render(<StudySetPage />);
    await waitFor(() => expect(screen.getByTestId("notes-buddy")).toBeInTheDocument());
    expect(screen.getByTestId("notes-buddy")).toHaveTextContent("set-abc");
  });

  it("shows a 404 screen when the set id is not in localStorage", async () => {
    render(<StudySetPage />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /study set not found/i })).toBeInTheDocument()
    );
  });

  it("navigates home from the 404 screen", async () => {
    render(<StudySetPage />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /study set not found/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /back home/i }));
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
