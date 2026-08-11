# Reflection — AI Study Notes Buddy (Capstone)

Use this template to write your 1-page reflection. Replace each prompt with your honest experience.

## What problem does this app solve?

For COMSATS students (including myself), lecture notes are often long and unstructured. This app turns pasted notes into a summary, flashcards, and a quiz — plus spaced-repetition review and weak-area tracking — so studying becomes active instead of passive re-reading.

## What was hardest? Why?

- *Prompt engineering & structured output:* getting Gemini to consistently return valid JSON matching the zod schema across English and Urdu notes took iteration.
- *Local-first state:* everything lives in `localStorage`, so deep links, share links, undo, and import/export all had to be designed around a single browser boundary.
- *Accessibility:* making keyboard shortcuts, focus rings, and screen-reader announcements coexist with animations was more detail work than expected.

## What would you do differently next time?

- *Start smaller:* I added several "nice-to-have" features (SRS, share links, mixed practice) that are valuable, but I would sequence them more strictly after the core flow is rock-solid.
- *Test earlier:* writing component tests alongside each feature, rather than in batches, would have caught integration issues sooner.
- *Use a lightweight backend:* for a real product I would add a tiny backend for accounts/sync so share links and cross-device access don't rely on long URLs.

## One thing you learned that surprised you

That **structured output + validation on the server** is far more reliable for AI-powered UIs than parsing free-form text in the browser. Once the zod schema was in place, the whole UI became predictable even when the model's wording changed.

## Honest note on scope

This app is intentionally local-only and uses a free Gemini key. The "AI" is meaningful because it transforms notes into three grounded artifacts and answers follow-up questions strictly from those notes — it is not a generic chatbot echo.
