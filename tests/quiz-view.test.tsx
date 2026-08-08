/**
 * ============================================================================
 * COMPONENT TESTS — components/quiz-view.tsx
 * ============================================================================
 * The quiz contract: one attempt per question, instant right/wrong feedback,
 * live score, and a full retake reset.
 * ============================================================================
 */

import { describe, it, expect } from "vitest";
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
});
