/**
 * ============================================================================
 * LIB TESTS — lib/quiz-progress.ts
 * ============================================================================
 * Mid-quiz answers persist per study set under localStorage
 * ("capstone-quiz-progress:<setId>") so a tab switch or reload does not
 * erase the session. Loading is defensive: items pointing at questions or
 * options that no longer exist are dropped before they can lock the UI.
 * ============================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  quizProgressStorageKey,
  loadQuizProgress,
  saveQuizProgress,
  clearQuizProgress,
  pruneOrphanQuizProgress,
} from "@/lib/quiz-progress";

const SET_ID = "set-100";
/** Two questions: 4 options each (the QUIZ fixture shape from quiz-view tests) */
const OPTION_COUNTS = [4, 4];

describe("quiz progress storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is saved yet", () => {
    expect(loadQuizProgress(SET_ID, OPTION_COUNTS)).toBeNull();
  });

  it("round-trips saved answers", () => {
    saveQuizProgress(SET_ID, { 0: 2, 1: 0 });
    expect(loadQuizProgress(SET_ID, OPTION_COUNTS)).toEqual({ 0: 2, 1: 0 });
  });

  it("clears a set's saved answers", () => {
    saveQuizProgress(SET_ID, { 0: 1 });
    clearQuizProgress(SET_ID);
    expect(loadQuizProgress(SET_ID, OPTION_COUNTS)).toBeNull();
    expect(localStorage.getItem(quizProgressStorageKey(SET_ID))).toBeNull();
  });

  it("drops a question index beyond the current quiz", () => {
    localStorage.setItem(quizProgressStorageKey(SET_ID), JSON.stringify({ 0: 1, 7: 2 }));
    expect(loadQuizProgress(SET_ID, OPTION_COUNTS)).toEqual({ 0: 1 });
  });

  it("drops a chosen option beyond the question's option count", () => {
    localStorage.setItem(quizProgressStorageKey(SET_ID), JSON.stringify({ 0: 9 }));
    expect(loadQuizProgress(SET_ID, OPTION_COUNTS)).toEqual({});
  });

  it("drops non-integer and malformed entries", () => {
    localStorage.setItem(
      quizProgressStorageKey(SET_ID),
      JSON.stringify({ "hello": 1, 1: "two", 2: 3 })
    );
    expect(loadQuizProgress(SET_ID, OPTION_COUNTS)).toEqual({});
  });

  it("returns null for corrupt JSON instead of throwing", () => {
    localStorage.setItem(quizProgressStorageKey(SET_ID), "{not json");
    expect(loadQuizProgress(SET_ID, OPTION_COUNTS)).toBeNull();
  });

  it("prunes only progress keys whose set is gone", () => {
    saveQuizProgress("set-live", { 0: 1 });
    saveQuizProgress("set-gone", { 0: 3 });
    pruneOrphanQuizProgress(new Set(["set-live"]));
    expect(loadQuizProgress("set-live", OPTION_COUNTS)).toEqual({ 0: 1 });
    expect(loadQuizProgress("set-gone", OPTION_COUNTS)).toBeNull();
  });

  it("leaves non-progress storage untouched when pruning", () => {
    localStorage.setItem("capstone-study-sets", "[]");
    saveQuizProgress("set-live", { 0: 1 });
    pruneOrphanQuizProgress(new Set(["set-live"]));
    expect(localStorage.getItem("capstone-study-sets")).toBe("[]");
  });
});