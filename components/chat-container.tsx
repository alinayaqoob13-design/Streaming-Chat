/**
 * ============================================================================
 * CHAT CONTAINER — MAIN COMPONENT
 * ============================================================================
 * 
 * The central orchestrator of the streaming chat experience.
 * 
 * Architecture:
 * - Uses AI SDK's useChat for streaming state management
 * - Integrates useAutoScroll for robust scroll behavior
 * - Persists conversation to localStorage (stretch goal)
 * - Handles stop/regenerate with proper state preservation
 * 
 * State flow:
 * 1. User types → input state
 * 2. User sends → useChat.append() → status becomes "submitted"
 * 3. First token arrives → status becomes "streaming", thinking indicator hands off
 * 4. Tokens stream → auto-scroll follows if pinned
 * 5. User scrolls up → auto-scroll releases, jump button appears
 * 6. User hits stop → abort(), partial message persists, input re-enables
 * 7. User sends again → new message appends, stream resumes
 * ============================================================================
 */

"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useChat } from "ai/react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Trash2 } from "lucide-react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { ThinkingIndicator } from "./thinking-indicator";
import { ScrollAnchor } from "./scroll-anchor";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import { cn, generateId } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

// ---------------------------------------------------------------------------
// LOCAL STORAGE PERSISTENCE (Stretch Goal)
// ---------------------------------------------------------------------------
const STORAGE_KEY = "capstone-chat-history";

function loadMessagesFromStorage(): ChatMessageType[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return parsed.map((m: ChatMessageType) => ({
      ...m,
      createdAt: new Date(m.createdAt),
    }));
  } catch {
    return [];
  }
}

function saveMessagesToStorage(messages: ChatMessageType[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function ChatContainer() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [lastMessageStopped, setLastMessageStopped] = useState(false);
  const [storedMessages, setStoredMessages] = useState<ChatMessageType[]>([]);
  const [hasMounted, setHasMounted] = useState(false);

  // Load persisted messages on mount
  useEffect(() => {
    const loaded = loadMessagesFromStorage();
    setStoredMessages(loaded);
    setHasMounted(true);
  }, []);

  // -----------------------------------------------------------------------
  // AI SDK useChat hook
  // -----------------------------------------------------------------------
  // This hook handles:
  // - SSE connection management
  // - Message state (user + assistant)
  // - Streaming status tracking
  // - AbortController for stop functionality
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    append,
    status,
    stop,
    reload,
    setMessages,
  } = useChat({
    api: "/api/chat",
    // Initial messages from localStorage (loaded after mount)
    initialMessages: hasMounted 
      ? storedMessages.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
      : [],
    // Called when a message finishes (success or stop)
    onFinish: (message) => {
      console.log("[Chat] Message finished:", message.id);
      setLastMessageStopped(false);
    },
    // Called on error
    onError: (error) => {
      console.error("[Chat] Error:", error);
    },
  });

  // -----------------------------------------------------------------------
  // Auto-scroll integration
  // -----------------------------------------------------------------------
  const isStreaming = status === "streaming" || status === "submitted";
  const {
    scrollBehavior,
    showJumpButton,
    scrollToBottom,
    newMessageCount,
    resetNewMessageCount,
  } = useAutoScroll({
    containerRef: scrollContainerRef,
    isStreaming,
  });

  // -----------------------------------------------------------------------
  // Persist messages to localStorage whenever they change
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!hasMounted) return;
    const chatMessages: ChatMessageType[] = messages.map((m) => ({
      id: m.id || generateId(),
      role: m.role as "user" | "assistant",
      content: m.content,
      createdAt: new Date(),
    }));
    saveMessagesToStorage(chatMessages);
  }, [messages, hasMounted]);

  // -----------------------------------------------------------------------
  // Stop handler
  // -----------------------------------------------------------------------
  // CRITICAL: After stopping, the partial message must persist,
  // the input must re-enable, and the next send must work.
  const handleStop = useCallback(() => {
    stop();
    setLastMessageStopped(true);
    // The AI SDK's stop() aborts the fetch. The partial message
    // is already in the messages array — it persists automatically.
  }, [stop]);

  // -----------------------------------------------------------------------
  // Submit handler (wraps AI SDK's append)
  // -----------------------------------------------------------------------
  const handleSend = useCallback(
    (content: string) => {
      setLastMessageStopped(false);
      resetNewMessageCount();
      append({
        role: "user",
        content,
      });
    },
    [append, resetNewMessageCount]
  );

  // -----------------------------------------------------------------------
  // Regenerate handler
  // -----------------------------------------------------------------------
  const handleRegenerate = useCallback(() => {
    setLastMessageStopped(false);
    reload();
  }, [reload]);

  // -----------------------------------------------------------------------
  // Clear conversation
  // -----------------------------------------------------------------------
  const handleClear = useCallback(() => {
    setMessages([]);
    setLastMessageStopped(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [setMessages]);

  // -----------------------------------------------------------------------
  // Determine if we should show the thinking indicator
  // -----------------------------------------------------------------------
  // Show thinking when:
  // - Status is "submitted" (message sent, waiting for first token)
  // - The last message is from the user (we're waiting for assistant response)
  const showThinking = status === "submitted" && 
    messages.length > 0 && 
    messages[messages.length - 1].role === "user";

  // -----------------------------------------------------------------------
  // Determine if the last assistant message was stopped
  // -----------------------------------------------------------------------
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const isLastMessageStopped = lastMessageStopped && lastAssistantMessage !== undefined;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (!hasMounted) {
    // Prevent hydration mismatch by not rendering until mounted
    return (
      <div className="flex h-full w-full items-center justify-center rounded-2xl border border-border bg-surface">
        <div className="flex flex-col items-center gap-3 text-text-muted">
          <Loader />
          <span className="text-sm">Loading conversation...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/20">
      {/* Messages area */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex-1 overflow-y-auto overscroll-y-contain",
          "scroll-smooth"
        )}
      >
        {/* Empty state */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
              <MessageSquare size={28} className="text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Welcome to Capstone AI
              </h2>
              <p className="mt-1 max-w-sm text-sm text-text-secondary">
                Ask me anything about frontend engineering, React patterns, 
                or AI SDK integration. Responses stream in real-time.
              </p>
            </div>
            {/* Quick starters */}
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "Explain streaming UI patterns",
                "How does useChat work?",
                "Best practices for auto-scroll",
              ].map((text) => (
                <button
                  key={text}
                  onClick={() => handleSend(text)}
                  className={cn(
                    "rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2",
                    "text-sm text-text-secondary hover:border-accent/30 hover:text-text-primary",
                    "transition-colors duration-200"
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Message list */}
        <div className="flex flex-col pb-4">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={{
                  id: message.id || generateId(),
                  role: message.role as "user" | "assistant",
                  content: message.content,
                  createdAt: new Date(),
                  isStopped: 
                    message.role === "assistant" && 
                    index === messages.length - 1 && 
                    isLastMessageStopped,
                }}
                isStreaming={
                  message.role === "assistant" &&
                  index === messages.length - 1 &&
                  status === "streaming"
                }
                isLatest={index === messages.length - 1}
              />
            ))}
          </AnimatePresence>

          {/* Thinking indicator with seamless handoff */}
          <AnimatePresence mode="wait">
            {showThinking && (
              <ThinkingIndicator key="thinking" />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scroll anchor (jump to bottom) */}
      <ScrollAnchor
        visible={showJumpButton}
        newMessageCount={newMessageCount}
        onClick={() => {
          scrollToBottom();
          resetNewMessageCount();
        }}
      />

      {/* Input area */}
      <div className="relative">
        {/* Scroll behavior indicator (subtle) */}
        {scrollBehavior === "free" && isStreaming && (
          <div className="absolute -top-6 left-0 right-0 h-6 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
        )}

        <ChatInput
          onSubmit={handleSend}
          onStop={handleStop}
          onRegenerate={handleRegenerate}
          status={status}
          lastMessageStopped={isLastMessageStopped}
        />

        {/* Footer toolbar */}
        <div className="flex items-center justify-between border-t border-border-subtle bg-surface px-4 py-2">
          <span className="text-[11px] text-text-muted">
            {status === "streaming" ? "Streaming..." : 
             status === "submitted" ? "Sending..." : 
             "Ready"}
          </span>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1",
                  "text-[11px] text-text-muted hover:text-danger hover:bg-danger/10",
                  "transition-colors duration-200"
                )}
              >
                <Trash2 size={12} />
                <span>Clear</span>
              </button>
            )}
            <span className="text-[11px] text-text-muted">
              {messages.filter((m) => m.role === "user").length} messages
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple loader for initial mount
function Loader() {
  return (
    <motion.div
      className="h-8 w-8 rounded-full border-2 border-accent/20 border-t-accent"
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
    />
  );
}
