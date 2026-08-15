# Deployment Checklist — AI Study Notes Buddy

Use this checklist before every production deploy. It mirrors the FE-11 intentional-deployment template.

## Environment

- [ ] `GOOGLE_GENERATIVE_AI_API_KEY` is set in Vercel project settings (Production environment)
- [ ] `GOOGLE_MODEL` is set only if overriding the default; otherwise the default `gemini-3.1-flash-lite` is used
- [ ] No `NEXT_PUBLIC_` API key variables exist
- [ ] `.env.local` is gitignored and never committed

## Pre-deploy verification (run locally)

```bash
npm ci
npx tsc --noEmit
npm test
npm run build
```

- [ ] `tsc --noEmit` passes with zero errors
- [ ] All Vitest tests pass (target: 199+)
- [ ] `npm run build` completes without prerender errors
- [ ] `npm run start` smoke-test: generate a set, stop mid-stream, refresh, reopen from history

## Deploy

- [ ] Push `main` to GitHub; Vercel production deploy auto-triggers
- [ ] Wait for Vercel build to finish
- [ ] Confirm health checks return 200:
  - `GET /api/chat`
  - `GET /api/notes`
  - `GET /api/notes/chat`
  - `GET /api/notes/explain`

## Post-deploy verification (production URL)

- [ ] Home page loads at the production URL
- [ ] Paste sample notes → generate → summary/flashcards/quiz appear
- [ ] History row reopens without an API call
- [ ] `/study-set/<id>` deep link works for a saved set; missing id shows 404
- [ ] `/share?s=<payload>` import flow works
- [ ] `/mixed-practice` works when saved sets exist
- [ ] Mobile layout usable at 320–375 px width
- [ ] Lighthouse mobile scores ≥ 85 (target 90+)
- [ ] axe DevTools / WAVE shows zero WCAG 2.1 AA violations

## Monitoring & failure modes

| Failure | Safe behavior | How to detect |
|---|---|---|
| Missing API key | Route returns 500 with friendly message | Health check fails |
| Rate limit | Route returns 429; UI shows retry message | Vercel logs |
| LocalStorage full / unavailable | Saves fail silently; app continues | Manual test in private window |
| Invalid share payload | `/share` shows invalid-link screen | N/A — expected path |

## Rollback plan

1. In Vercel dashboard, open the previous successful production deployment.
2. Click **Promote to Production** (or redeploy the previous commit).
3. Verify health checks again.
4. If a bad commit is in `main`, revert it with `git revert <commit>` and push.

## Sign-off

| Role | Name | Date |
|---|---|---|
| Developer | Alina Yaqoob | 2026-08-03 → 2026-08-14 (capstone period) |
| Reviewer (if any) | Alina Yaqoob | 2026-08-14 |
