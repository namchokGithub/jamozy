# Profile Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only `/profile` page showing the learner's level, EXP progress, and all `UserStats` fields, linked from `CourseListPage`.

**Architecture:** Mirrors the existing `get-settings.ts` → `SettingsPage.loader.ts` → `SettingsPage.tsx` shape: a dedicated read-only application-layer use case (falling back to `defaultUserProfile` for a new user, never writing), a loader that signs the user in and calls it, and a presentational page component. No new domain fields — `UserProfile.exp` and `UserStats` already carry everything this page needs.

**Tech Stack:** React 19, TypeScript 5, React Router 8 (loader only, no action), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-24-profile-dashboard-design.md`

## Global Constraints

- No new domain fields — reuse `UserProfile.exp` and `UserStats` exactly as they exist today in `src/domain/models/user-profile.ts`.
- `getProfileSummary` must be a pure read: never calls `userProfileRepo.saveUserProfile`, exactly like `getSettings`.
- `/profile` is a loader-only route — no `action`, since nothing is written from this page.
- Level thresholds are flat 100 EXP per level — reuse the existing `levelFromExp(exp)`, do not reimplement the threshold.
- `averageAccuracy`/`bestAccuracy` are already on a 0–100 scale (see DEC-018) — display with a `%` suffix, never re-scale or divide.
- `formatTypingTime` is a pure function in its own file (`features/profile/format-typing-time.ts`), never exported from `ProfilePage.tsx` — exporting a non-component function from a component file breaks Vite Fast Refresh (`react-refresh/only-export-components`), as hit in the previous round.

## Review Focus

- A brand-new user (no profile document yet): every stat renders as a real zero-state (`0`, `0%`, `0 WPM`, `"0 min"`), never `NaN`/`undefined`/blank — pinned in Task 4's zero-state test.
- `exp` not an exact multiple of 100 (e.g. `250`) renders a correct partial EXP bar (`level 3`, `50 / 100 EXP`), not just round-number cases — pinned in Task 1 and Task 4's tests.
- `totalTypingTimeSeconds` at an exact multiple of 3600 renders `"Xh"` with no spurious trailing `"0m"` — pinned in Task 2's test.
- Accuracy fields are rendered as their stored 0–100 value with a `%` suffix, never re-scaled (e.g. `91.5` → `"91.5%"`, not `"9150%"` or `"0.915%"`) — pinned in Task 1 (values pass through the use case unchanged) and Task 4 (rendered exactly as given).
- Adding the Profile link to `CourseListPage` doesn't break any of its existing tests (which query links by role/name) — pinned by running the full `CourseListPage.test.tsx` suite in Task 5, alongside a new assertion for the Profile link itself.

---

### Task 1: `getProfileSummary` use case

**Files:**

- Create: `src/application/get-profile-summary.ts`
- Test: `src/application/get-profile-summary.test.ts`

**Interfaces:**

- Consumes: `UserProfileRepository` (`src/domain/repositories/user-profile-repository.ts`, unchanged — `getUserProfile(userId): Promise<UserProfile | null>`, `saveUserProfile(userId, profile): Promise<void>`); `defaultUserProfile(userId, now)` and `levelFromExp(exp)` from `src/domain/models/user-profile.ts` (both unchanged, already exported); `FakeUserProfileRepository` from `src/test/fakes.ts` (unchanged).
- Produces: `ProfileSummary` interface (`{ exp: number; level: number; stats: UserStats }`) and `getProfileSummary(userProfileRepo: UserProfileRepository, userId: string, now: Date = new Date()): Promise<ProfileSummary>`, both exported from `src/application/get-profile-summary.ts`. Task 3 imports both.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/application/get-profile-summary.test.ts
import { describe, expect, it, vi } from 'vitest'
import { getProfileSummary } from './get-profile-summary'
import { FakeUserProfileRepository } from '../test/fakes'
import {
  defaultUserProfile,
  type UserProfile,
  type UserStats,
} from '../domain/models/user-profile'

const sampleStats: UserStats = {
  lessonsCompleted: 12,
  wordsPracticed: 84,
  averageAccuracy: 91.5,
  bestAccuracy: 100,
  averageSpeedWpm: 22,
  totalTypingTimeSeconds: 3600,
}

describe('getProfileSummary', () => {
  it('returns zeroed exp/level/stats for a user with no profile yet', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const now = new Date('2026-01-01')

    const summary = await getProfileSummary(userProfileRepo, 'user1', now)

    expect(summary).toEqual({
      exp: 0,
      level: 1,
      stats: defaultUserProfile('user1', now).stats,
    })
  })

  it("returns an existing profile's exp/stats unchanged, with level derived", async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const profile: UserProfile = {
      ...defaultUserProfile('user1', new Date('2025-01-01')),
      exp: 250,
      stats: sampleStats,
    }
    await userProfileRepo.saveUserProfile('user1', profile)

    const summary = await getProfileSummary(userProfileRepo, 'user1')

    expect(summary).toEqual({ exp: 250, level: 3, stats: sampleStats })
  })

  it('derives level 1 at exp 99 and level 2 at exp 100 (the 100-EXP-per-level boundary)', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    await userProfileRepo.saveUserProfile('below', {
      ...defaultUserProfile('below', new Date('2025-01-01')),
      exp: 99,
    })
    await userProfileRepo.saveUserProfile('at', {
      ...defaultUserProfile('at', new Date('2025-01-01')),
      exp: 100,
    })

    const below = await getProfileSummary(userProfileRepo, 'below')
    const at = await getProfileSummary(userProfileRepo, 'at')

    expect(below.level).toBe(1)
    expect(at.level).toBe(2)
  })

  it('never writes anything (a GET must stay a pure read)', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const saveSpy = vi.spyOn(userProfileRepo, 'saveUserProfile')

    await getProfileSummary(userProfileRepo, 'user1')

    expect(saveSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/application/get-profile-summary.test.ts`
Expected: FAIL — `Cannot find module './get-profile-summary'` (the file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/application/get-profile-summary.ts
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import {
  defaultUserProfile,
  levelFromExp,
  type UserStats,
} from '../domain/models/user-profile'

export interface ProfileSummary {
  exp: number
  level: number
  stats: UserStats
}

export async function getProfileSummary(
  userProfileRepo: UserProfileRepository,
  userId: string,
  now: Date = new Date(),
): Promise<ProfileSummary> {
  const profile = await userProfileRepo.getUserProfile(userId)
  const resolved = profile ?? defaultUserProfile(userId, now)
  return {
    exp: resolved.exp,
    level: levelFromExp(resolved.exp),
    stats: resolved.stats,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/application/get-profile-summary.test.ts`
Expected: PASS, 4/4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/application/get-profile-summary.ts src/application/get-profile-summary.test.ts
git commit -m "feat(profile): add getProfileSummary use case"
```

---

### Task 2: `formatTypingTime` pure formatter

**Files:**

- Create: `src/features/profile/format-typing-time.ts`
- Test: `src/features/profile/format-typing-time.test.ts`

**Interfaces:**

- Consumes: nothing (pure function, no dependencies).
- Produces: `formatTypingTime(totalSeconds: number): string`, exported from `src/features/profile/format-typing-time.ts`. Task 4 imports it.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/features/profile/format-typing-time.test.ts
import { describe, expect, it } from 'vitest'
import { formatTypingTime } from './format-typing-time'

describe('formatTypingTime', () => {
  it('formats 0 seconds as "0 min"', () => {
    expect(formatTypingTime(0)).toBe('0 min')
  })

  it('formats under a minute as "0 min"', () => {
    expect(formatTypingTime(45)).toBe('0 min')
  })

  it('formats whole minutes under an hour', () => {
    expect(formatTypingTime(125)).toBe('2 min')
  })

  it('formats hours and minutes', () => {
    expect(formatTypingTime(3665)).toBe('1h 1m')
  })

  it('omits a trailing "0m" on an exact hour', () => {
    expect(formatTypingTime(7200)).toBe('2h')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/profile/format-typing-time.test.ts`
Expected: FAIL — `Cannot find module './format-typing-time'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/profile/format-typing-time.ts
export function formatTypingTime(totalSeconds: number): string {
  const totalMinutes = Math.floor(totalSeconds / 60)
  if (totalMinutes < 60) {
    return `${totalMinutes} min`
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/profile/format-typing-time.test.ts`
Expected: PASS, 5/5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/format-typing-time.ts src/features/profile/format-typing-time.test.ts
git commit -m "feat(profile): add formatTypingTime pure formatter"
```

---

### Task 3: `ProfilePage.loader.ts`

**Files:**

- Create: `src/features/profile/ProfilePage.loader.ts`
- Test: `src/features/profile/ProfilePage.loader.test.ts`

**Interfaces:**

- Consumes: `getProfileSummary` and `ProfileSummary` from Task 1 (`src/application/get-profile-summary.ts`); `UserProfileRepository` (unchanged); `FakeUserProfileRepository`/`defaultUserProfile` (unchanged, as in Task 1).
- Produces: `ProfileLoaderData` interface (`{ summary: ProfileSummary }`) and `createProfileLoader(deps: { userProfileRepo: UserProfileRepository; ensureUser: () => Promise<{ uid: string }> })` returning a React Router loader function, both exported from `src/features/profile/ProfilePage.loader.ts`. Task 4 and Task 5 (router wiring) import both.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/features/profile/ProfilePage.loader.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createProfileLoader } from './ProfilePage.loader'
import { FakeUserProfileRepository } from '../../test/fakes'
import { defaultUserProfile } from '../../domain/models/user-profile'

describe('createProfileLoader', () => {
  it('signs in, then returns zeroed exp/level/stats for a brand-new user', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const userProfileRepo = new FakeUserProfileRepository()
    const loader = createProfileLoader({ userProfileRepo, ensureUser })

    const data = await loader()

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.summary.exp).toBe(0)
    expect(data.summary.level).toBe(1)
    expect(data.summary.stats.lessonsCompleted).toBe(0)
  })

  it("returns an existing user's real exp/stats", async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const profile = defaultUserProfile('user1', new Date('2025-01-01'))
    await userProfileRepo.saveUserProfile('user1', {
      ...profile,
      exp: 150,
      stats: { ...profile.stats, lessonsCompleted: 5 },
    })
    const loader = createProfileLoader({
      userProfileRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })

    const data = await loader()

    expect(data.summary.exp).toBe(150)
    expect(data.summary.level).toBe(2)
    expect(data.summary.stats.lessonsCompleted).toBe(5)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/profile/ProfilePage.loader.test.ts`
Expected: FAIL — `Cannot find module './ProfilePage.loader'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/features/profile/ProfilePage.loader.ts
import {
  getProfileSummary,
  type ProfileSummary,
} from '../../application/get-profile-summary'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'

export interface ProfileLoaderData {
  summary: ProfileSummary
}

export function createProfileLoader(deps: {
  userProfileRepo: UserProfileRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<ProfileLoaderData> => {
    const user = await deps.ensureUser()
    const summary = await getProfileSummary(deps.userProfileRepo, user.uid)
    return { summary }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/profile/ProfilePage.loader.test.ts`
Expected: PASS, 2/2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/ProfilePage.loader.ts src/features/profile/ProfilePage.loader.test.ts
git commit -m "feat(profile): add ProfilePage loader"
```

---

### Task 4: `ProfilePage.tsx`

**Files:**

- Create: `src/features/profile/ProfilePage.tsx`
- Test: `src/features/profile/ProfilePage.test.tsx`

**Interfaces:**

- Consumes: `ProfileLoaderData` from Task 3 (`./ProfilePage.loader`); `formatTypingTime` from Task 2 (`./format-typing-time`); `ProfileSummary` from Task 1 (`../../application/get-profile-summary`, used only in the test file to build fixtures).
- Produces: default-exported `ProfilePage` React component from `src/features/profile/ProfilePage.tsx`. Task 5 imports it for router wiring.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/features/profile/ProfilePage.test.tsx
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import ProfilePage from './ProfilePage'
import type { ProfileSummary } from '../../application/get-profile-summary'

function makeSummary(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
  return {
    exp: 250,
    level: 3,
    stats: {
      lessonsCompleted: 12,
      wordsPracticed: 84,
      averageAccuracy: 91.5,
      bestAccuracy: 100,
      averageSpeedWpm: 22,
      totalTypingTimeSeconds: 3665,
    },
    ...overrides,
  }
}

function renderPage(summary: ProfileSummary) {
  const router = createMemoryRouter(
    [{ path: '/', Component: ProfilePage, loader: async () => ({ summary }) }],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('ProfilePage', () => {
  it('renders level, partial EXP progress, and all six stats', async () => {
    renderPage(makeSummary())

    expect(await screen.findByText('Level 3')).toBeInTheDocument()
    expect(screen.getByText('50 / 100 EXP')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('84')).toBeInTheDocument()
    expect(screen.getByText('91.5%')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('22 WPM')).toBeInTheDocument()
    expect(screen.getByText('1h 1m')).toBeInTheDocument()
  })

  it('renders zeroed stats for a brand-new user without NaN or blank values', async () => {
    renderPage(
      makeSummary({
        exp: 0,
        level: 1,
        stats: {
          lessonsCompleted: 0,
          wordsPracticed: 0,
          averageAccuracy: 0,
          bestAccuracy: 0,
          averageSpeedWpm: 0,
          totalTypingTimeSeconds: 0,
        },
      }),
    )

    expect(await screen.findByText('Level 1')).toBeInTheDocument()
    expect(screen.getByText('0 / 100 EXP')).toBeInTheDocument()
    expect(screen.getAllByText('0%')).toHaveLength(2)
    expect(screen.getByText('0 WPM')).toBeInTheDocument()
    expect(screen.getByText('0 min')).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/profile/ProfilePage.test.tsx`
Expected: FAIL — `Cannot find module './ProfilePage'`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/profile/ProfilePage.tsx
import { useLoaderData } from 'react-router'
import type { ProfileLoaderData } from './ProfilePage.loader'
import { formatTypingTime } from './format-typing-time'

export default function ProfilePage() {
  const { summary } = useLoaderData() as ProfileLoaderData
  const expIntoLevel = summary.exp % 100

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">
        Level {summary.level}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{expIntoLevel} / 100 EXP</p>

      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-slate-500">Lessons completed</dt>
          <dd className="text-xl text-slate-900">
            {summary.stats.lessonsCompleted}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Words practiced</dt>
          <dd className="text-xl text-slate-900">
            {summary.stats.wordsPracticed}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Average accuracy</dt>
          <dd className="text-xl text-slate-900">
            {summary.stats.averageAccuracy}%
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Best accuracy</dt>
          <dd className="text-xl text-slate-900">
            {summary.stats.bestAccuracy}%
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Average speed</dt>
          <dd className="text-xl text-slate-900">
            {summary.stats.averageSpeedWpm} WPM
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Total typing time</dt>
          <dd className="text-xl text-slate-900">
            {formatTypingTime(summary.stats.totalTypingTimeSeconds)}
          </dd>
        </div>
      </dl>
    </main>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/profile/ProfilePage.test.tsx`
Expected: PASS, 2/2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/ProfilePage.tsx src/features/profile/ProfilePage.test.tsx
git commit -m "feat(profile): add ProfilePage component"
```

---

### Task 5: Router wiring, CourseListPage link, manual verification

**Files:**

- Modify: `src/app/router.ts`
- Modify: `src/features/course/CourseListPage.tsx`
- Modify: `src/features/course/CourseListPage.test.tsx`

**Interfaces:**

- Consumes: default-exported `ProfilePage` and `createProfileLoader` from Task 4/Task 3; `userProfileRepo` and `signInAnonymouslyIfNeeded` (both already imported in `router.ts` today, unchanged); `RouteError` (unchanged).
- Produces: nothing new for later tasks — this is the last task.

- [ ] **Step 1: Write the failing test**

Add this test to the existing `describe('CourseListPage', ...)` block in `src/features/course/CourseListPage.test.tsx` (the file already has 4 tests — see `always shows a Settings link` for the exact pattern being mirrored):

```typescript
  it('always shows a Profile link', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => ({ courses: [], dueReviewCount: 0 }),
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    const link = await screen.findByRole('link', { name: 'Profile' })
    expect(link).toHaveAttribute('href', '/profile')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/course/CourseListPage.test.tsx`
Expected: FAIL — no element with role `link` and name `Profile` found.

- [ ] **Step 3: Add the Profile link to `CourseListPage.tsx`**

In `src/features/course/CourseListPage.tsx`, change the header `<div>` that currently holds only the Settings link:

```tsx
<div className="flex items-center justify-between">
  <h1 className="text-2xl font-medium text-slate-900">Jamozy</h1>
  <div className="flex items-center gap-4">
    <Link to="/profile" className="text-sm text-slate-600 underline">
      Profile
    </Link>
    <Link to="/settings" className="text-sm text-slate-600 underline">
      Settings
    </Link>
  </div>
</div>
```

(This replaces the existing `<div className="flex items-center justify-between">...<Link to="/settings" ...>Settings</Link></div>` block — the outer flex/justify-between stays on the `h1`-plus-links row, the two links now share an inner flex row.)

- [ ] **Step 4: Wire the `/profile` route in `router.ts`**

Add the import alongside the other feature imports in `src/app/router.ts`:

```typescript
import ProfilePage from '../features/profile/ProfilePage'
import { createProfileLoader } from '../features/profile/ProfilePage.loader'
```

Add the route object to the `createBrowserRouter([...])` array, after the `/settings` route:

```typescript
  {
    path: '/profile',
    Component: ProfilePage,
    loader: createProfileLoader({
      userProfileRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/course/CourseListPage.test.tsx`
Expected: PASS, 5/5 tests (the 4 pre-existing tests plus the new Profile-link test).

Then run the whole suite to confirm nothing else broke:

Run: `pnpm exec vitest run && pnpm exec tsc -b && pnpm lint`
Expected: all tests pass (187, up from 173 — 4 in Task 1, 5 in Task 2, 2 in Task 3, 2 in Task 4, 1 in Task 5), `tsc -b` clean, `eslint .` clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/router.ts src/features/course/CourseListPage.tsx src/features/course/CourseListPage.test.tsx
git commit -m "feat(profile): wire /profile route and add nav link"
```

- [ ] **Step 7: Manual browser verification**

Start `pnpm dev`, sign in anonymously (automatic on first load), navigate to `/profile`:

- A brand-new anonymous user should show `Level 1`, `0 / 100 EXP`, and all six stats as zero/`"0 min"` — confirm no `NaN`/blank text renders.
- Complete a lesson (via `/lessons/:lessonId`, "Start Lesson") to generate real `exp`/stats, revisit `/profile`, and confirm the numbers reflect the completed lesson (EXP increased, `lessonsCompleted` incremented, accuracy/speed populated).
- Confirm the "Profile" link on `/` (`CourseListPage`) navigates to `/profile`, and the pre-existing "Settings" link still works.
- Check the browser console for errors during all of the above.
- Stop the dev server when done.

**Completion contract for this task:** all of the above manually verified with no console errors, in addition to the automated test/tsc/lint run in Step 5.
