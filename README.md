# Streaming Chat Capstone

A production-grade streaming chat interface built with Next.js, the Vercel AI SDK, and Claude. This is the central AI interaction for the 2026 Frontend Engineering capstone.

## Features

- **Token-by-token streaming** via Server-Sent Events (SSE)
- **Robust auto-scroll** that respects user scroll position
- **5-state send/stop button** with smooth transitions
- **Seamless thinking-to-token handoff** — no flicker
- **Streaming-safe markdown rendering** with syntax highlighting
- **Conversation persistence** via localStorage
- **Mobile-first responsive design**
- **Motion with intent** — choreographed animations respecting `prefers-reduced-motion`
- **Server-side API key security** — Gemini key never touches the client

## Architecture

```
app/
  api/chat/route.ts      # Server route: streamText with Google Gemini (AI SDK)
  page.tsx               # Main page with ChatContainer
  layout.tsx             # Root layout
  globals.css            # Tailwind v4 + custom styles
components/
  chat-container.tsx     # Orchestrator: useChat + useAutoScroll
  chat-message.tsx       # Individual message with markdown
  chat-input.tsx         # Input bar with 5-state button
  thinking-indicator.tsx # Animated thinking state
  scroll-anchor.tsx      # "Jump to latest" floating button
hooks/
  use-auto-scroll.ts     # Gold-standard auto-scroll logic
lib/
  config.ts              # System prompt + model config (single source of truth)
  utils.ts               # cn(), formatTime(), generateId()
types/
  chat.ts                # Shared TypeScript interfaces
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Google Gemini API key (free, no credit card — get one at https://aistudio.google.com/apikey):

```
GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure Details

### Server: `app/api/chat/route.ts`

The API route uses `streamText` from the AI SDK with the Google Gemini provider:

- Validates incoming message arrays
- Checks for `GOOGLE_GENERATIVE_AI_API_KEY` server-side
- Returns a data stream response compatible with `useChat`
- Logs finish reasons and usage for monitoring

### Client: `components/chat-container.tsx`

Uses `useChat` from `"ai/react"` to manage:

- Message state (user + assistant)
- Streaming status (`idle` | `submitted` | `streaming` | `error`)
- AbortController for the stop button
- localStorage persistence across refreshes

### Auto-Scroll: `hooks/use-auto-scroll.ts`

The most critical piece for robustness:

1. **PINNED mode**: User is within 30px of bottom → auto-scroll follows new tokens
2. **FREE mode**: User scrolls up → auto-scroll releases
3. **Jump button**: Appears when new content arrives while scrolled up, with message count badge
4. **Streaming-aware**: Scrolls during token arrival using `requestAnimationFrame`

### Button States: `components/chat-input.tsx`

| State | Visual | Action |
|-------|--------|--------|
| Idle | Grayed out, send icon | Disabled |
| Ready | Accent color, send icon | Sends message |
| Sending | Pulsing spinner | Disabled (waiting for first token) |
| Streaming | Red square (stop) | Aborts stream |
| Stopped | Accent rotate icon | Regenerates last response |

### Markdown Safety

`chat-message.tsx` uses `react-markdown` with a streaming heuristic:
- Short content during streaming → plain text with cursor
- Complete/long content → full markdown with custom components
- Prevents broken code fences and dangling asterisks mid-stream

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Your Google Gemini API key (free from AI Studio) |
| `GOOGLE_MODEL` | No | Override default model (default: `gemini-3.1-flash-lite`) |

## Evaluation Checklist

- [x] Responses visibly stream token by token
- [x] Generation can be stopped mid-stream without breaking state
- [x] Conversation state survives multiple turns
- [x] API key lives server-side only
- [x] Usable at phone width (320px+)
- [x] Auto-scroll pins to bottom only when user is at bottom
- [x] Auto-scroll releases when user scrolls up
- [x] "Jump to latest" button appears with new message count
- [x] Thinking indicator fades seamlessly into first token
- [x] Markdown renders safely during streaming
- [x] Conversation persists to localStorage
- [x] Motion respects `prefers-reduced-motion`
- [x] 5-state button treatment (idle/ready/sending/streaming/stopped)

## Stretch Goals Implemented

1. **Motion pass**: All message entrances, indicator-to-token handoffs, and button state transitions use Framer Motion with purposeful durations and easing curves.
2. **Persistence**: Conversation history is saved to `localStorage` and restored on page refresh.
3. **Regenerate**: After stopping, a regenerate button appears to retry the last assistant message.

## Links

- [AI SDK useChat documentation](https://sdk.vercel.ai/docs/ai-sdk-ui/chatbot)
- [AI SDK introduction](https://sdk.vercel.ai/docs/introduction)
- [Gemini API documentation](https://ai.google.dev/gemini-api/docs)
- [Vercel AI Chatbot Template](https://github.com/vercel/ai-chatbot)

## License

MIT — Built for the 2026 Frontend Engineering Capstone.
