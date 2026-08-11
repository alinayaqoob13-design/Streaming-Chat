# AI Study Notes Buddy

Paste your lecture notes → get a **summary**, **flashcards**, and a **quiz** — then practice them, export them, and ask follow-up questions that are answered strictly from your own notes. Built with Next.js 15, the Vercel AI SDK, and Google Gemini for the 2026 Frontend Engineering capstone.

**Live app:** _<your Vercel URL>_

## Features

- **Structured study material** — one paste produces three artifacts: a markdown summary, 5–12 flashcards, and 3–8 multiple-choice quiz questions, generated as schema-validated JSON (not free text)
- **Generation options** — difficulty (easy / medium / hard), flashcard and quiz counts, and output language (**English / اردو**, with right-to-left rendering)
- **Flashcard practice mode** — shuffled deck, flip-then-mark (Know it / Still learning), missed cards re-queued once, session score screen. Active recall, 100% client-side
- **Spaced repetition (SRS) study mode** — a simplified SM-2 scheduler (the algorithm Anki is based on) tracks each card's ease factor, interval, and next-review date. Review only what's due today with Again / Good / Easy ratings; schedules persist in localStorage alongside the saved set
- **Weak areas** — cards rated "Again" and quiz questions answered wrong are counted per item (threshold: 2 misses); the Weak Areas tab lists them most-missed-first and jumps straight back to the exact card or question
- **Interactive quiz** — lock-on-answer MCQs with instant right/wrong feedback, explanations, live score, and retake
- **Follow-up chat** — streaming Q&A grounded in the pasted notes only; the notes are embedded into the system prompt server-side so answers can't drift to outside knowledge
- **Export** — download the full set as Markdown, the summary as a plain .txt, or print / save-as-PDF a clean light-on-white handout
- **History** — every generated set is saved to localStorage (cap 20) and reopens with zero tokens spent; live search filters by title or flashcard term; deletion is never final — an 8-second Undo toast brings the set back
- **Backup & sharing** — each history row can export a .json backup of the set; a "Restore backup" button re-imports it (strict validation, dedup by id); plus a one-click **shareable link** (`/share?s=<base64>`) that lets anyone import the set without a backend
- **Daily streak** — each day with a successful generation extends a consecutive-day counter (one count per local calendar day, DST-safe); the chip shows your current streak, best streak, and a nudge when today isn't logged yet
- **Study stats** — a tile on the input screen totals your flashcards and quiz questions across all saved sets
- **Keyboard shortcuts** — flashcards: Space flips, arrows navigate, 1/2/3 (or 1/2) rate recall and practice; quiz: 1–9 answer the next open question, Space jumps to it
- **File import** — Generate accepts pasted text or a .txt/.md file (contents populate the textarea first, so you can still edit before generating)
- **Explain differently** — any flashcard or quiz question can re-ask the model for a simpler, more memorable explanation (new window-cached endpoint result, shown inline)
- **View transitions** — input↔result screen switches crossfade via the View Transition API where supported; reduced-motion users get instant switches
- **Installable PWA** — web app manifest + service worker (offline app shell, stale-while-revalidate assets); add to home screen from supported browsers
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
  api/notes/explain/route.ts # POST: "explain differently" rewrite of a card
  manifest.ts             # PWA web app manifest (installable, theme, icons)
  study-set/[id]/page.tsx # Deep-link route: opens a saved set by id from localStorage; 404 if missing
  share/page.tsx          # Import a study set shared via a /share?s=<base64> link
  page.tsx                # Home — renders NotesBuddy
  globals.css             # Tailwind v4 @theme tokens (dusty-rose-on-black), print stylesheet, view transitions
  layout.tsx              # Fonts, metadata, service-worker registration
components/
  notes-buddy.tsx         # Orchestrator: state machine + localStorage persistence + undo/import + view transitions
  notes-input.tsx         # Textarea (paste OR file import), generation-option chips, 3-state Generate button
  streak-display.tsx      # Daily streak chip (Flame icon + best-streak + keep-alive nudge)
  stats-view.tsx          # Study stats tile: total flashcards + quiz questions across saved sets
  notes-result.tsx        # Tabbed artifact view (Summary | Flashcards | Quiz | Weak areas), RTL for Urdu
  flashcards-view.tsx     # Browse (searchable) + practice + SRS study modes (flip cards, Again/Good/Easy ratings)
  quiz-view.tsx           # Interactive MCQ quiz with live score + keyboard shortcuts; wrong answers count as misses
  weak-areas-view.tsx     # Weak Areas panel — most-missed items with jump-to-review links
  notes-chat.tsx          # Follow-up chat panel (useChat + /api/notes/chat)
  notes-history.tsx       # Saved sets: search, reopen, export .json, delete (undo via NotesBuddy), restore backup
  share-button.tsx        # Copies a /share?s=<base64> link for the current study set
  service-worker-register.tsx # Production-only /sw.js registration (tiny, silent failures)
  chat-*.tsx, thinking-indicator.tsx, scroll-anchor.tsx  # Legacy streaming chat building blocks
hooks/
  use-auto-scroll.ts      # Pinned/free auto-scroll (legacy chat)
lib/
  config.ts               # SINGLE SOURCE OF TRUTH: prompts, model, generation config, error copy
  export-notes.ts         # studySetToMarkdown + summaryToText + download helpers (client-side)
  share-link.ts           # encode/decode a SavedStudySet into a URL-safe base64 payload
  view-transition.ts      # withViewTransition() — graceful View Transition API wrapper
  srs.ts                  # Simplified SM-2 scheduler: ratings, due logic, miss counting
  weak-areas.ts           # Weak Areas aggregation: threshold + most-missed-first sort
  streak.ts               # Daily study streak: local date keys, one count/day, best-streak tracking
  utils.ts                # cn(), formatTime(), generateId(), debounce()
types/
  notes.ts                # StudyNotes, Flashcard (+SRS fields), QuizQuestion (+missCount), GenerationOptions, SavedStudySet
public/
  sw.js                   # Service worker: offline shell + stale-while-revalidate assets (API never cached)
  icons/                  # PWA icons (192, 512, 512-maskable)
tests/                    # Vitest + React Testing Library
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
npm test                 # 133 tests, Vitest + React Testing Library
npm run test:coverage    # v8 coverage, thresholds enforced at 50%
```

What's covered: API route validation + prompt building + security headers (mocked AI SDK, zero tokens spent), all interactive components (options chips, quiz scoring, practice-mode flow, tabs, history, follow-up chat with mocked `useChat`), and every lib helper. Note: Vitest 3 / jsdom 24 are pinned because Node 22.10 cannot `require()` the ESM-only builds shipped by Vitest 4 / jsdom 27.

## Accessibility

- Semantic tabs (`tablist`/`tab`/`tabpanel`), radio-group option chips, `aria-live` score updates
- Full keyboard support: flashcard flip (Space), deck arrows, 1/2/3 SRS ratings, 1/2 practice ratings, quiz 1–9 answer + Space jump, visible focus rings (44px min tap targets)
- Dark-on-rose text on accent surfaces chosen for WCAG AA contrast (white-on-rose fails)
- `prefers-reduced-motion` collapses all animation via a global media query (view transitions included)

## Keyboard Map

| Context | Keys |
| --- | --- |
| Flashcards — browse | `←` `→` navigate, `Space` flip, typing filters visible cards |
| Flashcards — study (SRS) | `Space` flip, then `1` Again · `2` Good · `3` Easy |
| Flashcards — practice | `Space` flip, then `1` Still learning · `2` Know it |
| Quiz | `1`–`9` answer the next open question, `Space` jump to it (skips while typing) |
| Global | `Esc`-free by design; all shortcuts skipped when focus is in an input/textarea |

## Evaluation Checklist

- Generate from pasted notes → summary + flashcards + quiz in tabs
- Options (difficulty / counts / language) change the output; Urdu renders RTL
- Invalid input (too short / too long / gibberish) handled with friendly copy
- API failure shows an error banner; retry preserves the pasted notes
- Flashcards flip; practice mode scores and re-queues missed cards once
- SRS study mode queues only due cards; Again/Good/Easy reschedule them (1 → 6 → ×ease); the "N cards due today" chip tracks the load; schedules survive refresh
- Weak areas aggregate flashcard "Again" misses and wrong quiz answers (threshold 2), sort by most misses, and jump to the exact card/question
- Quiz locks answers, shows explanations, tracks score, retakes cleanly; wrong answers count toward weak areas
- Follow-up chat streams answers grounded in the notes; stop/regenerate work
- Export downloads a complete Markdown document; the summary downloads as plain .txt; Print produces a clean PDF handout
- History persists across refresh; reopening a set costs no tokens; delete works and an Undo toast (8s) restores it
- History search filters by title/term; a set exports as .json and re-imports cleanly (bad files are rejected with a friendly alert)
- Flashcard browse search filters the deck live; practice/study hide while a query is active; dots follow the filtered deck
- Keyboard shortcuts work per the map above and never fire while typing in an input
- "Explain differently" on a card or question shows an inline, simpler rewrite; repeated clicks within 60s reuse the cache (no quota burn)
- Notes input accepts a .txt/.md **file** too — contents fill the textarea, editable, then Generate
- Stats tile counts flashcards + quiz questions across all saved sets
- PWA: `npm run build && npm run start` → Lighthouse installable; offline reload of the app shell works; API routes stay uncached
- Streak chip: first generation starts a 1-day streak, a second generation the same day doesn't double it, next-day generation extends it, and a missed day resets it — all while the longest streak stays put; streak survives refresh
- Deep links: clicking a history row updates the URL to `/study-set/:id`; copying and reopening that URL restores the same set; a bad/missing id shows a 404 screen
- Shareable link: the result header has a Share button that copies `/share?s=<base64>`; opening the link shows a preview and an Import button; corrupt/missing payloads show an invalid-link screen
- Splash appears once per session/tab (~2s, sessionStorage `hasSeenSplash`); reload in the same tab skips it; a new tab may show it again; reduced motion collapses the animation to a plain fade
- Onboarding: the first ever visit shows a 3-step welcome (Paste & generate / Study the smart way / Track & chat) with Next/Back, Skip, Escape, and a one-word "Start studying" finish; skipping or finishing sets localStorage `capstone-onboarding-done`, so it never reappears
- Usable at phone width (320px+); keyboard navigable; reduced motion respected

## Limitations

- **No accounts or sync** — history lives in the browser's localStorage only; clearing site data erases it
- **Grounding is prompt-enforced, not retrieval** — very long notes are capped at 15,000 characters
- **Practice mode is not SRS** — it's a one-session drill (missed cards repeat once). Cross-day scheduling lives in the separate study (SRS) mode, which implements a simplified SM-2
- **File import is text-only** — .txt/.md are read in full; PDF/OCR is future work
- **English and Urdu only** — the generation options expose exactly two languages, both class-tested
- The legacy streaming chat (`/api/chat`, `ChatContainer`) is no longer the home page but remains functional; the "Claude" wording in a few headers is stale copy — the wired provider is Gemini

## License

MIT — built for the 2026 Frontend Engineering Capstone.
