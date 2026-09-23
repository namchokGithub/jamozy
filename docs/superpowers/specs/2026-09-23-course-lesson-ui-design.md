# Course & Lesson UI — Design

**Date:** 2026-09-23
**Status:** Approved, not yet implemented

## Goal

Build the first UI feature in Jamozy: a read-only path from course list through to lesson content, wired to the existing `application/` use cases and live Firestore seed data. Proves the full stack (`features/` → `application/` → `domain/repositories` → `infrastructure/firebase` → Firestore) end-to-end before the typing engine exists.

## Scope

**In scope:**

- `/` — course list
- `/courses/:courseId` — course map: units, each expandable to show its lessons + completion state
- `/lessons/:lessonId` — lesson detail: exercises (Korean text, romanization, meaning), read-only

**Explicitly out of scope (deferred):**

- Any interactive typing UI — no typing engine exists yet. No "Start Lesson" button (a disabled stub would be a dead CTA); this round only proves the data reaches the lesson detail screen.
- `/units/:unitId` as its own route — lesson lists stay inline on the course-map page. Only add a dedicated unit route if units later gain enough standalone content/functionality to justify it.
- Zustand — this round is entirely read-only (no typing-session state to hold). Introduce Zustand when the interactive typing engine needs transient session/keystroke state.
- Settings UI (meaning-language toggle, etc.) — lesson detail shows both Thai and English meaning for now.
- Loading skeletons / pending UI — reads are small at seed scale; keep it simple.

## Architecture — new use case

Add `getCourseMap` to `application/get-course.ts` (extends the existing file — same "getting course info" concern as `getCourses`/`getCourseUnits`, not a new file).

```ts
interface CourseMapUnit {
  unit: Unit
  lessons: Array<{ lesson: Lesson; progress: Progress | null }>
}
interface CourseMap {
  course: Course
  units: CourseMapUnit[]
}

function getCourseMap(
  deps: { courseRepo: CourseRepository; lessonRepo: LessonRepository; progressRepo: ProgressRepository },
  userId: string,
  courseId: string,
): Promise<CourseMap>
```

Fetches the course, then units, then lessons+progress per unit in parallel (`Promise.all`). Throws if `courseId` doesn't resolve to a course (caught by the route's `errorElement`). N+1-shaped query pattern — acceptable at current seed scale (2 units, 2 lessons); revisit if content grows significantly.

The existing `getLesson(lessonRepo, lessonId)` from `application/get-lesson.ts` covers the lesson-detail page as-is — no new use case needed there.

## Routing

Per `docs/AGENTS.md`'s Data Fetching section (already recorded there): React Router loaders own route-persisted data, loaders call `application/` use-case functions (never Firebase directly), and loader data is never mirrored into Zustand.

- `src/app/router.tsx` — `createBrowserRouter` with 3 routes:
  - `/` → `CourseListPage`
  - `/courses/:courseId` → `CourseMapPage`
  - `/lessons/:lessonId` → `LessonDetailPage`
- `src/main.tsx` renders `<RouterProvider router={router} />` in place of the current placeholder `<App />`.

Lesson URLs stay flat (`/lessons/:lessonId`, not nested under course/unit) — mirrors Firestore's flat top-level `lessons/{lessonId}` collection (lesson IDs are already globally unique).

## Components

- `src/features/course/CourseListPage.tsx` — list of `Course` cards (title, description), each links to `/courses/:id`.
- `src/features/course/CourseMapPage.tsx` — course header + list of unit sections. Each section has local `useState` expand/collapse (ephemeral per-component UI toggle — not Zustand, no cross-component sharing needed) showing its lessons with a completion badge derived from `progress.status`. Each lesson links to `/lessons/:lessonId`.
- `src/features/lesson/LessonDetailPage.tsx` — lesson title/type + exercise list: Korean text, romanization, both Thai and English meaning. Read-only, no interactive controls.
- `src/app/RouteError.tsx` — shared `errorElement` component for not-found/fetch-failure cases, used on all 3 routes.

## Data plumbing

- `src/infrastructure/firebase/repositories/index.ts` — exports singleton repo instances (`courseRepo`, `lessonRepo`, `progressRepo`) for loaders to import. Loaders run outside the React tree, so no context/DI is needed — these repository classes take no constructor arguments.
- Loaders resolve the current `userId` via `signInAnonymouslyIfNeeded()` (already in `src/infrastructure/firebase/firebase.ts`) → `.uid`, then call the relevant use case.
- Each loader is a thin factory — e.g. `createCourseMapLoader(deps)` returns the actual React Router `LoaderFunction` — so the use-case call is unit-testable with fakes independent of the router wiring. The router binds each factory with the real singleton repos from `infrastructure/firebase/repositories/index.ts`.

## Error handling

Loaders throw on missing/failed data (e.g. `courseId`/`lessonId` not found); each route's `errorElement` renders `RouteError` with a simple message. No retry/offline handling this round.

## Testing

- Unit-test `getCourseMap` against `src/test/fakes.ts`, following the same pattern as the other `application/` use cases.
- Loader factories stay thin wrappers around the use cases — not separately unit-tested this round (low risk, easy to eyeball).
- One RTL component test (`CourseListPage`) using `MemoryRouter`/stubbed loader data to prove rendering — not exhaustive coverage across all 3 pages this round.
- `pnpm build`/`lint`/`vitest run` must all still pass.

## Follow-on work (not this round)

- Typing engine + interactive lesson screen (replaces the read-only `LessonDetailPage` exercise list, or adds a "Start Lesson" flow alongside it).
- Zustand store for typing-session state once the above exists.
- `/units/:unitId` route if units need standalone content later.
- Settings UI (meaning-language toggle, etc.).
