# Progress Tracker

Mirrors the MVP checklist in `README.md`. Update both when status changes. Statuses: `Not started`, `In progress`, `Blocked`, `Done`.

Last updated: 2026-09-23

## MVP

| Item                              | Status      | Notes                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Course and unit structure         | Not started |                                                                                                                                                                                                                                                                                                 |
| Lesson flow                       | Not started |                                                                                                                                                                                                                                                                                                 |
| Korean typing engine              | Not started |                                                                                                                                                                                                                                                                                                 |
| Virtual Korean keyboard           | Not started |                                                                                                                                                                                                                                                                                                 |
| Accuracy and speed tracking       | Not started |                                                                                                                                                                                                                                                                                                 |
| Lesson results                    | Not started |                                                                                                                                                                                                                                                                                                 |
| Review system                     | Not started |                                                                                                                                                                                                                                                                                                 |
| EXP and Level progression         | Not started |                                                                                                                                                                                                                                                                                                 |
| Firebase Anonymous Authentication | In progress | SDK wired (`src/infrastructure/firebase/firebase.ts`, `signInAnonymouslyIfNeeded`), Anonymous provider enabled in console, not called from app UI yet. See [[DEC-001]]                                                                                                                          |
| Firestore progress persistence    | In progress | `FirebaseProgressRepository`/`FirebaseReviewRepository`/`FirebaseCourseRepository`/`FirebaseLessonRepository` implemented against `domain/repositories`. Firestore database enabled in console. Not exercised against real data yet (no seed content, no `application/` use cases calling them) |
| Settings                          | Not started |                                                                                                                                                                                                                                                                                                 |

## Later (post-MVP)

| Item                          | Status      | Notes |
| ----------------------------- | ----------- | ----- |
| Google account linking        | Not started |       |
| Cloud profile sync            | Not started |       |
| Achievements                  | Not started |       |
| Daily streaks                 | Not started |       |
| Pronunciation audio           | Not started |       |
| More courses and lesson types | Not started |       |

## Foundational / Setup (not in README checklist, tracked here)

| Item                                              | Status      | Notes                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vite + React + TypeScript scaffold                | Done        | Vite 7.3.6, React 19.3, TypeScript 5.9.3 — matches README badges                                                                                                                                                                                                                                                              |
| Tailwind CSS setup                                | Done        | Tailwind 4 via`@tailwindcss/vite`, `src/index.css`                                                                                                                                                                                                                                                                            |
| Firebase project + SDK wiring                     | In progress | Project`jamozy` created, `.env.local` fixed (was `NEXT_PUBLIC_*`, needs `VITE_*` for Vite). Anonymous Auth + Firestore database enabled in console. `messagingSenderId`/`appId` still blank — need a Web App registered in Firebase Console (Project Settings → General → Your apps → Add app → Web) to get those two values. |
| Domain/application/infrastructure folder skeleton | In progress | `domain/models` + `domain/repositories` + `infrastructure/firebase/{firebase.ts,repositories,mappers}` done (see [[DEC-002]]); `application/` and `features/` still empty pending open decisions in `docs/DOMAIN-MODEL.md`                                                                                                    |
| ESLint + Prettier config                          | Done        | Flat config`eslint.config.js`, `.prettierrc.json`                                                                                                                                                                                                                                                                             |
| Vitest + React Testing Library setup              | Done        | `pnpm test`; smoke test in `src/App.test.tsx` passing                                                                                                                                                                                                                                                                         |
| Cloudflare Pages deploy pipeline                  | Not started |                                                                                                                                                                                                                                                                                                                               |

## Current Focus

Firebase project set up (Anonymous Auth + Firestore enabled), SDK wired, and all four `infrastructure/firebase/repositories` implemented against `domain/repositories`. `pnpm build`/`lint`/`vitest run` all pass. Remaining: add a Web App to the `jamozy` project for `messagingSenderId`/`appId` (optional — not required for Auth/Firestore to work). Next real step: resolve `docs/DOMAIN-MODEL.md` open questions, then build `application/` use cases and seed sample course/unit/lesson content to actually exercise the repositories.
