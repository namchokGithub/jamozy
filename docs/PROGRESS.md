# Progress Tracker

Mirrors the MVP checklist in `README.md`. Update both when status changes. Statuses: `Not started`, `In progress`, `Blocked`, `Done`.

Last updated: 2026-09-23

## MVP

| Item                              | Status      | Notes                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Course and unit structure         | In progress | Read path + UI done: `application/get-course.ts` (`getCourses`, `getCourseUnits`, `getCourseMap`) wired to `CourseListPage` (`/`) and `CourseMapPage` (`/courses/:courseId`, expandable unit sections with lesson completion badges). Verified end-to-end against live Firestore |
| Lesson flow                       | In progress | `application/complete-lesson.ts` + `application/update-progress.ts` done and unit-tested. `LessonDetailPage` (`/lessons/:lessonId`) shows exercises read-only, verified against live Firestore. No typing engine / "Start Lesson" yet — deliberately out of scope for this UI round |
| Korean typing engine              | In progress | Core engine done and unit-tested ([[DEC-017]]): 2-beolsik keymap, Hangul composition, target-sequence compilation, jamo-level matching state machine (`src/domain/korean/`), thin Zustand store (`src/features/typing/session-store.ts`, first Zustand use in this codebase). Domain data independently verified during review. Not wired into any UI yet — no "Start Lesson" flow, no lesson-exercise sequencing |
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
| Domain/application/infrastructure folder skeleton | In progress | `domain/` (+ `errors.ts` [[DEC-016]], `korean/` [[DEC-017]]), `application/` (6 use cases, see [[DEC-014]]), `infrastructure/firebase/{firebase.ts,repositories,mappers,seed}` all done (see [[DEC-002]]); `features/` has course/lesson UI ([[DEC-016]]) + a typing session store ([[DEC-017]]), `app/` holds the router + shared error/not-found pages |
| ESLint + Prettier config                          | Done        | Flat config`eslint.config.js`, `.prettierrc.json`                                                                                                                                                                                                                                                                             |
| Vitest + React Testing Library setup              | Done        | `pnpm test`; placeholder `src/App.test.tsx` removed when the router replaced it — coverage now spans `application/`, `domain/`, and `features/`/`app/` components (88 tests)                                                                                                                                                                                                                                                                         |
| Cloudflare Pages deploy pipeline                  | Not started |                                                                                                                                                                                                                                                                                                                               |

## Current Focus

Korean typing engine core logic built ([[DEC-017]]): `src/domain/korean/{keymap,hangul,target-sequence,typing-session}.ts` (framework-free, no React/Zustand imports) + `src/features/typing/session-store.ts` (Zustand, first use in this codebase). Precompiles a known exercise's target text into its exact expected 2-beolsik keystrokes, then matches physical `KeyboardEvent.code` presses jamo-by-jamo — a wrong key is rejected (counted as a mistake, never mutates state) per the plan's jamo-level-blocking decision.

A fresh-context review (Opus) independently re-verified the Korean-language domain data (Unicode Hangul formula, the 19/21/28 jamo-list orderings, the 2-beolsik keymap, the 7 compound-jungseong/11 compound-jongseong tables) against known reference values and the browser's own Unicode decomposition for all 11,172 precomposed syllables — **no domain-data errors found**. 3 Important UX/correctness findings were fixed in the same pass, all pinned by tests: (1) holding Shift on a key with no Shift variant (common when typing fast after a tense consonant) no longer counts as a mistake, (2) a bare modifier keydown (e.g. `ShiftLeft` alone) is now ignored rather than counted wrong, (3) a half-typed compound jungseong/jongseong now composes progressively (e.g. shows 갑/호) instead of showing no visible change for a correct keystroke — this last one **supersedes** the plan's original Review Focus #3 choice; see [[DEC-017]] for the full reasoning.

Not yet built (deliberately out of scope this round, per the spec): lesson-exercise sequencing, aggregate lesson metrics, any UI component, `complete-lesson` wiring, or a "Start Lesson" flow on `LessonDetailPage`.

**Still open, not forgotten:** [[DEC-015]]'s MVP-only security gap (any signed-in user can write `courses`/`units`/`lessons`). Every lesson still shows "Locked" for a brand-new user (link stays clickable regardless) — out of scope for the UI round that shipped it.

`pnpm build`/`lint`/`vitest run` all pass (88 tests).

Next real steps, not blocked on each other: (1) wire the typing engine into `LessonDetailPage` with an actual "Start Lesson" flow + virtual keyboard visualization, (2) build remaining `features/` UI (review, settings, dashboard) against the `application/` use cases already in place.
