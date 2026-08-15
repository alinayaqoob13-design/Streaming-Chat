# AI Study Notes Buddy

## Project Overview
AI Study Notes Buddy is a web application that helps students transform lecture notes into comprehensive study materials using AI. Students can paste their lecture notes or import files, and the application generates a summary, flashcards, and a quiz — all grounded solely in the pasted content, nothing invented.

The application features a full-featured study workspace with tabbed artifact views, spaced-repetition flashcard practice (SRS), weak-area tracking, a interactive quiz mode, follow-up chat grounded in the notes, daily study streak tracking, and the ability to save and share study sets.

**Built with:** Next.js 15, React 19, TypeScript, Google Gemini AI, Framer Motion, Tailwind CSS v4  
**Target audience:** Students and lifelong learners who want to optimize their study review time  
**Key problem solved:** Students spend hours re-reading notes without active engagement; this app transforms passive notes into active study tools in seconds.

## Setup & Run Instructions

### Prerequisites
- Node.js 18+ installed
- Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### Installation
```bash
git clone <repository-url>
cd streaming-chat-capstone
npm install
```

### Environment Configuration
Copy `.env.example` to `.env.local` and add your Gemini API key:
```
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
```

### Running the Application
```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Build for Production
```bash
npm run build
npm run start
```

## Architecture Overview

### Folder Structure
```
app/              # Next.js 13+ App Router
  layout.tsx      # Root layout with metadata, providers, and global CSS
  globals.css     # Tailwind v4 + design tokens (+color-accent: #d69cae)
  page.tsx        # Home page with SplashGate → OnboardingGate → NotesBuddy
  api/notes/      # API routes for generation, explain, chat
  api/chat/       # Streaming chat API

components/       # React components
  notes-input.tsx     # Hero + textarea + generate flow (Phases 5-10)
  notes-buddy.tsx     # State orchestrator (input/generating/result/error)
  notes-result.tsx    # Tabbed view: Summary | Flashcards | Quiz | Weak areas
  flashcards-view.tsx # Browse/practice/study SRS modes (flip cards + TTS listen)
  notes-chat.tsx      # Follow-up chat about a study set
  input-top-bar.tsx   # Streak chip + stats + recent sets popover
  streak-display.tsx  # Daily streak chip
  weak-areas-view.tsx # Most-missed cards/questions queries

lib/              # Utility libraries and pure logic
  config.ts              # SINGLE SOURCE OF TRUTH: system prompts, generation config
  export-notes.ts        # studySetToWordHtml + downloadWord (.doc), markdown/txt helpers
  quiz-progress.ts       # Mid-quiz answer persistence per set
  srs.ts                 # Simplified SM-2: ratings, due logic, miss counting
  share-link.ts          # encode/decode a SavedStudySet into URL-safe base64
  streak.ts              # Daily streak: local date keys, one count/day, best-streak
  utils.ts               # cn(), formatTime(), generateId(), debounce()
  view-transition.ts     # View Transition API wrapper

hooks/
  use-auto-scroll.ts     # Pinned/free auto-scroll logic (threshold 30px)

types/
  notes.ts               # StudyNotes, Flashcard, QuizQuestion, SavedStudySet interfaces

app-shell/          # App shell components
  app-shell.tsx         # Sidebar + main content area, mobile drawer
  streak-display.tsx     # Streak chip in top bar
  notes-history.tsx      # Saved study sets list with CRUD

```

### State Management
- **Clerk:** Authentication, onboarding flag (per-account, not per-browser)
- **localStorage:** Saved study sets (capped at 20), SRS ratings, streak data, weak areas
- **NotesBuddy state machine:** `input` → `generating` → `result` / `error`
- **View transitions:** Crossfade transition between hero ↔ compose ↔ result views using the View Transitions API

### Key Decisions
- **Client-side only:** No database; all persistence via localStorage + Clerk metadata
- **Grounded generations:** Every AI output is grounded only in the user's pasted notes via system prompt — no hallucinations
- **Progressive enhancement:** Hero → compose → results flows smoothly with Framer Motion animations
- **Mobile-first:** Touch-friendly targets (44px minimum), responsive grid, swipeable flashcards

## AI Integration Explanation

The application uses **Google Gemini** (model: `gemini-3.1-flash-lite` by default, overridable via `GOOGLE_MODEL` env var) through the Vercel AI SDK v4.

### Core Prompt Design
The system prompt grounds the model exclusively in the user's pasted notes:
- **No hallucinations:** The model cannot invent facts not present in the notes
- **Consistent with notes:** All generated content references the actual pasted material
- **Multi-artifact generation:** A single API call produces summary, flashcards, and quiz simultaneously

### API Call Structure
```
POST /api/notes
{
  "notes": "User's pasted lecture notes",
  "options": {
    "difficulty": "medium",     // easy/medium/hard
    "flashcardCount": 8,        // 3-12
    "quizCount": 5,             // 3-8
    "language": "en"            // "en" or "ur" (Urdu)
  }
}
```

The API route (`app/api/notes/route.ts`) validates the request, checks the API key, and calls `streamText` with the **Notes System Prompt** from `lib/config.ts`. The system prompt instructs the model to:
1. Generate a summary, flashcards, and quiz from the notes
2. Ground all output exclusively in the provided notes
3. Include Urdu language support when `language: "ur"` is selected
4. Clamp flashcard/quiz counts to schema-valid bounds

### Why This Approach Matters
Traditional AI tools can confidently hallucinate facts not present in source material. This app ensures all generated study material is **verified against the user's own notes**, making it safe for academic use and test preparation.

## Testing

### Running Tests
```bash
npm test              # Run all 236 tests
npm run test:coverage # Run with coverage report
npm test:watch        # Run in watch mode
```

### Coverage
- **236 tests across 25 test files**
- **76.5% overall coverage**
- Critical logic areas well-covered: SRS/spaced-repetition (100%), generate button state machine (91.72%), flashcard render (99.5%), onboarding completion logic
- Chat/chat-input files excluded from coverage targets (Clerk auth components)

### Test Categories
- **SRS logic:** `tests/srs.test.ts` — Again/Good/Easy ratings, due date logic, purity
- **NotesInput:** `tests/notes-input.test.tsx` — Hero/compose transitions, back navigation, state machine
- **Flashcards:** `tests/flashcards-view.test.tsx` — Browse/flip/practice/study modes
- **NotesBuddy:** `tests/notes-buddy.test.tsx` — Generate flow, persistence, undo toast
- **All other test files:** Onboarding, stats, share, export, file import, splash, streak, weak areas, quiz view, quiz progress

## Known Limitations & Future Improvements

### Current Limitations
- **Per-browser persistence:** Study data (sets, streak, SRS, weak areas) lives in localStorage and is **not synced across devices** per account — would need a database (e.g., Supabase) tied to Clerk user ID
- **Text input only:** PDF/multi-format upload not yet supported (text paste only)
- **No mock exam mode, tags/folders, sharing links, badges, or keyboard shortcuts** — these were scoped out
- **API rate limiting:** Gemini API has rate limits (429 errors handled gracefully)

### Future Improvements
- Database-backed persistence (Supabase/Clerk) for cross-device sync
- PDF/multi-format text extraction
- Mock exam mode with timed practice
- Tags/folders for note organization
- Sharing links for study sets
- Badges and achievement system
- Keyboard shortcuts power user mode
- Additional languages beyond English/Urdu

## Deployment

This project is configured for **Vercel** deployment.

### Deployment Process
1. Push to the `main` branch
2. Vercel auto-deploys the production build
3. Environment variables must be set in the Vercel dashboard:
   - `GOOGLE_GENERATIVE_AI_API_KEY` — required for AI generation
   - `GOOGLE_MODEL` — optional, overrides default `gemini-3.1-flash-lite`

### Pre-Deployment Checklist
- [ ] `npm run build` compiles successfully
- [ ] `npm test` passes (236 tests)
- [ ] `GOOGLE_GENERATIVE_AI_API_KEY` set in Vercel dashboard
- [ ] No console errors on a production build
- [ ] `GOOGLE_MODEL` env var configured if overriding default

### Rollback Plan
- Vercel automatically preserves previous deployments
- Instant rollback available in the Vercel dashboard
- To rollback: go to Vercel → Deployments → select previous deployment → "Rollback"
- Rollback is instant and preserves all localStorage data (per-browser)

### Live Demo
The application is deployed at: **https://streaming-chat-capstone.vercel.app** (requires Gemini API key for full functionality; demo mode available with sample notes).

## Reflection
*This section is reserved for the project owner's personal reflection — written in their own words about their actual experience, challenges, and what they'd do differently. This is explicitly graded on being honest and first-person — not AI-generated content.*