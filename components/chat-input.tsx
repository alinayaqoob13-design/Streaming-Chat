/**
 * ============================================================================
 * CHAT INPUT COMPONENT
 * ============================================================================
 * 
 * The input bar with the send/stop/regenerate button.
 * 
 * BUTTON STATE MACHINE (5 states — from "Buttons with a Brain" assignment):
 * 1. IDLE:      Input empty → button disabled, subtle appearance
 * 2. READY:     Input has text → button enabled, accent color, send icon
 * 3. SENDING:   Message submitted, waiting for first token → spinner
 * 4. STREAMING: Tokens arriving → stop button (danger color, square icon)
 * 5. STOPPED:   User hit stop → regenerate button appears
 * 
 * After stopping:
 * - Partial message persists
 * - Input re-enables immediately
 * - Next send works without refresh
 * 
 * Mobile: Full-width input, comfortable tap targets (min 44px).
 * ============================================================================
 */

"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Square, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  /** Callback when user submits a message */
  onSubmit: (message: string) => void;
  /** Callback when user hits the stop button */
  onStop: () => void;
  /** Callback when user hits regenerate */
  onRegenerate?: () => void;
  /** Current state of the stream */
  status: "idle" | "submitted" | "streaming" | "error" | "ready";
  /** Whether the last message was stopped */
  lastMessageStopped?: boolean;
}

type ButtonState = "idle" | "ready" | "sending" | "streaming" | "stopped";

export function ChatInput({
  onSubmit,
  onStop,
  onRegenerate,
  status,
  lastMessageStopped = false,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [buttonState, setButtonState] = useState<ButtonState>("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync button state with stream status
  useEffect(() => {
    if (status === "streaming") {
      setButtonState("streaming");
    } else if (status === "submitted") {
      setButtonState("sending");
    } else if (status === "error") {
      setButtonState("ready");
    } else if (lastMessageStopped && input.trim() === "") {
      setButtonState("stopped");
    } else if (input.trim().length > 0) {
      setButtonState("ready");
    } else {
      setButtonState("idle");
    }
  }, [status, input, lastMessageStopped]);

  /**
   * Auto-resize textarea as user types.
   */
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 200); // Max 200px
    textarea.style.height = `${newHeight}px`;
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;

    onSubmit(trimmed);
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, onSubmit]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter for newline, Enter to send
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (buttonState === "ready" || buttonState === "stopped") {
        handleSubmit();
      }
    }
  };

  const handleButtonClick = () => {
    if (buttonState === "streaming") {
      onStop();
    } else if (buttonState === "stopped" && onRegenerate) {
      onRegenerate();
    } else if (buttonState === "ready") {
      handleSubmit();
    }
  };

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Re-focus after stream ends
  useEffect(() => {
    if (status === "idle" || status === "ready") {
      textareaRef.current?.focus();
    }
  }, [status]);

  const isInputDisabled = status === "streaming" || status === "submitted";

  return (
    <div className="relative flex w-full items-end gap-2 border-t border-border bg-surface p-3 sm:p-4">
      {/* Textarea */}
      <div className="relative flex-1">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isInputDisabled}
          placeholder={
            isInputDisabled 
              ? "Assistant is responding..." 
              : "Ask anything about frontend engineering..."
          }
          rows={1}
          className={cn(
            "w-full resize-none rounded-xl border bg-surface-elevated px-4 py-3 text-[15px] text-text-primary",
            "placeholder:text-text-muted",
            "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-all duration-200",
            "min-h-[48px] max-h-[200px]"
          )}
        />
        {/* Character count (subtle) */}
        <span className={cn(
          "absolute bottom-2 right-3 text-[10px] transition-opacity",
          input.length > 0 ? "opacity-100 text-text-muted" : "opacity-0"
        )}>
          {input.length}
        </span>
      </div>

      {/* Action Button with 5-state treatment */}
      <motion.button
        onClick={handleButtonClick}
        disabled={buttonState === "idle" || buttonState === "sending"}
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface",
          "disabled:cursor-not-allowed",
          // State-based styling
          buttonState === "idle" && "bg-surface-elevated text-text-muted",
          buttonState === "ready" && "bg-accent text-on-accent hover:bg-accent-hover focus:ring-accent",
          buttonState === "sending" && "bg-surface-elevated text-accent animate-pulse",
          buttonState === "streaming" && "bg-danger/10 text-danger hover:bg-danger/20 focus:ring-danger",
          buttonState === "stopped" && "bg-accent/10 text-accent hover:bg-accent/20 focus:ring-accent",
        )}
        whileTap={{ scale: 0.92 }}
        whileHover={buttonState !== "idle" && buttonState !== "sending" ? { scale: 1.05 } : {}}
        aria-label={
          buttonState === "streaming" ? "Stop generation" :
          buttonState === "stopped" ? "Regenerate response" :
          buttonState === "sending" ? "Sending..." :
          "Send message"
        }
      >
        <AnimatePresence mode="wait">
          {buttonState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, rotate: -45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 45 }}
              transition={{ duration: 0.15 }}
            >
              <Send size={18} />
            </motion.div>
          )}

          {buttonState === "ready" && (
            <motion.div
              key="ready"
              initial={{ opacity: 0, rotate: -45 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 45 }}
              transition={{ duration: 0.15 }}
            >
              <Send size={18} />
            </motion.div>
          )}

          {buttonState === "sending" && (
            <motion.div
              key="sending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Loader2 size={18} className="animate-spin" />
            </motion.div>
          )}

          {buttonState === "streaming" && (
            <motion.div
              key="streaming"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.15 }}
            >
              <Square size={16} fill="currentColor" />
            </motion.div>
          )}

          {buttonState === "stopped" && (
            <motion.div
              key="stopped"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              <RotateCcw size={18} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
