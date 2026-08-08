/**
 * ============================================================================
 * UTILS TESTS — lib/utils.ts
 * ============================================================================
 * Covers the four shared helpers: cn(), formatTime(), generateId(),
 * debounce(). These sit under every component, so regressions here would
 * break the whole UI — highest-value tests in the suite.
 * ============================================================================
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { cn, formatTime, generateId, debounce } from "@/lib/utils";

describe("cn()", () => {
  it("joins plain class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("drops falsy values", () => {
    expect(cn("foo", false, undefined, null, "bar")).toBe("foo bar");
  });

  it("applies conditional classes", () => {
    const active = true;
    expect(cn("base", active && "on", !active && "off")).toBe("base on");
  });

  it("resolves Tailwind conflicts (last one wins)", () => {
    // tailwind-merge should keep p-4 over p-2
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });
});

describe("formatTime()", () => {
  it("returns an h:mm AM/PM string", () => {
    const date = new Date(2026, 0, 1, 14, 30); // 2:30 PM local
    expect(formatTime(date)).toMatch(/^\d{1,2}:\d{2}\s?(AM|PM)$/i);
  });

  it("formats afternoon hours as PM", () => {
    expect(formatTime(new Date(2026, 0, 1, 14, 30))).toMatch(/PM$/i);
  });

  it("formats morning hours as AM", () => {
    expect(formatTime(new Date(2026, 0, 1, 9, 5))).toMatch(/AM$/i);
  });
});

describe("generateId()", () => {
  it("returns a non-empty string", () => {
    expect(typeof generateId()).toBe("string");
    expect(generateId().length).toBeGreaterThan(5);
  });

  it("generates unique ids across calls", () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateId()));
    expect(ids.size).toBe(500);
  });
});

describe("debounce()", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("delays the call until the wait time passes", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("collapses rapid calls into one", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced();
    debounced();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("passes the latest arguments through", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    debounced("last");
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith("last");
  });
});
