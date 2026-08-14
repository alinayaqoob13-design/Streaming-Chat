/**
 * ============================================================================
 * USE-AUTO-SCROLL HOOK
 * ============================================================================
 * 
 * The auto-scroll behavior is the #1 source of robustness failures in
 * streaming chat UIs. This hook implements the gold standard:
 * 
 * 1. PINNED mode: User is at the bottom → auto-scroll follows new content
 * 2. FREE mode: User has scrolled up → auto-scroll is disabled
 * 3. THRESHOLD: Small tolerance (30px) so minor scroll drift doesn't break pin
 * 4. JUMP BUTTON: Appears when in FREE mode and new content arrives
 * 5. STREAMING-AWARE: Scrolls during token arrival, not just after
 * 
 * Mentor tip: Test this while tokens are actively streaming, not after.
 * ============================================================================
 */

"use client";

import { useRef, useState, useCallback, useEffect, type RefObject } from "react";
import { debounce } from "@/lib/utils";

interface UseAutoScrollOptions {
  /** The scrollable container element */
  containerRef: RefObject<HTMLElement | null>;
  /** Whether the assistant is currently generating a response */
  isStreaming: boolean;
  /** How close to bottom (in px) to consider "pinned" */
  threshold?: number;
}

interface UseAutoScrollReturn {
  /** Current scroll behavior state */
  scrollBehavior: "pinned" | "free";
  /** Whether to show the "jump to bottom" button */
  showJumpButton: boolean;
  /** Programmatically scroll to bottom and re-pin */
  scrollToBottom: () => void;
  /** Number of new messages since user scrolled up */
  newMessageCount: number;
  /** Reset the new message counter */
  resetNewMessageCount: () => void;
}

export function useAutoScroll({
  containerRef,
  isStreaming,
  threshold = 30,
}: UseAutoScrollOptions): UseAutoScrollReturn {
  const [scrollBehavior, setScrollBehavior] = useState<"pinned" | "free">("pinned");
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);

  // isStreaming is a boolean that stays true for the WHOLE stream, so an
  // effect keyed on it can never track per-token growth. The streaming flag
  // is mirrored into a ref so the MutationObserver below always sees the
  // current value without re-subscribing per render.
  const isStreamingRef = useRef(isStreaming);
  isStreamingRef.current = isStreaming;

  // Track if we should auto-scroll on the next content update
  const shouldAutoScrollRef = useRef(true);
  // Track previous scroll position to detect intentional scrolls
  const lastScrollTopRef = useRef(0);
  // Track if new content arrived while in free mode
  const pendingContentRef = useRef(false);

  /**
   * Check if the user is "at the bottom" of the container.
   * Uses a threshold so minor drift doesn't break the pin.
   */
  const isAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= threshold;
  }, [containerRef, threshold]);

  /**
   * Scroll the container to the absolute bottom.
   */
  const scrollToBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });

    setScrollBehavior("pinned");
    shouldAutoScrollRef.current = true;
    setShowJumpButton(false);
    setNewMessageCount(0);
    pendingContentRef.current = false;
  }, [containerRef]);

  /**
   * Handle scroll events on the container.
   * Debounced to avoid excessive re-renders during smooth scroll.
   */
  const handleScroll = useCallback(
    debounce(() => {
      const container = containerRef.current;
      if (!container) return;

      const currentScrollTop = container.scrollTop;
      const atBottom = isAtBottom();

      // If user scrolled UP (scrollTop decreased relative to last check)
      // or is no longer at bottom, release the pin
      if (!atBottom) {
        if (scrollBehavior !== "free") {
          setScrollBehavior("free");
          shouldAutoScrollRef.current = false;
        }
      } else {
        // User scrolled back to bottom — re-pin
        if (scrollBehavior !== "pinned") {
          setScrollBehavior("pinned");
          shouldAutoScrollRef.current = true;
          setShowJumpButton(false);
          setNewMessageCount(0);
          pendingContentRef.current = false;
        }
      }

      lastScrollTopRef.current = currentScrollTop;
    }, 50),
    [containerRef, isAtBottom, scrollBehavior]
  );

  // Attach scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef, handleScroll]);

  /**
   * Effect: Auto-scroll when the streaming STARTS (status flips to
   * submitted/streaming) or when the user explicitly scrolls to bottom.
   * Token-by-token follow-up is handled by the MutationObserver below —
   * that effect only fires on state changes, not per token.
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (shouldAutoScrollRef.current && isStreaming) {
      // Use requestAnimationFrame for smooth, non-janky scrolling during stream
      requestAnimationFrame(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "auto", // "auto" is smoother for rapid successive updates
        });
      });
    } else if (!shouldAutoScrollRef.current && isStreaming) {
      // New content arrived while user is scrolled up
      if (!pendingContentRef.current) {
        pendingContentRef.current = true;
        setShowJumpButton(true);
        setNewMessageCount((prev) => prev + 1);
      }
    }
  }, [containerRef, isStreaming]); // Re-run when streaming state changes

  /**
   * Effect: follow every content mutation inside the container while
   * streaming. Streaming appends/rewrites text nodes token-by-token, so a
   * childList + characterData observer fires on every token — this restores
   * the "follows the stream" behavior that a [isStreaming]-keyed effect
   * alone can never provide (isStreaming is constant for the whole stream).
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onContentChange = () => {
      if (!isStreamingRef.current) return;
      if (shouldAutoScrollRef.current) {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "auto",
        });
      } else if (!pendingContentRef.current) {
        // New content arrived while user is scrolled up
        pendingContentRef.current = true;
        setShowJumpButton(true);
        setNewMessageCount((prev) => prev + 1);
      }
    };

    const observer = new MutationObserver(onContentChange);
    observer.observe(container, { childList: true, characterData: true, subtree: true });
    return () => observer.disconnect();
  }, [containerRef]);

  const resetNewMessageCount = useCallback(() => {
    setNewMessageCount(0);
  }, []);

  return {
    scrollBehavior,
    showJumpButton,
    scrollToBottom,
    newMessageCount,
    resetNewMessageCount,
  };
}
