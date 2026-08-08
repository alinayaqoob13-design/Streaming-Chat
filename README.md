# AI Study Notes Buddy

Paste your lecture notes → get a **summary**, **flashcards**, and a **quiz** — then practice them, export them, and ask follow-up questions that are answered strictly from your own notes. Built with Next.js 15, the Vercel AI SDK, and Google Gemini for the 2026 Frontend Engineering capstone.

**Live app:** _<your Vercel URL>_

## Features

- **Structured study material** — one paste produces three artifacts: a markdown summary, 5–12 flashcards, and 3–8 multiple-choice quiz questions, generated as schema-validated JSON (not free text)
- **Generation options** — difficulty (easy / medium / hard), flashcard and quiz counts, and output language (**English / اردو**, with right-to-left rendering)
- **Flashcard practice mode** — shuffled deck, flip-then-mark (Know it / Still learning), missed cards re-queued once, session score screen. Active recall, 100% client-side
- **Interactive quiz** — lock-on-answer MCQs with instant right/wrong feedback, explanations, live score, and retake
- **Follow-up chat** — streaming Q&A grounded in the pasted notes only; the notes are embedded into the system prompt server-side so answers can't drift to outside knowledge
- **Export** — download the full set as Markdown, or print / save-as-PDF a clean light-on-white handout
- **History** — every generated set is saved to localStorage (cap 20) and reopens with zero tokens spent
- **Robust UX** — empty states, friendly API error messages with retry, loading states, `prefers-reduced-motion` respected, mobile-first responsive

## Quick Start

```bash
npm install
cp .env.example .env.local   # add your Gemini API key
npm run dev                  # http://localhost:3000
```

Get a free Gemini key at https://aistudio.google.com/apikey — no credit card required.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Gemini API key — **server-side only**, never exposed to the client |
| `GOOGLE_MODEL` | No | Override default model (default: `gemini-3.1-flash-lite`) |

## Architecture

```
app/
  api/chat/route.ts       # Legacy streaming chat route (streamText)
  api/notes/route.ts      # POST: notes -> summary+flashcards+quiz via generateObject + zod
  api/notes/chat/route.ts # POST: follow-up chat, notes embedded in system prompt server-side
  page.tsx                # Home — renders NotesBuddy
  globals.css             # Tailwind v4 @theme tokens (dusty-rose-on-black), print stylesheet
components/
  notes-buddy.tsx         # Orchestrator: state machine + localStorage persistence + export/print
  notes-input.tsx         # Textarea, generation-option chips, 3-state Generate button
  notes-result.tsx        # Tabbed artifact view (Summary | Flashcards | Quiz), RTL for Urdu
  flashcards-view.tsx     # Browse + practice modes (flip cards, know/don't-know scoring)
  quiz-view.tsx           # Interactive MCQ quiz with live score
  notes-chat.tsx          # Follow-up chat panel (useChat + /api/notes/chat)
  notes-history.tsx       # Saved sets: reopen / delete
  chat-*.tsx, thinking-indicator.tsx, scroll-anchor.tsx  # Legacy streaming chat building blocks
hooks/
  use-auto-scroll.ts      # Pinned/free auto-scroll (legacy chat)
lib/
  config.ts               # SINGLE SOURCE OF TRUTH: prompts, model, generation config, error copy
  export-notes.ts         # studySetToMarkdown + download helpers (client-side)
  utils.ts                # cn(), formatTime(), generateId(), debounce()
types/
  notes.ts                # StudyNotes, Flashcard, QuizQuestion, GenerationOptions, SavedStudySet
tests/                    # Vitest + React Testing Library (80 tests)
```

### Data flow

1. `NotesInput` → `NotesBuddy.handleGenerate` → `POST /api/notes` (notes + options)
2. The route validates input (type, 30–15,000 chars), whitelists/clamps options, builds the system prompt via `buildNotesSystemPrompt(options)`, and calls `generateObject` with a zod schema
3. The schema-validated artifact renders in the tabbed view and is saved to localStorage (`capstone-study-sets`)
4. Follow-up chat sends `{ notes, messages }` to `/api/notes/chat`; the server appends the notes to `NOTES_FOLLOWUP_SYSTEM_PROMPT` — the client can never inject prompt text

## The AI prompt, explained

All prompts live in `lib/config.ts` (server-only):

- **`buildNotesSystemPrompt(options)`** — instructs Gemini to produce exactly three artifacts, grounded strictly in the pasted notes ("never import outside knowledge"). Difficulty appends a level-specific instruction (easy = recall, medium = understanding, hard = application/analysis); counts are injected as exact numbers clamped to the zod schema's bounds so the prompt can never ask for what the schema would reject; Urdu adds an academic-Urdu instruction that keeps common technical terms in English.
- **`NOTES_FOLLOWUP_SYSTEM_PROMPT`** — constrains the follow-up chat to the notes: "Answer strictly from the notes… if the answer is not in the notes, say so." The notes are concatenated **on the server**.
- **Structured output over streaming** — `/api/notes` uses `generateObject` with a zod schema (summary: string, flashcards: 3–12, quiz: 2–8 with exactly 4 options and `correctIndex` 0–3). The UI never parses raw model text; invalid model output fails server-side, not in the browser.

## Testing

```bash
npm test                 # 80 tests, Vitest + React Testing Library
npm run test:coverage    # v8 coverage, thresholds enforced at 50%
```

What's covered: API route validation + prompt building + security headers (mocked AI SDK, zero tokens spent), all interactive components (options chips, quiz scoring, practice-mode flow, tabs, history, follow-up chat with mocked `useChat`), and every lib helper. Note: Vitest 3 / jsdom 24 are pinned because Node 22.10 cannot `require()` the ESM-only builds shipped by Vitest 4 / jsdom 27.

## Accessibility

- Semantic tabs (`tablist`/`tab`/`tabpanel`), radio-group option chips, `aria-live` score updates
- Full keyboard support: flashcard flip (Enter/Space), deck arrows, quiz buttons, visible focus rings
- Dark-on-rose text on accent surfaces chosen for WCAG AA contrast (white-on-rose fails)
- `prefers-reduced-motion` collapses all animation via a global media query

## Evaluation Checklist

- Generate from pasted notes → summary + flashcards + quiz in tabs
- Options (difficulty / counts / language) change the output; Urdu renders RTL
- Invalid input (too short / too long / gibberish) handled with friendly copy
- API failure shows an error banner; retry preserves the pasted notes
- Flashcards flip; practice mode scores and re-queues missed cards once
- Quiz locks answers, shows explanations, tracks score, retakes cleanly
- Follow-up chat streams answers grounded in the notes; stop/regenerate work
- Export downloads a complete Markdown document; Print produces a clean PDF handout
- History persists across refresh; reopening a set costs no tokens; delete works
- Usable at phone width (320px+); keyboard navigable; reduced motion respected

## Limitations

- **No accounts or sync** — history lives in the browser's localStorage only; clearing site data erases it
- **Grounding is prompt-enforced, not retrieval** — very long notes are capped at 15,000 characters
- **Practice mode is not a full SRS** — missed cards repeat once per session, but there is no cross-day spaced-repetition scheduler (Anki SM-2)
- **No file upload** — notes must be pasted as plain text (PDF/OCR is future work)
- The legacy streaming chat (`/api/chat`, `ChatContainer`) is no longer the home page but remains functional

## License

MIT — built for the 2026 Frontend Engineering Capstone.
