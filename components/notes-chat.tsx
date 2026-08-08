/**
 * ============================================================================
 * NOTES FOLLOW-UP CHAT
 * ============================================================================
 *
 * A compact streaming chat pinned to the generated study set: the student
 * asks follow-up questions about THEIR notes, answers stream token-by-token
 * from /api/notes/chat.
 *
 * Reuses the chat feature's building blocks (ChatMessage, ChatInput,
 * ThinkingIndicator) so stop/regenerate, streaming-safe markdown, and the
 * 5-state button behave identically to the main chat.
 *
 * Deliberate simplification vs. ChatContainer:
 * - The panel is short, so auto-scroll is a simple "stick to bottom on new
 *   content" instead of the full pinned/free machinery with jump button
 * - No localStorage here — persistence of whole study sets (including this
 *   conversation) lands with Day 5 and lives in NotesBuddy
 *
 * The component remounts (via key) when a new study set is generated, so a
 * conversation never bleeds into a different set of notes.
 * ============================================================================
 */

"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { useChat } from "ai/react";
import { AnimatePresence } from "framer-motion";
import { MessageSquareText } from "lucide-react";
import { ChatMessage } from "@/components/chat-message";
import { ChatInput } from "@/components/chat-input";
import { ThinkingIndicator } from "@/components/thinking-indicator";
import { generateId } from "@/lib/utils";

interface NotesChatProps {
  /** The student's source notes — sent with every request, embedded
      server-side into the system prompt */
  notes: string;
}

export function NotesChat({ notes }: NotesChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lastMessageStopped, setLastMessageStopped] = useState(false);

  const { messages, append, status, stop, reload, error } = useChat({
    api: "/api/notes/chat",
    // Merged into every request body; the route validates it again
    body: { notes },
    onFinish: () => setLastMessageStopped(false),
  });

  // Stick to the newest token — the panel is short enough that the full
  // pinned/free auto-scroll machinery would be overkill here
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const handleSend = useCallback(
    (content: string) => {
      setLastMessageStopped(false);
      append({ role: "user", content });
    },
    [append]
  );

  const handleStop = useCallback(() => {
    stop();
    setLastMessageStopped(true);
  }, [stop]);

  const handleRegenerate = useCallback(() => {
    setLastMessageStopped(false);
    reload();
  }, [reload]);

  const showThinking =
    status === "submitted" &&
    messages.length > 0 &&
    messages[messages.length - 1].role === "user";

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const isLastMessageStopped = lastMessageStopped && lastAssistantMessage !== undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          // Empty state — direction, not mood: suggest real questions
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <MessageSquareText size={24} className="text-accent" />
            <p className="max-w-sm text-sm text-text-secondary">
              Ask anything about these notes — answers come only from what you pasted.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "Which points are most exam-worthy?",
                "Explain the hardest concept simply",
                "Make a 3-line revision of these notes",
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="rounded-lg border border-border-subtle bg-surface-elevated px-3 py-2 text-xs text-text-secondary transition-colors duration-200 hover:border-accent/30 hover:text-text-primary"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col pb-2">
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
            <AnimatePresence mode="wait">
              {showThinking && <ThinkingIndicator key="thinking" />}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Stream error — friendly copy + the input stays usable */}
      {error && (
        <p role="alert" className="border-t border-danger/40 bg-danger/10 px-4 py-2 text-xs text-danger">
          Something went wrong. Please try again in a moment.
        </p>
      )}

      {/* Input — same 5-state button as the main chat */}
      <ChatInput
        onSubmit={handleSend}
        onStop={handleStop}
        onRegenerate={handleRegenerate}
        status={status}
        lastMessageStopped={isLastMessageStopped}
        placeholder="Ask a question about your notes..."
      />
    </div>
  );
}
