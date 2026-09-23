# Progress Tracker

Mirrors the MVP checklist in `README.md`. Update both when status changes. Statuses: `Not started`, `In progress`, `Blocked`, `Done`.

Last updated: 2026-09-23

## MVP

| Item                              | Status      | Notes                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Course and unit structure         | In progress | Read path done: `application/get-course.ts` (`getCourses`, `getCourseUnits`) + `application/get-lesson.ts`. No UI yet |
| Lesson flow                       | In progress | `application/complete-lesson.ts` + `application/update-progress.ts` done and unit-tested (29 tests). No UI yet |
| Korean typing engine              | Not started |                                                                                                                                                                                                                                                                                                 |
| Virtual Korean keyboard           | Not started |                                                                                                                                                                                                                                                                                                 |
| Accuracy and speed tracking       | In progress | `update-progress`/`complete-lesson` record accuracy/speed/duration into `Progress` + `UserStats`. No UI yet |
| Lesson results                    | Not started | `complete-lesson` returns `expGained`/`level`/`unlockedNextLessonId` — no Lesson Result screen yet |
| Review system                     | In progress | `application/get-review-items.ts` + `application/submit-review-result.ts` done and unit-tested. No UI yet |
| EXP and Level progression         | In progress | EXP awarded in `complete-lesson` per `docs/requirement.md` #8 (100 base / +20 acc>90 / +50 perfect); `levelFromExp` derives level. No UI yet |
| Firebase Anonymous Authentication | In progress | SDK wired (`src/infrastructure/firebase/firebase.ts`, `signInAnonymouslyIfNeeded`), Anonymous provider enabled in console, not called from app UI yet. See [[DEC-001]]                                                                                                                          |
| Firestore progress persistence    | In progress | All 5 `FirebaseXRepository` implementations done, wired to `application/` use cases. `pnpm seed` hit `PERMISSION_DENIED` (no rules deployed) — added `firestore.rules`/`firebase.json`/`.firebaserc` ([[DEC-015]]), pending `firebase deploy --only firestore:rules` by user, then re-run seed |
| Settings                          | Not started | `UserSettings` schema done ([[DEC-013]]), no read/write use case or UI yet |

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
| Domain/application/infrastructure folder skeleton | In progress | `domain/`, `application/` (6 use cases, see [[DEC-014]]), `infrastructure/firebase/{firebase.ts,repositories,mappers,seed}` all done (see [[DEC-002]]); `features/` (UI) still empty |
| ESLint + Prettier config                          | Done        | Flat config`eslint.config.js`, `.prettierrc.json`                                                                                                                                                                                                                                                                             |
| Vitest + React Testing Library setup              | Done        | `pnpm test`; smoke test in `src/App.test.tsx` passing                                                                                                                                                                                                                                                                         |
| Cloudflare Pages deploy pipeline                  | Not started |                                                                                                                                                                                                                                                                                                                               |

## Current Focus

`application/` layer built: `get-course.ts`, `get-lesson.ts`, `update-progress.ts`, `complete-lesson.ts`, `get-review-items.ts`, `submit-review-result.ts` (6th file beyond README's original 5 — see [[DEC-014]]). Each tested against in-memory fake repositories (`src/test/fakes.ts`) — 29 tests total, all passing, no Firebase/network needed for these tests. Also added `CourseRepository.getUnitById` and a full `UserProfileRepository`/`FirebaseUserProfileRepository` ([[DEC-014]]).

Sample seed content written: 1 course, 2 units, 2 lessons, 6 vocabulary exercises (`src/infrastructure/firebase/seed/sample-content.ts`) + a standalone seed script (`pnpm seed`, `scripts/seed-firestore.ts`). User ran it against the live `jamozy` project — hit `PERMISSION_DENIED` (Firestore had no rules deployed, default deny-all). Added `firestore.rules` + `firebase.json` + `.firebaserc` ([[DEC-015]]) — **flags a real MVP-only security gap: any signed-in user can currently write `courses`/`units`/`lessons`, not just their own progress; must be replaced before any public launch.** User will deploy the rules themselves (`firebase login` then `firebase deploy --only firestore:rules`) and re-run `pnpm seed`.

`pnpm build`/`lint`/`vitest run` all pass.

Next real steps once rules are deployed and seed succeeds: (1) start `features/` UI (course list, lesson flow) wired to these use cases, or (2) build the Korean typing engine core logic — not blocked on each other, or on the seed.
