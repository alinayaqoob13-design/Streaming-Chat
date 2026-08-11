# AGENTS.md — Streaming Chat Capstone

Guidance for AI coding agents working in this repository. Assumes no prior knowledge of the project.

## Project Overview

The home page is the **AI Study Notes Buddy** (2026 Frontend Engineering capstone): paste lecture notes — or import a .txt/.md file — and Google Gemini returns a summary, flashcards, and a quiz as schema-validated JSON. The artifacts are tabbed (Summary | Flashcards | Quiz), with flashcard practice + spaced-repetition study modes, an interactive quiz, weak-areas tracking, follow-up chat grounded only in the notes, localStorage persistence (key `capstone-study-sets`), .json backup/import, an installable PWA service worker, view transitions, and a daily study streak. Mobile-first, dark-only "dusty rose on black" design, Framer Motion animations that respect `prefers-reduced-motion`.

The repo also keeps the **legacy streaming chat** building blocks (`ChatContainer`, `/api/chat`, `useAutoScroll`) — still functional, no longer the entry point.

There is **no database and no auth** — conversation/study-set history lives only in the browser's `localStorage`.

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
npm test                 # Vitest + React Testing Library suite
npm run build            # production build (also worth a smoke test)
```

## Testing Strategy

The test suite lives in `tests/` and runs on Vitest + React Testing Library (jsdom). It covers the notes API route (mocked AI SDK, zero tokens), all interactive components (options chips, quiz scoring, practice mode, tabs, history, follow-up chat, streak logic), and every lib helper. It does NOT cover the legacy streaming chat or the new PWA pieces (viewport/install require real browser tooling).

New behavior is expected to ship with a test in `tests/` following the existing patterns (`vi.mock` the AI SDK / `useChat`; assert on rendered role/name queries). `npm test` must stay green before finishing a change.

Manual verification (dev server) still matters for streaming/scroll feel:

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
  api/notes/explain/route.ts # "Explain differently": POST { notes, card } -> simpler rewrite
  manifest.ts            # PWA web app manifest (standalone display, theme, icons)
  study-set/[id]/page.tsx# Deep-link route: loads a saved set from localStorage by id; 404 if missing
  share/page.tsx         # Import a study set shared via a /share?s=<base64> link
  page.tsx               # Main page, renders NotesBuddy
  layout.tsx             # Root layout + metadata + ServiceWorkerRegister
  globals.css            # Tailwind v4 import + @theme design tokens + keyframes + view-transition CSS
components/
  notes-buddy.tsx        # Study Notes Buddy orchestrator: state machine + localStorage persistence
                         # (key: capstone-study-sets, newest first, capped at 20, hydration-guarded)
                         # + undo-delete toast (8s), .json import, view transitions between screens
  notes-input.tsx        # Notes textarea (accepts pasted text OR a .txt/.md file), options chips,
                         # 3-state Generate button + empty-state guidance card
  notes-history.tsx      # Saved study sets list: live search, reopen (free, no API call), per-row
                         # .json export, restore-backup import (strict validation), delete
  notes-result.tsx       # Tabbed artifact view: Summary | Flashcards | Quiz (pinned tab bar, scrolling
                         # panel, dir=rtl for Urdu output)
  flashcards-view.tsx    # Flip-card deck: browse (arrow keys + live front/back search), practice
                         # (shuffle, 1/2 marks, missed cards re-queued once, session score), study
                         # (SRS: 1/2/3 = Again/Good/Easy, due-card chip); Space to flip
  quiz-view.tsx          # Interactive MCQ quiz: lock-on-answer, instant feedback, live score, retake,
                         # keys 1-9 answer next open question, Space jumps to it
  notes-chat.tsx         # Follow-up chat panel for a study set (useChat + /api/notes/chat, simple
                         # stick-to-bottom)
  weak-areas-view.tsx    # Most-missed cards/questions, jumps back to the exact item
  stats-view.tsx         # Total flashcards + quiz questions across all saved sets (input-screen tile)
  streak-display.tsx     # Daily study streak chip (lib/streak.ts)
  share-button.tsx       # Copies a /share?s=<base64> link for the current study set
  service-worker-register.tsx # Registers public/sw.js (production only, silent failures)
  chat-container.tsx     # Legacy chat orchestrator (useChat + useAutoScroll, localStorage persistence)
  chat-message.tsx       # Legacy single message, streaming-safe markdown heuristic
  chat-input.tsx         # Legacy input bar with 5-state button state machine
  thinking-indicator.tsx # Animated pre-token "thinking" state
  scroll-anchor.tsx      # Floating "jump to latest" button with count badge
hooks/
  use-auto-scroll.ts     # Pinned/free auto-scroll logic (threshold 30px, jump-button counting)
lib/
  config.ts              # SINGLE SOURCE OF TRUTH: SYSTEM_PROMPT, buildNotesSystemPrompt(options),
                         # NOTES_FOLLOWUP_SYSTEM_PROMPT, DEFAULT_MODEL, GENERATION_CONFIG,
                         # NOTES_GENERATION_CONFIG, NOTES_INPUT_LIMITS, ERROR_MESSAGES,
                         # EXPLAIN_SYSTEM_PROMPT
  export-notes.ts        # studySetToMarkdown + summaryToText + downloadMarkdown/downloadText/downloadJson
  share-link.ts          # encode/decode a SavedStudySet into a URL-safe base64 payload
  view-transition.ts     # withViewTransition() — View Transition API wrapper (graceful, reduced-motion aware)
  srs.ts                 # Simplified SM-2: ratings, due logic, miss counting
  weak-areas.ts          # Weak Areas aggregation (threshold 2, most-missed-first)
  streak.ts              # Daily streak: local date keys, one count/day, best-streak tracking
  utils.ts               # cn(), formatTime(), generateId(), debounce()
public/
  sw.js                  # Service worker: offline app shell (network-first) + stale-while-revalidate
                         # assets; /api/* is NEVER cached; bump CACHE on policy changes
  icons/                 # PWA icons: icon-192.png, icon-512.png, icon-512-maskable.png
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
