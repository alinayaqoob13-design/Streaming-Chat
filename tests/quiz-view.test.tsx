/**
 * ============================================================================
 * COMPONENT TESTS — components/quiz-view.tsx
 * ============================================================================
 * The quiz contract: one attempt per question, instant right/wrong feedback,
 * live score, and a full retake reset.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { QuizView } from "@/components/quiz-view";
import type { QuizQuestion } from "@/types/notes";

const QUIZ: QuizQuestion[] = [
  {
    question: "Where does the Calvin cycle occur?",
    options: ["Thylakoid", "Stroma", "Nucleus", "Membrane"],
    correctIndex: 1,
    explanation: "The notes place it in the stroma.",
  },
  {
    question: "What do light reactions produce?",
    options: ["Glucose", "Oxygen only", "ATP and NADPH", "CO2"],
    correctIndex: 2,
    explanation: "ATP and NADPH power the Calvin cycle.",
  },
];

function questionBlock(question: string): HTMLElement {
  // fieldset wraps each question; scope option queries to it
  const legend = screen.getByText(question);
  return legend.closest("fieldset") as HTMLElement;
}

describe("QuizView", () => {
  it("renders every question with four options", () => {
    render(<QuizView quiz={QUIZ} />);
    expect(screen.getByText("Where does the Calvin cycle occur?")).toBeInTheDocument();
    expect(questionBlock(QUIZ[0].question).querySelectorAll("button")).toHaveLength(4);
    expect(screen.getByText(/Score: 0 \/ 2/)).toBeInTheDocument();
  });

  it("locks a question after answering and shows the explanation", () => {
    render(<QuizView quiz={QUIZ} />);
    const block = questionBlock(QUIZ[0].question);
    fireEvent.click(within(block).getByRole("button", { name: "Stroma" }));

    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/The notes place it in the stroma\./)).toBeInTheDocument();
    within(block).getAllByRole("button").forEach((btn) => expect(btn).toBeDisabled());
    expect(screen.getByText(/Score: 1 \/ 2/)).toBeInTheDocument();
  });

  it("marks a wrong pick and reveals the right answer", () => {
    render(<QuizView quiz={QUIZ} />);
    const block = questionBlock(QUIZ[0].question);
    fireEvent.click(within(block).getByRole("button", { name: "Nucleus" }));

    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    // The wrong pick carries the X icon, the right answer carries the check
    expect(within(block).getByRole("button", { name: "Stroma" }).className).toContain("success");
    expect(within(block).getByRole("button", { name: "Nucleus" }).className).toContain("danger");
    expect(screen.getByText(/Score: 0 \/ 2/)).toBeInTheDocument();
  });

  it("shows the final score once all questions are answered", () => {
    render(<QuizView quiz={QUIZ} />);
    fireEvent.click(within(questionBlock(QUIZ[0].question)).getByRole("button", { name: "Stroma" }));
    fireEvent.click(
      within(questionBlock(QUIZ[1].question)).getByRole("button", { name: "Glucose" })
    );
    expect(screen.getByText("Final score: 1 / 2")).toBeInTheDocument();
  });

  it("ignores a second click on an answered question", () => {
    render(<QuizView quiz={QUIZ} />);
    const block = questionBlock(QUIZ[0].question);
    fireEvent.click(within(block).getByRole("button", { name: "Stroma" }));
    fireEvent.click(within(block).getByRole("button", { name: "Nucleus" })); // disabled
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Score: 1 \/ 2/)).toBeInTheDocument();
  });

  it("resets everything on Retake", () => {
    render(<QuizView quiz={QUIZ} />);
    const block = questionBlock(QUIZ[0].question);
    fireEvent.click(within(block).getByRole("button", { name: "Stroma" }));
    fireEvent.click(screen.getByRole("button", { name: /retake/i }));

    expect(screen.getByText(/Score: 0 \/ 2/)).toBeInTheDocument();
    expect(screen.queryByText(/Correct\./)).not.toBeInTheDocument();
    within(questionBlock(QUIZ[0].question))
      .getAllByRole("button")
      .forEach((btn) => expect(btn).toBeEnabled());
  });

  it("shows a review panel with wrong answers after the quiz is finished", () => {
    render(<QuizView quiz={QUIZ} />);
    fireEvent.click(within(questionBlock(QUIZ[0].question)).getByRole("button", { name: "Nucleus" }));
    fireEvent.click(
      within(questionBlock(QUIZ[1].question)).getByRole("button", { name: "Glucose" })
    );

    expect(screen.getByRole("heading", { name: /review your mistakes/i })).toBeInTheDocument();
    // Review panel repeats the question text, so assert the correct answers instead
    expect(screen.getByText(/Correct answer: Stroma/)).toBeInTheDocument();
    expect(screen.getByText(/Correct answer: ATP and NADPH/)).toBeInTheDocument();
  });

  it("retakes only the missed questions", () => {
    render(<QuizView quiz={QUIZ} />);
    fireEvent.click(within(questionBlock(QUIZ[0].question)).getByRole("button", { name: "Stroma" }));
    fireEvent.click(
      within(questionBlock(QUIZ[1].question)).getByRole("button", { name: "Glucose" })
    );

    fireEvent.click(screen.getByRole("button", { name: /retake 1 missed/i }));

    // Q0 stays answered and correct; Q1 is now open again
    expect(screen.queryByText(/Final score:/)).not.toBeInTheDocument();
    expect(screen.getByText(/Score: 1 \/ 2/)).toBeInTheDocument();
    // Q1 buttons re-enable so it can be retaken
    within(questionBlock(QUIZ[1].question))
      .getAllByRole("button")
      .forEach((btn) => expect(btn).toBeEnabled());
    // Review panel disappears once retake starts
    expect(screen.queryByRole("heading", { name: /review your mistakes/i })).not.toBeInTheDocument();
  });
});

describe("QuizView — misreporting and focus (Phase 6B)", () => {
  it("reports a miss only when the chosen answer is wrong", () => {
    const onMissQuestion = vi.fn();
    render(<QuizView quiz={QUIZ} onMissQuestion={onMissQuestion} />);

    // Correct pick — no miss
    fireEvent.click(within(questionBlock(QUIZ[0].question)).getByRole("button", { name: "Stroma" }));
    // Wrong pick — one miss
    fireEvent.click(
      within(questionBlock(QUIZ[1].question)).getByRole("button", { name: "Glucose" })
    );
    expect(onMissQuestion).toHaveBeenCalledTimes(1);
    expect(onMissQuestion).toHaveBeenCalledWith(1);
  });

  it("reports exactly once per locked attempt, even across a retake", () => {
    const onMissQuestion = vi.fn();
    render(<QuizView quiz={QUIZ} onMissQuestion={onMissQuestion} />);

    const block = questionBlock(QUIZ[0].question);
    fireEvent.click(within(block).getByRole("button", { name: "Nucleus" }));
    expect(onMissQuestion).toHaveBeenCalledTimes(1);

    expect(screen.getByText(/Tip:/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retake/i }));
    fireEvent.click(within(questionBlock(QUIZ[0].question)).getByRole("button", { name: "Thylakoid" }));
    expect(onMissQuestion).toHaveBeenCalledTimes(2);
  });

  it("highlights the focusIndex question on mount", () => {
    render(<QuizView quiz={QUIZ} focusIndex={1} />);
    expect(questionBlock(QUIZ[1].question).className).toContain("ring-1");
    expect(questionBlock(QUIZ[0].question).className).not.toContain("ring-1");
  });
});

describe("QuizView — keyboard shortcuts", () => {
  it("answers the next open question with the 1-9 keys", () => {
    const onMissQuestion = vi.fn();
    render(<QuizView quiz={QUIZ} onMissQuestion={onMissQuestion} />);
    expect(screen.getByText(/Question 1 of 2/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "1" }); // Q1 option 0 — wrong (correctIndex 1)
    expect(screen.getByText(/Not quite\./)).toBeInTheDocument();
    expect(onMissQuestion).toHaveBeenCalledWith(0);

    // Next key press targets the NEXT unanswered question (Q2)
    fireEvent.keyDown(window, { key: "3" }); // Q2 option 2 — ATP and NADPH ✓
    expect(screen.getByText(/Correct\./)).toBeInTheDocument();
    expect(screen.getByText(/Final score: 1 \/ 2/)).toBeInTheDocument();
  });

  it("never answers while typing in an input-like element", () => {
    render(<QuizView quiz={QUIZ} />);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    fireEvent.keyDown(input, { key: "1" });
    expect(screen.getByText(/Score: 0 \/ 2/)).toBeInTheDocument();
    input.remove();
  });

  it("ignores number keys beyond the current question's option count", () => {
    render(<QuizView quiz={QUIZ} />);
    fireEvent.keyDown(window, { key: "9" }); // Q1 has only 4 options
    expect(screen.getByText(/Score: 0 \/ 2/)).toBeInTheDocument();
  });
});

describe("QuizView — mid-quiz persistence (persistKey)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("restores answers and score after an unmount/remount", () => {
    const { unmount } = render(<QuizView quiz={QUIZ} persistKey="set-1" />);
    fireEvent.click(within(questionBlock(QUIZ[0].question)).getByRole("button", { name: "Stroma" }));
    expect(screen.getByText(/Score: 1 \/ 2/)).toBeInTheDocument();
    unmount();

    render(<QuizView quiz={QUIZ} persistKey="set-1" />);
    // Question is locked again with the saved pick, explanation restored
    const block = questionBlock(QUIZ[0].question);
    const buttons = within(block).getAllByRole("button");
    buttons.forEach((btn) => expect(btn).toBeDisabled());
    expect(within(block).getByRole("button", { name: "Stroma" }).className).toContain("success");
    expect(screen.getByText(/The notes place it in the stroma\./)).toBeInTheDocument();
    expect(screen.getByText(/Score: 1 \/ 2/)).toBeInTheDocument();
  });

  it("restores wrong picks into the review panel via 'Retake missed'", () => {
    const { unmount } = render(<QuizView quiz={QUIZ} persistKey="set-1" />);
    fireEvent.click(within(questionBlock(QUIZ[0].question)).getByRole("button", { name: "Nucleus" }));
    fireEvent.click(
      within(questionBlock(QUIZ[1].question)).getByRole("button", { name: "Glucose" })
    );
    expect(screen.queryByText(/Final score:/)).toBeInTheDocument();
    unmount();

    render(<QuizView quiz={QUIZ} persistKey="set-1" />);
    // Final state restored, review panel available, and the missed retake
    // re-opens exactly the wrong question (Q1 stays answered).
    expect(screen.queryByText(/Final score: 0 \/ 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retake 2 missed/i }));
    expect(screen.queryByText(/Final score:/)).not.toBeInTheDocument();
    within(questionBlock(QUIZ[1].question))
      .getAllByRole("button")
      .forEach((btn) => expect(btn).toBeEnabled());
  });

  it("is refreshed by a full retake (localStorage clears with state)", () => {
    const { unmount } = render(<QuizView quiz={QUIZ} persistKey="set-1" />);
    fireEvent.click(within(questionBlock(QUIZ[0].question)).getByRole("button", { name: "Stroma" }));
    fireEvent.click(screen.getByRole("button", { name: /retake/i }));
    unmount();

    render(<QuizView quiz={QUIZ} persistKey="set-1" />);
    expect(screen.getByText(/Score: 0 \/ 2/)).toBeInTheDocument();
    within(questionBlock(QUIZ[0].question))
      .getAllByRole("button")
      .forEach((btn) => expect(btn).toBeEnabled());
  });

  it("does not persist anything without a persistKey", () => {
    render(<QuizView quiz={QUIZ} />);
    fireEvent.click(within(questionBlock(QUIZ[0].question)).getByRole("button", { name: "Stroma" }));
    expect(localStorage.getItem("capstone-quiz-progress:")).toBeNull();
  });
});
