/**
 * ============================================================================
 * CHAT MESSAGE COMPONENT
 * ============================================================================
 * 
 * Renders a single chat message with:
 * - Distinct user/assistant visual styles
 * - Streaming-aware markdown rendering
 * - Entrance animation
 * - Timestamp
 * - "Stopped" badge for interrupted messages
 * 
 * MARKDOWN HANDLING:
 * Raw streamed markdown can break visually mid-stream (unclosed fences,
 * dangling asterisks). We use react-markdown with a streaming-safe approach:
 * - For incomplete messages, we render as plain text to avoid broken markdown
 * - For complete messages, we render full markdown
 * - Code blocks are always rendered safely
 * ============================================================================
 */

"use client";

import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { User, Bot, AlertCircle } from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

interface ChatMessageProps {
  message: ChatMessageType;
  /** Is this the message currently being streamed? */
  isStreaming?: boolean;
  /** Is this the latest message? */
  isLatest?: boolean;
}

export function ChatMessage({ message, isStreaming = false, isLatest = false }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStopped = message.isStopped;

  /**
   * Determine if we should render markdown or plain text.
   * During streaming, markdown can be half-formed and visually broken.
   * We use a heuristic: if streaming and not the final chunk, render as text.
   * In practice, react-markdown handles most cases well, but for code fences
   * we add extra safety.
   */
  const renderContent = () => {
    // If streaming and content is short, likely incomplete — render as text
    // to avoid flickering markdown structures
    if (isStreaming && message.content.length < 100) {
      return (
        <span className="text-text-primary leading-relaxed">
          {message.content}
          {/* Streaming cursor */}
          <motion.span
            className="inline-block h-4 w-[2px] bg-accent ml-0.5 align-middle"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, repeatType: "reverse" }}
          />
        </span>
      );
    }

    // For complete messages or longer streaming content, use markdown
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Override default elements for consistent styling
          p: ({ children }) => (
            <p className="text-text-primary leading-relaxed">{children}</p>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            return isInline ? (
              <code 
                className="rounded bg-surface-elevated px-1.5 py-0.5 text-sm font-mono text-accent-hover" 
                {...props}
              >
                {children}
              </code>
            ) : (
              <pre className="my-2 overflow-x-auto rounded-lg border border-border bg-surface-elevated p-3">
                <code className={cn("text-sm font-mono", className)} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          ul: ({ children }) => (
            <ul className="my-2 list-disc pl-5 text-text-primary">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal pl-5 text-text-primary">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="my-1 leading-relaxed">{children}</li>
          ),
          h1: ({ children }) => (
            <h1 className="my-3 text-lg font-semibold text-text-primary">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="my-2 text-base font-semibold text-text-primary">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="my-2 text-sm font-semibold text-text-primary">{children}</h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-accent pl-3 text-text-secondary italic">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hover underline underline-offset-2"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-border" />,
        }}
      >
        {message.content}
      </ReactMarkdown>
    );
  };

  return (
    <motion.div
      className={cn(
        "group flex gap-3 px-4 py-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.35, 
        ease: [0.25, 0.46, 0.45, 0.94],
        delay: isLatest ? 0.05 : 0 
      }}
      layout
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser 
            ? "bg-accent/10 text-accent" 
            : "bg-surface-elevated text-text-secondary border border-border"
        )}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      {/* Message bubble */}
      <div className={cn(
        "flex max-w-[85%] flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}>
        <div
          className={cn(
            "relative rounded-2xl px-4 py-3",
            isUser
              ? "bg-user-bubble text-text-primary rounded-br-md"
              : "bg-assistant-bubble text-text-primary rounded-bl-md border border-border-subtle"
          )}
        >
          {/* Content */}
          <div className={cn(
            "prose-streaming text-[15px]",
            isStreaming && "min-h-[1.5em]"
          )}>
            {renderContent()}
          </div>

          {/* Stopped badge */}
          {isStopped && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-2 inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger"
            >
              <AlertCircle size={10} />
              <span>Stopped</span>
            </motion.div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[11px] text-text-muted opacity-0 transition-opacity group-hover:opacity-100">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </motion.div>
  );
}
