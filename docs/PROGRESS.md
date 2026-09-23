# Progress Tracker

Mirrors the MVP checklist in `README.md`. Update both when status changes. Statuses: `Not started`, `In progress`, `Blocked`, `Done`.

Last updated: 2026-09-23

## MVP

| Item | Status | Notes |
|---|---|---|
| Course and unit structure | Not started | |
| Lesson flow | Not started | |
| Korean typing engine | Not started | |
| Virtual Korean keyboard | Not started | |
| Accuracy and speed tracking | Not started | |
| Lesson results | Not started | |
| Review system | Not started | |
| EXP and Level progression | Not started | |
| Firebase Anonymous Authentication | Not started | See [[DEC-001]] in `docs/DECISIONS.md` |
| Firestore progress persistence | Not started | |
| Settings | Not started | |

## Later (post-MVP)

| Item | Status | Notes |
|---|---|---|
| Google account linking | Not started | |
| Cloud profile sync | Not started | |
| Achievements | Not started | |
| Daily streaks | Not started | |
| Pronunciation audio | Not started | |
| More courses and lesson types | Not started | |

## Foundational / Setup (not in README checklist, tracked here)

| Item | Status | Notes |
|---|---|---|
| Vite + React + TypeScript scaffold | Done | Vite 7.3.6, React 19.3, TypeScript 5.9.3 — matches README badges |
| Tailwind CSS setup | Done | Tailwind 4 via `@tailwindcss/vite`, `src/index.css` |
| Firebase project + SDK wiring | Not started | Blocked on a Firebase project + `.env.local` values from the user |
| Domain/application/infrastructure folder skeleton | In progress | `domain/models` + `domain/repositories` done (see [[DEC-002]]); `application/`, `infrastructure/firebase/`, `features/` are empty dirs pending Firebase wiring + open decisions in `docs/DOMAIN-MODEL.md` |
| ESLint + Prettier config | Done | Flat config `eslint.config.js`, `.prettierrc.json` |
| Vitest + React Testing Library setup | Done | `pnpm test`; smoke test in `src/App.test.tsx` passing |
| Cloudflare Pages deploy pipeline | Not started | |

## Current Focus

Scaffold verified: `pnpm build`, `pnpm lint`, `pnpm exec vitest run` all pass. Next: either wire Firebase (needs user's project credentials) or start on Course/unit structure once the open questions in `docs/DOMAIN-MODEL.md` are resolved.
