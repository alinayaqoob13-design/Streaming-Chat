/**
 * ============================================================================
 * CHAT TYPE DEFINITIONS
 * ============================================================================
 * Shared types used across client and server boundaries.
 * ============================================================================
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  // Optional: tracks if this message was stopped mid-generation
  isStopped?: boolean;
}

export interface ConversationState {
  messages: ChatMessage[];
  // Persisted to localStorage for refresh survival
  lastUpdated: number;
}

export interface StreamChunk {
  type: "text" | "error" | "finish";
  content: string;
}

export type ScrollBehavior = "pinned" | "free";
