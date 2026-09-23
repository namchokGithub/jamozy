# Progress Tracker

Mirrors the MVP checklist in `README.md`. Update both when status changes. Statuses: `Not started`, `In progress`, `Blocked`, `Done`.

Last updated: 2026-09-23

## MVP

| Item                              | Status      | Notes                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Course and unit structure         | In progress | Read path + UI done: `application/get-course.ts` (`getCourses`, `getCourseUnits`, `getCourseMap`) wired to `CourseListPage` (`/`) and `CourseMapPage` (`/courses/:courseId`, expandable unit sections with lesson completion badges). Verified end-to-end against live Firestore |
| Lesson flow                       | In progress | `application/complete-lesson.ts` + `application/update-progress.ts` done and unit-tested. `LessonDetailPage` (`/lessons/:lessonId`) shows exercises read-only, verified against live Firestore. No typing engine / "Start Lesson" yet — deliberately out of scope for this UI round |
| Korean typing engine              | Not started |                                                                                                                                                                                                                                                                                                 |
| Virtual Korean keyboard           | Not started |                                                                                                                                                                                                                                                                                                 |
| Accuracy and speed tracking       | In progress | `update-progress`/`complete-lesson` record accuracy/speed/duration into `Progress` + `UserStats`. No UI surfacing these yet |
| Lesson results                    | Not started | `complete-lesson` returns `expGained`/`level`/`unlockedNextLessonId` — no Lesson Result screen yet |
| Review system                     | In progress | `application/get-review-items.ts` + `application/submit-review-result.ts` done and unit-tested. No UI yet |
| EXP and Level progression         | In progress | EXP awarded in `complete-lesson` per `docs/requirement.md` #8 (100 base / +20 acc>90 / +50 perfect); `levelFromExp` derives level. No UI yet |
| Firebase Anonymous Authentication | In progress | SDK wired (`src/infrastructure/firebase/firebase.ts`, `signInAnonymouslyIfNeeded`), Anonymous provider enabled in console. Now actually called from the app: every route loader signs in before reading Firestore (see [[DEC-016]]). See [[DEC-001]]                                                                                                                          |
| Firestore progress persistence    | In progress | All 5 `FirebaseXRepository` implementations done, wired to `application/` use cases. Rules + composite indexes deployed ([[DEC-015]], [[DEC-016]]). Course list/map/lesson-detail read path verified end-to-end against live Firestore data. Progress writes (`complete-lesson`) still unverified against live Firestore — no UI triggers a lesson completion yet |
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
| Domain/application/infrastructure folder skeleton | In progress | `domain/` (+ `errors.ts`, [[DEC-016]]), `application/` (6 use cases, see [[DEC-014]]), `infrastructure/firebase/{firebase.ts,repositories,mappers,seed}` all done (see [[DEC-002]]); `features/` now has its first UI (course list, course map, lesson detail — [[DEC-016]]), `app/` holds the router + shared error/not-found pages |
| ESLint + Prettier config                          | Done        | Flat config`eslint.config.js`, `.prettierrc.json`                                                                                                                                                                                                                                                                             |
| Vitest + React Testing Library setup              | Done        | `pnpm test`; placeholder `src/App.test.tsx` removed when the router replaced it — coverage now spans `application/`, `domain/`, and `features/`/`app/` components (48 tests)                                                                                                                                                                                                                                                                         |
| Cloudflare Pages deploy pipeline                  | Not started |                                                                                                                                                                                                                                                                                                                               |

## Current Focus

First UI feature shipped end-to-end: course list (`/`) → course map with expandable unit sections and lesson completion badges (`/courses/:courseId`) → read-only lesson detail (`/lessons/:lessonId`). React Router loaders (`*.loader.ts` files next to each page) call the `application/` layer — never Firebase directly — via an injected `ensureUser` dependency, and never mirror loader data into Zustand, per `AGENTS.md`'s Data Fetching section. Shared `RouteError`/`NotFoundPage` handle loader failures and unmatched URLs. Verified against the live `jamozy` Firestore, real seeded content, in an actual browser (screenshots + console checked).

`application/` layer: `get-course.ts` (now includes `getCourseMap`), `get-lesson.ts`, `update-progress.ts`, `complete-lesson.ts`, `get-review-items.ts`, `submit-review-result.ts` (6th file beyond README's original 5 — [[DEC-014]]). `CourseRepository.getUnitById` and a full `UserProfileRepository`/`FirebaseUserProfileRepository` also added ([[DEC-014]]).

Two real bugs surfaced by manual browser testing, fixed and now pinned by tests, not just fixed ad hoc — see [[DEC-016]]: (1) Firestore needs composite indexes for `units`/`lessons` queries (`firestore.indexes.json`, needs `firebase deploy --only firestore:indexes` — **run this before the course map works in any environment**, including a fresh clone), (2) every loader must sign in before reading Firestore content (`firestore.rules` requires it), now via an injected `ensureUser` dependency rather than each `features/` file importing Firebase directly. A fresh-context code review (Opus) confirmed no third instance of the same bug and flagged 4 Important findings, all fixed in the same pass (see `docs/DECISIONS.md` DEC-016 and the plan's ledger for detail): the auth/layering fix above, a distinct `NotFoundError` so "this doesn't exist" reads differently from "something broke," and empty-state text on all four list-rendering spots (courses/units/lessons/exercises) instead of silently rendering nothing.

**Still open, not forgotten:** [[DEC-015]]'s MVP-only security gap — any signed-in user can currently write `courses`/`units`/`lessons`, not just their own progress. Fine for local dev, must be replaced before any public launch. Every lesson currently shows a "Locked" badge for a brand-new user (no code path seeds the first lesson as unlocked yet) — link stays clickable regardless, deliberately out of scope for this UI-only round.

`pnpm build`/`lint`/`vitest run` all pass (48 tests).

Next real steps, not blocked on each other: (1) build the Korean typing engine core logic (unlocks an actual "Start Lesson" flow), or (2) build remaining `features/` UI (review, settings, dashboard) against the `application/` use cases already in place.
