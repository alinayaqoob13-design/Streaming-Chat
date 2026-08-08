# AGENTS.md — Streaming Chat Capstone

Guidance for AI coding agents working in this repository. Assumes no prior knowledge of the project.

## Project Overview

A production-grade **streaming chat interface** built as the central AI interaction for a 2026 Frontend Engineering capstone. It is a single-page chat app: the user talks to an LLM (Google Gemini) and responses stream token-by-token over SSE. Key features: robust auto-scroll, a 5-state send/stop/regenerate button, streaming-safe markdown, thinking-indicator-to-token handoff, localStorage persistence, mobile-first responsive design, and Framer Motion animations that respect `prefers-reduced-motion`.

There is **no database, no auth, and no server-side persistence** — conversation history lives only in the browser's `localStorage` (key: `capstone-chat-history`).

## Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript (strict mode)
- **AI**: Vercel AI SDK v4 (`ai`, `@ai-sdk/google`) — `streamText` on the server, `useChat` from `ai/react` on the client
- **Model**: Google Gemini, default `gemini-3.1-flash-lite` (override via `GOOGLE_MODEL` env var)
- **Styling**: Tailwind CSS v4 via `@tailwindcss/postcss`; design tokens are defined as CSS custom properties in the `@theme` block in `app/globals.css` (dark-only theme: `bg-background`, `bg-surface`, `text-text-primary`, `bg-accent`, `text-danger`, etc.)
- **Animation**: `framer-motion` (v12)
- **Markdown**: `react-markdown` + `remark-gfm`
- **Icons**: `lucide-react`
- **Utilities**: `clsx` + `tailwind-merge` (combined as `cn()` in `lib/utils.ts`)

Note: `@ai-sdk/anthropic` and `@anthropic-ai/sdk` are installed as dependencies but are **not used anywhere in the code**. Some UI copy (page header subtitle, layout metadata, README title line) still says "Claude" — the actual provider is Gemini. Don't be misled by this.

## Build and Run Commands

```bash
npm install                          # install dependencies
cp .env.example .env.local           # then add your Gemini API key
npm run dev                          # dev server on http://localhost:3000
npm run build                        # production build
npm run start                        # serve production build
```

Environment variables (see `.env.example`):

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Gemini API key (free from https://aistudio.google.com/apikey) — server-side only |
| `GOOGLE_MODEL` | No | Override the default model |

**Health check**: `GET /api/chat` returns `{ status, model, timestamp }` — useful for smoke-testing without consuming tokens.

**Lint caveat**: `package.json` has a `lint: next lint` script, but there is no ESLint config in the repo and Next.js 15 removed the `next lint` command. For verification, use TypeScript instead:

```bash
npx tsc --noEmit
```

## Testing Strategy

There is **no test suite** — no test runner, no test files, no CI configuration. Verification is manual:

1. `npm run dev`, open http://localhost:3000
2. Send a message and confirm tokens stream visibly
3. Hit stop mid-stream — partial message must persist, input must re-enable, regenerate button appears
4. Scroll up during streaming — auto-scroll releases and the "jump to latest" button appears with a count badge
5. Refresh the page — conversation restores from localStorage
6. Resize to ~320px width — layout must remain usable

`README.md` contains the full manual evaluation checklist. If you add behavior, update that checklist.

## Code Organization

```
app/
  api/chat/route.ts      # Server route: POST streams via streamText + Gemini; GET is a health check
  api/notes/route.ts     # Study Notes Buddy: POST validates pasted notes, returns summary+flashcards+quiz
                         # via generateObject + zod schema (NOT streamed); GET is a health check
  api/notes/chat/route.ts# Follow-up chat about a study set: POST { notes, messages }, streams via
                         # streamText; notes are embedded in the system prompt server-side
  page.tsx               # Main page, renders ChatContainer
  layout.tsx             # Root layout + metadata
  globals.css            # Tailwind v4 import + @theme design tokens + keyframes
components/
  chat-container.tsx     # Orchestrator: useChat + useAutoScroll + localStorage persistence + stop/regenerate
  chat-message.tsx       # Single message, streaming-safe markdown heuristic
  chat-input.tsx         # Input bar with 5-state button state machine
  notes-buddy.tsx        # Study Notes Buddy orchestrator: input -> generating -> result/error state machine
  notes-input.tsx        # Notes textarea + 3-state Generate button + empty-state guidance card
  notes-result.tsx       # Tabbed artifact view: Summary | Flashcards | Quiz (pinned tab bar, scrolling panel)
  flashcards-view.tsx    # 3D flip-card deck (index-card style, arrow-key navigation)
  quiz-view.tsx          # Interactive MCQ quiz: lock-on-answer, instant feedback, live score, retake
  notes-chat.tsx         # Follow-up chat panel for a study set (useChat + /api/notes/chat, simple stick-to-bottom)
  thinking-indicator.tsx # Animated pre-token "thinking" state
  scroll-anchor.tsx      # Floating "jump to latest" button with count badge
hooks/
  use-auto-scroll.ts     # Pinned/free auto-scroll logic (threshold 30px, jump-button counting)
lib/
  config.ts              # SINGLE SOURCE OF TRUTH: SYSTEM_PROMPT, NOTES_SYSTEM_PROMPT, NOTES_FOLLOWUP_SYSTEM_PROMPT,
                         # DEFAULT_MODEL, GENERATION_CONFIG, NOTES_GENERATION_CONFIG, NOTES_INPUT_LIMITS, ERROR_MESSAGES
  utils.ts               # cn(), formatTime(), generateId(), debounce()
types/
  chat.ts                # Shared interfaces (ChatMessage, ConversationState, ScrollBehavior)
  notes.ts               # Study Notes Buddy types (StudyNotes, Flashcard, QuizQuestion, SavedStudySet)
```

### Data flow

1. `ChatInput` submit → `ChatContainer.handleSend` → `useChat.append()` → POST `/api/chat`
2. `route.ts` validates the message array, checks the API key, calls `streamText` with `SYSTEM_PROMPT` and `GENERATION_CONFIG` from `lib/config.ts`, returns `toDataStreamResponse()`
3. `useChat` appends tokens to the last assistant message; `status` moves `submitted` → `streaming` → `ready`
4. `useAutoScroll` follows the stream only while the user is within 30px of the bottom; otherwise it shows the jump button
5. Every message-array change is persisted to `localStorage` (restored on mount, with a `hasMounted` guard against hydration mismatch)
6. `stop()` aborts the fetch; the partial message stays in state; `reload()` regenerates

## Conventions

- **Path alias**: `@/*` maps to the repo root (`tsconfig.json`). Always import as `@/lib/...`, `@/components/...`, etc.
- **Client components**: everything under `components/` and `hooks/` starts with `"use client"`. `lib/config.ts` is **server-only** (it reads `process.env`) — never import it from client code.
- **File header banners**: source files open with a boxed `/** ===...=== **/` comment block describing purpose and invariants (see any existing file for the exact style). Match this when creating new files.
- **className composition**: always use `cn()` from `lib/utils.ts` for conditional/dynamic classes — never raw template strings.
- **Animations**: use Framer Motion (`motion`, `AnimatePresence`), short purposeful durations (~0.15–0.5s), and respect `prefers-reduced-motion`. Custom easing curves are inline cubic-beziers.
- **Comments are heavy and intentional** — section dividers (`// ---...---`) and "why" explanations are the norm. Keep comments in sync when changing behavior.
- **LLM settings**: model name, generation params, system prompt, and error copy all live in `lib/config.ts`. Change them there, not inline in the route.

## Security Considerations

- The Gemini API key is **server-side only**: it is read from `process.env` in `app/api/chat/route.ts` and `lib/config.ts`. Never expose it via `NEXT_PUBLIC_` vars, and never import `lib/config.ts` into client components.
- `.env`, `.env.local`, `.env.*.local`, and `*.pem` are gitignored — keep it that way.
- The API route validates the `messages` array shape (role whitelist, string content) before anything reaches the LLM; preserve this defense-in-depth when editing `route.ts`.
- Streaming responses send `Cache-Control: no-cache, no-transform` and `X-Content-Type-Options: nosniff`.
- No authentication exists — the route is open. Anything you add should not weaken input validation or leak the key.

## Deployment

No CI/CD or deployment config is present in the repo. It is a standard Next.js app: `npm run build` + `npm run start`, or deploy to Vercel with `GOOGLE_GENERATIVE_AI_API_KEY` set as an environment variable.

## Known Quirks

- `next.config.js` is intentionally empty (a `dynamicIO` flag was removed; the remaining comment is in Hindi — English dominates elsewhere, so write new comments/docs in English).
- README/UI copy mentions "Claude" in places, but the wired provider is Gemini — copy lag, not a second provider.
- `tailwind.config.ts` exists and defines a few keyframes, but Tailwind v4 primarily reads the `@theme` block in `app/globals.css`; the config file's `content` globs cover only `app/` and `components/`.
