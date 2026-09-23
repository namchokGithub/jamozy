# Course & Lesson UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first UI feature in Jamozy — a read-only path from course list through to lesson content (course list → course map with expandable units → flat lesson detail), wired to the existing `application/` use cases and live Firestore seed data.

**Architecture:** React Router data routers (`createBrowserRouter`) own data fetching via per-route loaders; loaders are thin factories that inject repository dependencies and call `application/` use-case functions (never Firebase directly from components). One new use case, `getCourseMap`, is added to `application/get-course.ts` to return a render-ready course+units+lessons+progress structure in one call. No Zustand this round — everything is read-only.

**Tech Stack:** React 19, TypeScript 5, React Router 8 (`createBrowserRouter`/`RouterProvider`, `Component`/`ErrorBoundary` route fields — no JSX needed in route config), Tailwind CSS 4, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-23-course-lesson-ui-design.md`

## Global Constraints

- Follow `docs/AGENTS.md`'s layered architecture: components/loaders never import Firebase directly — only `infrastructure/firebase/repositories/index.ts` does; everything else goes through `application/` use cases.
- Follow `docs/AGENTS.md`'s Data Fetching section: React Router loaders own route-persisted data, loaders call `application/` use-case functions, loader data is never mirrored into Zustand.
- No Zustand this round (spec's explicit non-goal — nothing here is typing-session state).
- No `/units/:unitId` route this round (spec's explicit non-goal — lesson lists stay inline on the course-map page).
- No interactive typing UI or "Start Lesson" button this round (spec's explicit non-goal — a disabled stub button would be a dead CTA).
- No path aliases are configured in `tsconfig.app.json` — use relative imports, matching every existing file in `src/`.
- React Router is already installed at `^8.4.0`; import everything (`createBrowserRouter`, `RouterProvider`, `Link`, `useLoaderData`, `useRouteError`, and the `LoaderFunctionArgs` type) from the single `react-router` package — there is no separate `react-router-dom` package in this version.
- `pnpm build`, `pnpm lint`, and `pnpm exec vitest run` must all pass after every task.

## Review Focus

1. **Unknown/deleted course or lesson id in the URL** (typo, stale bookmark, deleted content) — a reasonable person expects a clear "not found" message, not a blank screen or an unhandled exception. Pinned in Task 3 (`RouteError` renders a thrown `Error`'s message).
2. **Any other loader failure** (Firestore network error, permission error) — same expectation: a message, not a crash. Pinned in Task 3 (`RouteError` also handles a non-`Error` throw with a generic fallback message).
3. **A URL that matches no route at all** (mistyped path, stray link) — the original spec only defined 3 routes with no catch-all, so an arbitrary path would fall through to React Router's unstyled default "no routes matched" output. Pinned in Task 7 (adds a wildcard `*` route rendering `NotFoundPage`).
4. **A brand-new user with zero `Progress` documents** — every lesson in the course map has `progress: null`, so every lesson shows a "Locked" badge (there is no code path yet that seeds the very first lesson as unlocked for a new user — a known, separate gap, out of scope for this UI-only plan). This round is read-only, so the lesson link must stay clickable regardless of the badge — a future change must not accidentally wire the "Locked" label into disabling the link. Pinned in Task 5 (`CourseMapPage` test: locked badge + still-clickable link).
5. **A unit with no lessons yet, or a course with no units yet** (sparse/in-progress content) — rendering must not crash on an empty array, and should not silently render nothing with no indication anything is there. Pinned in Task 5 (`CourseMapPage` test: unit with an empty lesson list renders no lesson links and doesn't throw).

---

### Task 1: `getCourseMap` use case

**Files:**
- Modify: `src/application/get-course.ts`
- Modify: `src/application/get-course.test.ts`

**Interfaces:**
- Consumes: `CourseRepository` (`src/domain/repositories/course-repository.ts`: `getCourseById`, `getUnitsByCourseId`), `LessonRepository` (`src/domain/repositories/lesson-repository.ts`: `getLessonsByUnitId`), `ProgressRepository` (`src/domain/repositories/progress-repository.ts`: `getProgress`) — all already implemented, including their `Firebase*` and `Fake*` versions.
- Produces: `getCourseMap(deps: GetCourseMapDeps, userId: string, courseId: string): Promise<CourseMap>`, and the exported types `CourseMap`, `CourseMapUnit`, `CourseMapLessonEntry`, `GetCourseMapDeps` — all from `src/application/get-course.ts`. Later tasks (5, 7) import these.

- [ ] **Step 1: Write the failing tests**

The file currently starts with:

```ts
import { describe, expect, it } from 'vitest'
import { getCourses, getCourseUnits } from './get-course'
import { FakeCourseRepository } from '../test/fakes'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'
```

Replace those first 5 lines with (this merges in the new imports needed below — don't add a second, separate `import` block):

```ts
import { describe, expect, it } from 'vitest'
import { getCourseMap, getCourses, getCourseUnits } from './get-course'
import {
  FakeCourseRepository,
  FakeLessonRepository,
  FakeProgressRepository,
} from '../test/fakes'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'
import type { Lesson } from '../domain/models/lesson'
```

Then add this helper below the existing `makeUnit` helper, and the new `describe` block at the bottom of the file:

```ts
function makeLesson(id: string, unitId: string, order: number): Lesson {
  return {
    id,
    unitId,
    title: id,
    type: 'word',
    order,
    exercises: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('getCourseMap', () => {
  it('throws when the course does not exist', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository(),
      lessonRepo: new FakeLessonRepository(),
      progressRepo: new FakeProgressRepository(),
    }

    await expect(getCourseMap(deps, 'user1', 'missing')).rejects.toThrow(
      'Course not found: missing',
    )
  })

  it('returns units with their lessons, each paired with progress (null when no attempt yet)', async () => {
    const deps = {
      courseRepo: new FakeCourseRepository(
        [makeCourse('c1', 1)],
        [makeUnit('u1', 'c1', 1), makeUnit('u2', 'c1', 2)],
      ),
      lessonRepo: new FakeLessonRepository([
        makeLesson('l1', 'u1', 1),
        makeLesson('l2', 'u2', 1),
      ]),
      progressRepo: new FakeProgressRepository(),
    }

    const map = await getCourseMap(deps, 'user1', 'c1')

    expect(map.course.id).toBe('c1')
    expect(map.units.map((u) => u.unit.id)).toEqual(['u1', 'u2'])
    expect(map.units[0].lessons).toEqual([
      { lesson: expect.objectContaining({ id: 'l1' }), progress: null },
    ])
  })

  it('attaches existing progress for a lesson', async () => {
    const progressRepo = new FakeProgressRepository()
    await progressRepo.saveProgress('user1', {
      lessonId: 'l1',
      status: 'completed',
      bestAccuracy: 90,
      bestSpeedWpm: 20,
      attempts: 1,
      lastAttemptAt: new Date(),
      completedAt: new Date(),
    })
    const deps = {
      courseRepo: new FakeCourseRepository(
        [makeCourse('c1', 1)],
        [makeUnit('u1', 'c1', 1)],
      ),
      lessonRepo: new FakeLessonRepository([makeLesson('l1', 'u1', 1)]),
      progressRepo,
    }

    const map = await getCourseMap(deps, 'user1', 'c1')

    expect(map.units[0].lessons[0].progress?.status).toBe('completed')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/application/get-course.test.ts`
Expected: FAIL — `getCourseMap` is not exported from `./get-course`.

- [ ] **Step 3: Implement `getCourseMap`**

`src/application/get-course.ts` currently starts with:

```ts
import type { CourseRepository } from '../domain/repositories/course-repository'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'
```

Replace those 3 lines with:

```ts
import type { CourseRepository } from '../domain/repositories/course-repository'
import type { LessonRepository } from '../domain/repositories/lesson-repository'
import type { ProgressRepository } from '../domain/repositories/progress-repository'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'
import type { Lesson } from '../domain/models/lesson'
import type { Progress } from '../domain/models/progress'
```

Then keep the existing `getCourses`/`getCourseUnits` functions exactly as they are, and append the following below `getCourseUnits`:

```ts
export interface CourseMapLessonEntry {
  lesson: Lesson
  progress: Progress | null
}

export interface CourseMapUnit {
  unit: Unit
  lessons: CourseMapLessonEntry[]
}

export interface CourseMap {
  course: Course
  units: CourseMapUnit[]
}

export interface GetCourseMapDeps {
  courseRepo: CourseRepository
  lessonRepo: LessonRepository
  progressRepo: ProgressRepository
}

export async function getCourseMap(
  deps: GetCourseMapDeps,
  userId: string,
  courseId: string,
): Promise<CourseMap> {
  const course = await deps.courseRepo.getCourseById(courseId)
  if (!course) {
    throw new Error(`Course not found: ${courseId}`)
  }

  const units = await deps.courseRepo.getUnitsByCourseId(courseId)

  const mapUnits = await Promise.all(
    units.map(async (unit): Promise<CourseMapUnit> => {
      const lessons = await deps.lessonRepo.getLessonsByUnitId(unit.id)
      const lessonEntries = await Promise.all(
        lessons.map(async (lesson): Promise<CourseMapLessonEntry> => {
          const progress = await deps.progressRepo.getProgress(
            userId,
            lesson.id,
          )
          return { lesson, progress }
        }),
      )
      return { unit, lessons: lessonEntries }
    }),
  )

  return { course, units: mapUnits }
}
```

Add the two new type-only imports (`LessonRepository`, `ProgressRepository`, `Lesson`, `Progress`) to the top of the file alongside the existing `CourseRepository`/`Course`/`Unit` imports.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/application/get-course.test.ts`
Expected: PASS (5 tests: the 2 existing plus 3 new).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/application/get-course.ts src/application/get-course.test.ts
git commit -m "feat(application): add getCourseMap use case"
```

---

### Task 2: Firestore repository singletons

**Files:**
- Create: `src/infrastructure/firebase/repositories/index.ts`

**Interfaces:**
- Consumes: `FirebaseCourseRepository`, `FirebaseLessonRepository`, `FirebaseProgressRepository` (all already implemented in this same directory, each a zero-argument constructor class).
- Produces: `courseRepo: CourseRepository`, `lessonRepo: LessonRepository`, `progressRepo: ProgressRepository` — singleton instances. Tasks 4, 5, 7 import these.

- [ ] **Step 1: Create the file**

```ts
import { FirebaseCourseRepository } from './firebase-course-repository'
import { FirebaseLessonRepository } from './firebase-lesson-repository'
import { FirebaseProgressRepository } from './firebase-progress-repository'

export const courseRepo = new FirebaseCourseRepository()
export const lessonRepo = new FirebaseLessonRepository()
export const progressRepo = new FirebaseProgressRepository()
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc -b`
Expected: no errors. (No dedicated test — this file has no logic, only wiring; it's exercised end-to-end once the router is wired in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/firebase/repositories/index.ts
git commit -m "feat(infrastructure): export singleton Firestore repository instances"
```

---

### Task 3: `RouteError` component

**Files:**
- Create: `src/app/RouteError.tsx`
- Test: `src/app/RouteError.test.tsx`

**Interfaces:**
- Consumes: `useRouteError` from `react-router`.
- Produces: `export default function RouteError(): JSX.Element` — a component usable directly as a route's `ErrorBoundary`. Used by Task 7's router.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import RouteError from './RouteError'

describe('RouteError', () => {
  it('renders the message of a thrown Error', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: () => null,
          ErrorBoundary: RouteError,
          loader: async () => {
            throw new Error('Firestore unavailable')
          },
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Firestore unavailable')).toBeInTheDocument()
  })

  it('renders a generic fallback for a non-Error throw', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: () => null,
          ErrorBoundary: RouteError,
          loader: async () => {
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw 'unexpected'
          },
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Something went wrong.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/RouteError.test.tsx`
Expected: FAIL — `src/app/RouteError.tsx` does not exist yet.

- [ ] **Step 3: Implement `RouteError`**

```tsx
import { useRouteError } from 'react-router'

export default function RouteError() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : 'Something went wrong.'

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-medium text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-slate-600">{message}</p>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/RouteError.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors. If the `eslint-disable` comment on the `throw 'unexpected'` line turns out unnecessary (the base ESLint config here doesn't include `@typescript-eslint/only-throw-error`), delete that comment line — don't leave an unused-disable warning.

- [ ] **Step 6: Commit**

```bash
git add src/app/RouteError.tsx src/app/RouteError.test.tsx
git commit -m "feat(app): add RouteError component for route error boundaries"
```

---

### Task 4: `CourseListPage` (`/`)

**Files:**
- Create: `src/features/course/CourseListPage.loader.ts`
- Create: `src/features/course/CourseListPage.tsx`
- Test: `src/features/course/CourseListPage.test.tsx`

**Interfaces:**
- Consumes: `getCourses` (`src/application/get-course.ts`), `CourseRepository` (`src/domain/repositories/course-repository.ts`), `Course` (`src/domain/models/course.ts`).
- Produces: `CourseListLoaderData` (`{ courses: Course[] }`), `createCourseListLoader(deps: { courseRepo: CourseRepository })` returning a React Router loader function. `CourseListPage` default export. Used by Task 7's router.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import CourseListPage from './CourseListPage'
import type { Course } from '../../domain/models/course'

function makeCourse(id: string): Course {
  return {
    id,
    title: `Course ${id}`,
    description: `Description for ${id}`,
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('CourseListPage', () => {
  it('renders each course as a link to its course map', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => ({ courses: [makeCourse('c1')] }),
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    const link = await screen.findByRole('link', { name: /Course c1/i })
    expect(link).toHaveAttribute('href', '/courses/c1')
    expect(screen.getByText('Description for c1')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/course/CourseListPage.test.tsx`
Expected: FAIL — `src/features/course/CourseListPage.tsx` does not exist yet.

- [ ] **Step 3: Implement the loader**

`src/features/course/CourseListPage.loader.ts`:

```ts
import { getCourses } from '../../application/get-course'
import type { CourseRepository } from '../../domain/repositories/course-repository'
import type { Course } from '../../domain/models/course'

export interface CourseListLoaderData {
  courses: Course[]
}

export function createCourseListLoader(deps: { courseRepo: CourseRepository }) {
  return async (): Promise<CourseListLoaderData> => {
    const courses = await getCourses(deps.courseRepo)
    return { courses }
  }
}
```

- [ ] **Step 4: Implement the page**

`src/features/course/CourseListPage.tsx`:

```tsx
import { Link, useLoaderData } from 'react-router'
import type { CourseListLoaderData } from './CourseListPage.loader'

export default function CourseListPage() {
  const { courses } = useLoaderData() as CourseListLoaderData

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">Jamozy</h1>
      <ul className="mt-6 space-y-3">
        {courses.map((course) => (
          <li key={course.id}>
            <Link
              to={`/courses/${course.id}`}
              className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
            >
              <div className="font-medium text-slate-900">{course.title}</div>
              <div className="text-sm text-slate-600">{course.description}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/course/CourseListPage.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/course/CourseListPage.loader.ts src/features/course/CourseListPage.tsx src/features/course/CourseListPage.test.tsx
git commit -m "feat(course): add course list page"
```

---

### Task 5: `CourseMapPage` (`/courses/:courseId`)

**Files:**
- Create: `src/features/course/CourseMapPage.loader.ts`
- Create: `src/features/course/CourseMapPage.tsx`
- Test: `src/features/course/CourseMapPage.test.tsx`

**Interfaces:**
- Consumes: `getCourseMap`, `CourseMap`, `CourseMapUnit` (`src/application/get-course.ts`), `CourseRepository`/`LessonRepository`/`ProgressRepository` types, `signInAnonymouslyIfNeeded` (`src/infrastructure/firebase/firebase.ts`).
- Produces: `CourseMapLoaderData` (`{ courseMap: CourseMap }`), `createCourseMapLoader(deps)` returning a loader function that reads `params.courseId`. `CourseMapPage` default export. Used by Task 7's router.

- [ ] **Step 1: Write the failing tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import CourseMapPage from './CourseMapPage'
import type { CourseMap } from '../../application/get-course'
import type { Course } from '../../domain/models/course'
import type { Unit } from '../../domain/models/unit'
import type { Lesson } from '../../domain/models/lesson'

function makeCourse(): Course {
  return {
    id: 'c1',
    title: 'Hangul Basics',
    description: 'desc',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeUnit(id: string, order: number): Unit {
  return {
    id,
    courseId: 'c1',
    title: `Unit ${id}`,
    description: '',
    order,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeLesson(id: string, unitId: string): Lesson {
  return {
    id,
    unitId,
    title: `Lesson ${id}`,
    type: 'word',
    order: 1,
    exercises: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function renderPage(courseMap: CourseMap) {
  const router = createMemoryRouter(
    [{ path: '/', Component: CourseMapPage, loader: async () => ({ courseMap }) }],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('CourseMapPage', () => {
  it('shows a Locked badge but keeps the lesson link clickable when there is no progress yet', async () => {
    const courseMap: CourseMap = {
      course: makeCourse(),
      units: [
        {
          unit: makeUnit('u1', 1),
          lessons: [{ lesson: makeLesson('l1', 'u1'), progress: null }],
        },
      ],
    }
    renderPage(courseMap)

    fireEvent.click(await screen.findByRole('button', { name: /Unit u1/i }))

    const link = await screen.findByRole('link', { name: /Lesson l1/i })
    expect(link).toHaveAttribute('href', '/lessons/l1')
    expect(screen.getByText('Locked')).toBeInTheDocument()
  })

  it('renders a unit with no lessons without crashing', async () => {
    const courseMap: CourseMap = {
      course: makeCourse(),
      units: [{ unit: makeUnit('u1', 1), lessons: [] }],
    }
    renderPage(courseMap)

    fireEvent.click(await screen.findByRole('button', { name: /Unit u1/i }))

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/course/CourseMapPage.test.tsx`
Expected: FAIL — `src/features/course/CourseMapPage.tsx` does not exist yet.

- [ ] **Step 3: Implement the loader**

`src/features/course/CourseMapPage.loader.ts`:

```ts
import type { LoaderFunctionArgs } from 'react-router'
import { getCourseMap, type CourseMap } from '../../application/get-course'
import type { CourseRepository } from '../../domain/repositories/course-repository'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { ProgressRepository } from '../../domain/repositories/progress-repository'
import { signInAnonymouslyIfNeeded } from '../../infrastructure/firebase/firebase'

export interface CourseMapLoaderData {
  courseMap: CourseMap
}

export function createCourseMapLoader(deps: {
  courseRepo: CourseRepository
  lessonRepo: LessonRepository
  progressRepo: ProgressRepository
}) {
  return async ({ params }: LoaderFunctionArgs): Promise<CourseMapLoaderData> => {
    const courseId = params.courseId
    if (!courseId) {
      throw new Error('Course id is required')
    }
    const user = await signInAnonymouslyIfNeeded()
    const courseMap = await getCourseMap(deps, user.uid, courseId)
    return { courseMap }
  }
}
```

- [ ] **Step 4: Implement the page**

`src/features/course/CourseMapPage.tsx`:

```tsx
import { useState } from 'react'
import { Link, useLoaderData } from 'react-router'
import type { CourseMapLoaderData } from './CourseMapPage.loader'
import type { CourseMapUnit } from '../../application/get-course'
import type { LessonProgressStatus } from '../../domain/models/progress'

function statusLabel(status: LessonProgressStatus | undefined): string {
  if (status === 'completed') return 'Completed'
  if (status === 'unlocked') return 'Unlocked'
  return 'Locked'
}

function UnitSection({ mapUnit }: { mapUnit: CourseMapUnit }) {
  const [open, setOpen] = useState(false)

  return (
    <li className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <div className="font-medium text-slate-900">{mapUnit.unit.title}</div>
          <div className="text-sm text-slate-600">{mapUnit.unit.description}</div>
        </div>
        <span className="text-sm text-slate-500">
          {open ? 'Hide lessons' : 'Show lessons'}
        </span>
      </button>

      {open && (
        <ul className="space-y-2 border-t border-slate-100 p-4">
          {mapUnit.lessons.map(({ lesson, progress }) => (
            <li key={lesson.id}>
              <Link
                to={`/lessons/${lesson.id}`}
                className="flex items-center justify-between rounded-md p-2 hover:bg-slate-50"
              >
                <span>{lesson.title}</span>
                <span className="text-xs text-slate-500">
                  {statusLabel(progress?.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function CourseMapPage() {
  const { courseMap } = useLoaderData() as CourseMapLoaderData

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">{courseMap.course.title}</h1>
      <p className="mt-1 text-slate-600">{courseMap.course.description}</p>

      <ul className="mt-6 space-y-3">
        {courseMap.units.map((mapUnit) => (
          <UnitSection key={mapUnit.unit.id} mapUnit={mapUnit} />
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/course/CourseMapPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/features/course/CourseMapPage.loader.ts src/features/course/CourseMapPage.tsx src/features/course/CourseMapPage.test.tsx
git commit -m "feat(course): add course map page with expandable unit sections"
```

---

### Task 6: `LessonDetailPage` (`/lessons/:lessonId`)

**Files:**
- Create: `src/features/lesson/LessonDetailPage.loader.ts`
- Create: `src/features/lesson/LessonDetailPage.tsx`

**Interfaces:**
- Consumes: `getLesson` (`src/application/get-lesson.ts`), `LessonRepository` (`src/domain/repositories/lesson-repository.ts`), `Lesson` (`src/domain/models/lesson.ts`).
- Produces: `LessonDetailLoaderData` (`{ lesson: Lesson }`), `createLessonDetailLoader(deps: { lessonRepo: LessonRepository })`. `LessonDetailPage` default export. Used by Task 7's router.

No dedicated test file for this task — `getLesson` (which the loader wraps) is already unit-tested in `src/application/get-lesson.test.ts`, and the page's `.map()`-over-`exercises` rendering follows the exact same empty-array-safe pattern already proven by Task 5's "unit with no lessons" test. This page is exercised in Task 7's manual browser verification.

- [ ] **Step 1: Implement the loader**

`src/features/lesson/LessonDetailPage.loader.ts`:

```ts
import type { LoaderFunctionArgs } from 'react-router'
import { getLesson } from '../../application/get-lesson'
import type { LessonRepository } from '../../domain/repositories/lesson-repository'
import type { Lesson } from '../../domain/models/lesson'

export interface LessonDetailLoaderData {
  lesson: Lesson
}

export function createLessonDetailLoader(deps: { lessonRepo: LessonRepository }) {
  return async ({ params }: LoaderFunctionArgs): Promise<LessonDetailLoaderData> => {
    const lessonId = params.lessonId
    if (!lessonId) {
      throw new Error('Lesson id is required')
    }
    const lesson = await getLesson(deps.lessonRepo, lessonId)
    if (!lesson) {
      throw new Error(`Lesson not found: ${lessonId}`)
    }
    return { lesson }
  }
}
```

- [ ] **Step 2: Implement the page**

`src/features/lesson/LessonDetailPage.tsx`:

```tsx
import { useLoaderData } from 'react-router'
import type { LessonDetailLoaderData } from './LessonDetailPage.loader'

export default function LessonDetailPage() {
  const { lesson } = useLoaderData() as LessonDetailLoaderData

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">{lesson.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{lesson.type}</p>

      <ul className="mt-6 space-y-4">
        {lesson.exercises.map((exercise) => (
          <li key={exercise.id} className="rounded-lg border border-slate-200 p-4">
            <div className="text-xl text-slate-900">{exercise.targetText}</div>
            {exercise.romanization && (
              <div className="text-sm text-slate-500">{exercise.romanization}</div>
            )}
            <div className="mt-2 text-sm text-slate-700">
              {exercise.meaningTh} / {exercise.meaningEn}
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/lesson/LessonDetailPage.loader.ts src/features/lesson/LessonDetailPage.tsx
git commit -m "feat(lesson): add read-only lesson detail page"
```

---

### Task 7: Wire the router, replace the placeholder app, verify end-to-end

**Files:**
- Create: `src/app/NotFoundPage.tsx`
- Test: `src/app/NotFoundPage.test.tsx`
- Create: `src/app/router.ts`
- Modify: `src/main.tsx`
- Delete: `src/App.tsx`
- Delete: `src/App.css`
- Delete: `src/App.test.tsx`

**Interfaces:**
- Consumes: everything produced by Tasks 1–6 (`getCourses`/`getCourseMap`/`getLesson`, the 3 page components + their loader factories, `RouteError`, the singleton repos from `src/infrastructure/firebase/repositories/index.ts`).
- Produces: `router` (`src/app/router.ts`, a configured `Router` instance), rendered by `src/main.tsx`. Nothing later depends on this — it's the integration point.

- [ ] **Step 1: Write the failing test for the wildcard route**

`src/app/NotFoundPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import NotFoundPage from './NotFoundPage'

describe('NotFoundPage via a wildcard route', () => {
  it('renders when no route matches the URL', async () => {
    const router = createMemoryRouter(
      [
        { path: '/', Component: () => null },
        { path: '*', Component: NotFoundPage },
      ],
      { initialEntries: ['/this-does-not-exist'] },
    )

    render(<RouterProvider router={router} />)

    expect(await screen.findByText(/Page not found/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/app/NotFoundPage.test.tsx`
Expected: FAIL — `src/app/NotFoundPage.tsx` does not exist yet.

- [ ] **Step 3: Implement `NotFoundPage`**

`src/app/NotFoundPage.tsx`:

```tsx
export default function NotFoundPage() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-medium text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">
        The page you're looking for doesn't exist.
      </p>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/app/NotFoundPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the router**

`src/app/router.ts`:

```ts
import { createBrowserRouter } from 'react-router'
import {
  courseRepo,
  lessonRepo,
  progressRepo,
} from '../infrastructure/firebase/repositories'
import CourseListPage from '../features/course/CourseListPage'
import { createCourseListLoader } from '../features/course/CourseListPage.loader'
import CourseMapPage from '../features/course/CourseMapPage'
import { createCourseMapLoader } from '../features/course/CourseMapPage.loader'
import LessonDetailPage from '../features/lesson/LessonDetailPage'
import { createLessonDetailLoader } from '../features/lesson/LessonDetailPage.loader'
import RouteError from './RouteError'
import NotFoundPage from './NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: CourseListPage,
    loader: createCourseListLoader({ courseRepo }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/courses/:courseId',
    Component: CourseMapPage,
    loader: createCourseMapLoader({ courseRepo, lessonRepo, progressRepo }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/lessons/:lessonId',
    Component: LessonDetailPage,
    loader: createLessonDetailLoader({ lessonRepo }),
    ErrorBoundary: RouteError,
  },
  {
    path: '*',
    Component: NotFoundPage,
  },
])
```

- [ ] **Step 6: Replace the placeholder app**

Modify `src/main.tsx` to:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import './index.css'
import { router } from './app/router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
```

Delete `src/App.tsx`, `src/App.css`, and `src/App.test.tsx` — the placeholder they defined ("Jamozy" centered on a blank page) is fully replaced by the router now.

- [ ] **Step 7: Run the full test suite**

Run: `pnpm exec vitest run`
Expected: PASS, no `App.test.tsx` failures (it's deleted), all other suites green.

- [ ] **Step 8: Typecheck, lint, build**

Run: `pnpm exec tsc -b && pnpm lint && pnpm build`
Expected: no errors; `dist/` builds successfully.

- [ ] **Step 9: Manual browser verification**

Run: `pnpm dev`, then in a browser (or via the `claude-in-chrome` tool if running this as an agent):

1. Visit `/` — expect the "Hangul Basics" course card linking to `/courses/hangul-basics`.
2. Visit `/courses/hangul-basics` — expect 2 unit sections ("คำทักทายพื้นฐาน", "คำศัพท์ทั่วไป"); click one to expand it and see its lesson(s) with a "Locked" badge (no progress exists yet for a fresh anonymous user — expected, see Review Focus item 4); click a lesson link.
3. Confirm it lands on `/lessons/greetings-1` (or `/lessons/common-words-1`) showing the 3 seeded exercises (Korean text, romanization, Thai/English meaning).
4. Visit a nonsense path (e.g. `/does-not-exist`) — expect the "Page not found" message, not a blank screen.
5. Check the browser console for errors (`read_console_messages` if using the browser tool).

Fix any issues found before proceeding — this step is what actually proves the spec's goal ("proves the full stack end-to-end").

- [ ] **Step 10: Commit**

```bash
git add src/app/NotFoundPage.tsx src/app/NotFoundPage.test.tsx src/app/router.ts src/main.tsx
git rm src/App.tsx src/App.css src/App.test.tsx
git commit -m "feat(app): wire course/lesson router, replace placeholder app"
```
