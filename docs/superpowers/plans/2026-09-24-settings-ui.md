# Settings UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/settings` route that reads and writes `UserProfile.settings` (`UserSettings`) — a correctly-persisting form only, with no other screen yet consuming any of the 7 values.

**Architecture:** Two new small application-layer use cases (`get-settings.ts`, `update-settings.ts`) sit on top of the already-existing `UserProfileRepository`. A shared `defaultUserProfile` factory (extracted from `complete-lesson.ts`, where it was private) gives both the new use cases and the existing lesson-completion path one single source of truth for a brand-new user's defaults. The route follows the same loader/action/`useFetcher` pattern already established for the lesson and review flows.

**Tech Stack:** React 19, TypeScript 5, React Router 8 (actions + `useFetcher`), Zod 4, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-09-24-settings-ui-design.md`

## Global Constraints

- `getSettings`/`updateSettings` operate on `UserSettings` only — never the whole `UserProfile`. The loader returns `{ settings: UserSettings }`; the action's Zod schema validates exactly a `UserSettings` shape.
- `defaultUserProfile(userId, now)` moves from a private helper in `complete-lesson.ts` to an exported function in `domain/models/user-profile.ts`. `complete-lesson.ts` imports it instead of defining its own copy. `complete-lesson.test.ts` must pass unmodified — same values, different import path, no behavior change.
- `update-settings.ts` is a read-modify-write: an existing profile only has `.settings` replaced (`exp`/`stats`/`createdAt` untouched); a user with no profile yet gets one created from `defaultUserProfile` with the submitted settings substituted in. `GET /settings` never writes anything.
- Save button UX: disabled while `fetcher.state === 'submitting'`; shows a "Saved" indicator once the fetcher returns to `idle` with data; the indicator clears immediately if the learner edits any field after a successful save.
- No persistent nav bar — entry point is an always-visible "Settings" link on `CourseListPage` (not conditional, unlike Review's due-count badge).
- No wiring of any setting into any other screen's behavior this round — deliberately out of scope per the spec.

## Review Focus

1. **`update-settings.ts` must never clobber `exp`/`stats`/`createdAt` on an existing profile** — saving settings after earning EXP must not reset it.
2. **A brand-new user (no `UserProfile` doc yet) must see sensible default settings on `/settings` without any write happening on page load**, and their first Save must be the point a profile document actually gets created.
3. **`complete-lesson.ts`'s behavior must be provably unchanged after the `defaultUserProfile` extraction** — its existing test suite, run unmodified, is the regression gate.
4. **`keyboardOpacity` must be validated within `[0, 1]`** — an out-of-range or non-numeric value in the submitted body must be rejected by Zod before it reaches Firestore.
5. **The Save button's disabled/"Saved" states must not get stuck** — a fast double-click must not double-submit visibly, and the "Saved" indicator must clear as soon as the learner edits a field again without saving.

---

### Task 1: `domain/models/user-profile.ts` — export `defaultUserProfile` + `userSettingsSchema`; refactor `complete-lesson.ts`

**Files:**
- Modify: `src/domain/models/user-profile.ts`
- Modify: `src/domain/models/user-profile.test.ts`
- Modify: `src/application/complete-lesson.ts`
- Test (regression check, run but not edited): `src/application/complete-lesson.test.ts`

**Interfaces:**
- Produces: `defaultUserProfile(userId: string, now: Date): UserProfile`, `userSettingsSchema` (Zod, validates `UserSettings`). Consumed by Task 2 (`get-settings.ts`), Task 3 (`update-settings.ts`), Task 5 (`SettingsPage.action.ts`), and this task's own refactor of `complete-lesson.ts`.

- [ ] **Step 1: Write the failing tests**

Add these to `src/domain/models/user-profile.test.ts` (its existing `levelFromExp` tests and import stay, just add the `defaultUserProfile`/`userSettingsSchema` import and new `describe` blocks):

```ts
import { describe, expect, it } from 'vitest'
import { defaultUserProfile, levelFromExp, userSettingsSchema } from './user-profile'

describe('levelFromExp', () => {
  it('starts at level 1 with no exp', () => {
    expect(levelFromExp(0)).toBe(1)
  })

  it('levels up every 100 exp', () => {
    expect(levelFromExp(99)).toBe(1)
    expect(levelFromExp(100)).toBe(2)
    expect(levelFromExp(250)).toBe(3)
  })
})

describe('defaultUserProfile', () => {
  it('returns a zeroed profile with the default settings', () => {
    const now = new Date('2026-01-01')
    const profile = defaultUserProfile('user1', now)

    expect(profile).toEqual({
      id: 'user1',
      exp: 0,
      settings: {
        soundEnabled: true,
        showKeyboard: true,
        showEnglishKeys: true,
        keyboardOpacity: 1,
        romanizationEnabled: true,
        meaningLanguage: 'both',
        theme: 'light',
      },
      stats: {
        lessonsCompleted: 0,
        wordsPracticed: 0,
        averageAccuracy: 0,
        bestAccuracy: 0,
        averageSpeedWpm: 0,
        totalTypingTimeSeconds: 0,
      },
      createdAt: now,
    })
  })
})

function makeValidSettings() {
  return {
    soundEnabled: true,
    showKeyboard: true,
    showEnglishKeys: true,
    keyboardOpacity: 0.5,
    romanizationEnabled: true,
    meaningLanguage: 'both' as const,
    theme: 'light' as const,
  }
}

describe('userSettingsSchema', () => {
  it('accepts a valid settings object', () => {
    expect(() => userSettingsSchema.parse(makeValidSettings())).not.toThrow()
  })

  it('rejects an out-of-range keyboardOpacity', () => {
    expect(() =>
      userSettingsSchema.parse({ ...makeValidSettings(), keyboardOpacity: 1.5 }),
    ).toThrow()
  })

  it('rejects an invalid meaningLanguage value', () => {
    expect(() =>
      userSettingsSchema.parse({ ...makeValidSettings(), meaningLanguage: 'invalid' }),
    ).toThrow()
  })

  it('rejects an invalid theme value', () => {
    expect(() => userSettingsSchema.parse({ ...makeValidSettings(), theme: 'blue' })).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/domain/models/user-profile.test.ts`
Expected: FAIL — `defaultUserProfile` and `userSettingsSchema` are not exported from `./user-profile` yet.

- [ ] **Step 3: Implement**

Replace `src/domain/models/user-profile.ts` in full:

```ts
import { z } from 'zod'

export interface UserSettings {
  soundEnabled: boolean
  showKeyboard: boolean
  showEnglishKeys: boolean
  keyboardOpacity: number
  romanizationEnabled: boolean
  meaningLanguage: 'th' | 'en' | 'both'
  theme: 'light' | 'dark'
}

export interface UserStats {
  lessonsCompleted: number
  wordsPracticed: number
  averageAccuracy: number
  bestAccuracy: number
  averageSpeedWpm: number
  totalTypingTimeSeconds: number
}

export interface UserProfile {
  id: string
  exp: number
  settings: UserSettings
  stats: UserStats
  createdAt: Date
}

export function levelFromExp(exp: number): number {
  return 1 + Math.floor(exp / 100)
}

export function defaultUserProfile(userId: string, now: Date): UserProfile {
  return {
    id: userId,
    exp: 0,
    settings: {
      soundEnabled: true,
      showKeyboard: true,
      showEnglishKeys: true,
      keyboardOpacity: 1,
      romanizationEnabled: true,
      meaningLanguage: 'both',
      theme: 'light',
    },
    stats: {
      lessonsCompleted: 0,
      wordsPracticed: 0,
      averageAccuracy: 0,
      bestAccuracy: 0,
      averageSpeedWpm: 0,
      totalTypingTimeSeconds: 0,
    },
    createdAt: now,
  }
}

export const userSettingsSchema = z.object({
  soundEnabled: z.boolean(),
  showKeyboard: z.boolean(),
  showEnglishKeys: z.boolean(),
  keyboardOpacity: z.number().min(0).max(1),
  romanizationEnabled: z.boolean(),
  meaningLanguage: z.enum(['th', 'en', 'both']),
  theme: z.enum(['light', 'dark']),
})
```

- [ ] **Step 4: Refactor `complete-lesson.ts` to use the shared `defaultUserProfile`**

In `src/application/complete-lesson.ts`:

1. Delete the private `defaultUserProfile` function (currently lines 34–57, defined right after the `calculateExpGained` function — remove the whole function, not just its body).
2. Add `defaultUserProfile` to the existing `import { levelFromExp, type UserProfile } from '../domain/models/user-profile'` line, so it reads:

```ts
import { defaultUserProfile, levelFromExp, type UserProfile } from '../domain/models/user-profile'
```

3. Leave every call site (`defaultUserProfile(userId, now)`) exactly as it is — the function now resolves to the imported one, with the same signature and the same return value.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/domain/models/user-profile.test.ts src/application/complete-lesson.test.ts`
Expected: PASS — 10 tests in `user-profile.test.ts` (2 existing `levelFromExp` + 1 `defaultUserProfile` + 4 `userSettingsSchema` — wait, count precisely: 2 `levelFromExp` + 1 `defaultUserProfile` + 4 `userSettingsSchema` = 7 total), and all 6 existing `complete-lesson.test.ts` tests still pass completely unmodified — this is the regression proof for the refactor.

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/domain/models/user-profile.ts src/domain/models/user-profile.test.ts src/application/complete-lesson.ts
git commit -m "refactor(profile): export defaultUserProfile and add userSettingsSchema"
```

---

### Task 2: `get-settings.ts`

**Files:**
- Create: `src/application/get-settings.ts`
- Test: `src/application/get-settings.test.ts`

**Interfaces:**
- Consumes: `defaultUserProfile` (Task 1), `UserProfileRepository.getUserProfile` (already exists).
- Produces: `getSettings(userProfileRepo, userId, now?): Promise<UserSettings>`. Consumed by Task 4 (`SettingsPage.loader.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { getSettings } from './get-settings'
import { FakeUserProfileRepository } from '../test/fakes'
import { defaultUserProfile, type UserProfile } from '../domain/models/user-profile'

describe('getSettings', () => {
  it("returns an existing profile's settings unchanged", async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const profile: UserProfile = {
      ...defaultUserProfile('user1', new Date('2025-01-01')),
      settings: {
        soundEnabled: false,
        showKeyboard: true,
        showEnglishKeys: false,
        keyboardOpacity: 0.3,
        romanizationEnabled: false,
        meaningLanguage: 'en',
        theme: 'dark',
      },
    }
    await userProfileRepo.saveUserProfile('user1', profile)

    const settings = await getSettings(userProfileRepo, 'user1')

    expect(settings).toEqual(profile.settings)
  })

  it('returns default settings, not null, for a user with no profile yet', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const now = new Date('2026-01-01')

    const settings = await getSettings(userProfileRepo, 'user1', now)

    expect(settings).toEqual(defaultUserProfile('user1', now).settings)
  })

  it('never writes anything (a GET must stay a pure read)', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const saveSpy = vi.spyOn(userProfileRepo, 'saveUserProfile')

    await getSettings(userProfileRepo, 'user1')

    expect(saveSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/application/get-settings.test.ts`
Expected: FAIL — `src/application/get-settings.ts` does not exist yet.

- [ ] **Step 3: Implement**

```ts
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import { defaultUserProfile, type UserSettings } from '../domain/models/user-profile'

export async function getSettings(
  userProfileRepo: UserProfileRepository,
  userId: string,
  now: Date = new Date(),
): Promise<UserSettings> {
  const profile = await userProfileRepo.getUserProfile(userId)
  return profile?.settings ?? defaultUserProfile(userId, now).settings
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/application/get-settings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/application/get-settings.ts src/application/get-settings.test.ts
git commit -m "feat(settings): add get-settings use case"
```

---

### Task 3: `update-settings.ts`

**Files:**
- Create: `src/application/update-settings.ts`
- Test: `src/application/update-settings.test.ts`

**Interfaces:**
- Consumes: `defaultUserProfile` (Task 1), `UserProfileRepository.getUserProfile`/`saveUserProfile` (already exist).
- Produces: `updateSettings(userProfileRepo, userId, settings, now?): Promise<void>`. Consumed by Task 5 (`SettingsPage.action.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { updateSettings } from './update-settings'
import { FakeUserProfileRepository } from '../test/fakes'
import { defaultUserProfile, type UserProfile, type UserSettings } from '../domain/models/user-profile'

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    soundEnabled: false,
    showKeyboard: false,
    showEnglishKeys: false,
    keyboardOpacity: 0.2,
    romanizationEnabled: false,
    meaningLanguage: 'th',
    theme: 'dark',
    ...overrides,
  }
}

describe('updateSettings', () => {
  const now = new Date('2026-01-05')

  it("replaces only .settings on an existing profile, leaving exp/stats/createdAt untouched", async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const existing: UserProfile = {
      id: 'user1',
      exp: 350,
      settings: defaultUserProfile('user1', new Date('2025-01-01')).settings,
      stats: {
        lessonsCompleted: 4,
        wordsPracticed: 12,
        averageAccuracy: 88,
        bestAccuracy: 100,
        averageSpeedWpm: 25,
        totalTypingTimeSeconds: 900,
      },
      createdAt: new Date('2025-01-01'),
    }
    await userProfileRepo.saveUserProfile('user1', existing)

    const newSettings = makeSettings()
    await updateSettings(userProfileRepo, 'user1', newSettings, now)

    const updated = await userProfileRepo.getUserProfile('user1')
    expect(updated?.settings).toEqual(newSettings)
    expect(updated?.exp).toBe(350)
    expect(updated?.stats).toEqual(existing.stats)
    expect(updated?.createdAt).toEqual(existing.createdAt)
  })

  it('creates a new profile from defaultUserProfile when none exists yet, with the submitted settings', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const newSettings = makeSettings()

    await updateSettings(userProfileRepo, 'user1', newSettings, now)

    const created = await userProfileRepo.getUserProfile('user1')
    expect(created?.settings).toEqual(newSettings)
    expect(created?.exp).toBe(0)
    expect(created?.stats).toEqual(defaultUserProfile('user1', now).stats)
    expect(created?.createdAt).toEqual(now)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/application/update-settings.test.ts`
Expected: FAIL — `src/application/update-settings.ts` does not exist yet.

- [ ] **Step 3: Implement**

```ts
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import { defaultUserProfile, type UserSettings } from '../domain/models/user-profile'

export async function updateSettings(
  userProfileRepo: UserProfileRepository,
  userId: string,
  settings: UserSettings,
  now: Date = new Date(),
): Promise<void> {
  const existing = await userProfileRepo.getUserProfile(userId)
  const profile = existing
    ? { ...existing, settings }
    : { ...defaultUserProfile(userId, now), settings }
  await userProfileRepo.saveUserProfile(userId, profile)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/application/update-settings.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/application/update-settings.ts src/application/update-settings.test.ts
git commit -m "feat(settings): add update-settings use case (read-modify-write)"
```

---

### Task 4: `SettingsPage.loader.ts`

**Files:**
- Create: `src/features/settings/SettingsPage.loader.ts`
- Test: `src/features/settings/SettingsPage.loader.test.ts`

**Interfaces:**
- Consumes: `getSettings` (Task 2).
- Produces: `SettingsLoaderData { settings: UserSettings }`, `createSettingsLoader(deps: { userProfileRepo: UserProfileRepository; ensureUser: () => Promise<{ uid: string }> })`. Consumed by Task 6 (`SettingsPage.tsx`) and Task 7 (`router.ts`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createSettingsLoader } from './SettingsPage.loader'
import { FakeUserProfileRepository } from '../../test/fakes'
import { defaultUserProfile } from '../../domain/models/user-profile'

describe('createSettingsLoader', () => {
  it('signs in, then returns the default settings for a brand-new user', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const userProfileRepo = new FakeUserProfileRepository()
    const loader = createSettingsLoader({ userProfileRepo, ensureUser })

    const data = await loader()

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.settings).toEqual({
      soundEnabled: true,
      showKeyboard: true,
      showEnglishKeys: true,
      keyboardOpacity: 1,
      romanizationEnabled: true,
      meaningLanguage: 'both',
      theme: 'light',
    })
  })

  it("returns an existing user's saved settings", async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const profile = defaultUserProfile('user1', new Date('2025-01-01'))
    await userProfileRepo.saveUserProfile('user1', {
      ...profile,
      settings: { ...profile.settings, theme: 'dark' },
    })
    const loader = createSettingsLoader({
      userProfileRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })

    const data = await loader()

    expect(data.settings.theme).toBe('dark')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/settings/SettingsPage.loader.test.ts`
Expected: FAIL — `src/features/settings/SettingsPage.loader.ts` does not exist yet.

- [ ] **Step 3: Implement**

```ts
import { getSettings } from '../../application/get-settings'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import type { UserSettings } from '../../domain/models/user-profile'

export interface SettingsLoaderData {
  settings: UserSettings
}

export function createSettingsLoader(deps: {
  userProfileRepo: UserProfileRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<SettingsLoaderData> => {
    const user = await deps.ensureUser()
    const settings = await getSettings(deps.userProfileRepo, user.uid)
    return { settings }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/settings/SettingsPage.loader.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/SettingsPage.loader.ts src/features/settings/SettingsPage.loader.test.ts
git commit -m "feat(settings): add the /settings route loader"
```

---

### Task 5: `SettingsPage.action.ts`

**Files:**
- Create: `src/features/settings/SettingsPage.action.ts`
- Test: `src/features/settings/SettingsPage.action.test.ts`

**Interfaces:**
- Consumes: `updateSettings` (Task 3), `userSettingsSchema` (Task 1).
- Produces: `createUpdateSettingsAction(deps: { userProfileRepo: UserProfileRepository; ensureUser: () => Promise<{ uid: string }> })` returning a React Router `ActionFunction` that returns `UserSettings` (the saved settings, echoed back so the page can update its "last-saved" snapshot). Consumed by Task 6 (`SettingsPage.tsx`) and Task 7 (`router.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createUpdateSettingsAction } from './SettingsPage.action'
import { FakeUserProfileRepository } from '../../test/fakes'

function makeSettingsBody() {
  return {
    soundEnabled: false,
    showKeyboard: true,
    showEnglishKeys: false,
    keyboardOpacity: 0.7,
    romanizationEnabled: true,
    meaningLanguage: 'en',
    theme: 'dark',
  }
}

describe('createUpdateSettingsAction', () => {
  it('signs in, parses the request body, and saves the settings', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const action = createUpdateSettingsAction({ userProfileRepo, ensureUser })

    const request = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify(makeSettingsBody()),
    })

    const saved = await action({ request } as never)

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(saved).toEqual(makeSettingsBody())
    const profile = await userProfileRepo.getUserProfile('user1')
    expect(profile?.settings).toEqual(makeSettingsBody())
  })

  it('rejects an out-of-range keyboardOpacity', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const action = createUpdateSettingsAction({
      userProfileRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })
    const request = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ ...makeSettingsBody(), keyboardOpacity: 2 }),
    })

    await expect(action({ request } as never)).rejects.toThrow()
  })

  it('rejects a malformed request body', async () => {
    const userProfileRepo = new FakeUserProfileRepository()
    const action = createUpdateSettingsAction({
      userProfileRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })
    const request = new Request('http://localhost/settings', {
      method: 'POST',
      body: JSON.stringify({ theme: 'light' }), // missing every other field
    })

    await expect(action({ request } as never)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/settings/SettingsPage.action.test.ts`
Expected: FAIL — `src/features/settings/SettingsPage.action.ts` does not exist yet.

- [ ] **Step 3: Implement**

```ts
import type { ActionFunctionArgs } from 'react-router'
import { updateSettings } from '../../application/update-settings'
import { userSettingsSchema, type UserSettings } from '../../domain/models/user-profile'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'

export function createUpdateSettingsAction(deps: {
  userProfileRepo: UserProfileRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async ({ request }: ActionFunctionArgs): Promise<UserSettings> => {
    const settings = userSettingsSchema.parse(await request.json())
    const user = await deps.ensureUser()
    await updateSettings(deps.userProfileRepo, user.uid, settings)
    return settings
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/settings/SettingsPage.action.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/SettingsPage.action.ts src/features/settings/SettingsPage.action.test.ts
git commit -m "feat(settings): add the /settings route action"
```

---

### Task 6: `SettingsPage.tsx`

**Files:**
- Create: `src/features/settings/SettingsPage.tsx`
- Test: `src/features/settings/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `SettingsLoaderData` (Task 4), `UserSettings` (Task 1).
- Produces: `SettingsPage` default export. Consumed by Task 7 (`router.ts`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import SettingsPage from './SettingsPage'
import type { UserSettings } from '../../domain/models/user-profile'

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    soundEnabled: true,
    showKeyboard: true,
    showEnglishKeys: true,
    keyboardOpacity: 1,
    romanizationEnabled: true,
    meaningLanguage: 'both',
    theme: 'light',
    ...overrides,
  }
}

function renderPage(
  settings: UserSettings = makeSettings(),
  action: (args: { request: Request }) => Promise<UserSettings> = async () => settings,
) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: SettingsPage,
        loader: async () => ({ settings }),
        action,
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('SettingsPage', () => {
  it('renders every field seeded from the loaded settings', async () => {
    renderPage(makeSettings({ theme: 'dark', meaningLanguage: 'th' }))

    expect(await screen.findByLabelText('Sound')).toBeChecked()
    expect(screen.getByLabelText('Theme')).toHaveValue('dark')
    expect(screen.getByLabelText('Meaning language')).toHaveValue('th')
  })

  it('disables Save while submitting and shows Saved once it succeeds', async () => {
    let resolveAction: (settings: UserSettings) => void
    const action = vi.fn(
      () =>
        new Promise<UserSettings>((resolve) => {
          resolveAction = resolve
        }),
    )
    renderPage(makeSettings(), action)
    await screen.findByLabelText('Sound')

    const saveButton = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(saveButton)

    await waitFor(() => expect(saveButton).toBeDisabled())
    resolveAction!(makeSettings())

    await waitFor(() => expect(saveButton).not.toBeDisabled())
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('clears the Saved indicator as soon as a field is edited again', async () => {
    renderPage(makeSettings())
    await screen.findByLabelText('Sound')

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Sound'))

    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/settings/SettingsPage.test.tsx`
Expected: FAIL — `src/features/settings/SettingsPage.tsx` does not exist yet.

- [ ] **Step 3: Implement**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useFetcher, useLoaderData } from 'react-router'
import type { SettingsLoaderData } from './SettingsPage.loader'
import type { UserSettings } from '../../domain/models/user-profile'

export default function SettingsPage() {
  const { settings: loadedSettings } = useLoaderData() as SettingsLoaderData
  const fetcher = useFetcher<UserSettings>()
  const [settings, setSettings] = useState<UserSettings>(loadedSettings)
  const [savedSnapshot, setSavedSnapshot] = useState<UserSettings>(loadedSettings)
  const wasSubmitting = useRef(false)

  useEffect(() => {
    if (wasSubmitting.current && fetcher.state === 'idle' && fetcher.data) {
      setSavedSnapshot(fetcher.data)
    }
    wasSubmitting.current = fetcher.state === 'submitting'
  }, [fetcher.state, fetcher.data])

  function update<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  function handleSave() {
    fetcher.submit(settings, { method: 'post', encType: 'application/json' })
  }

  const isSaved = JSON.stringify(settings) === JSON.stringify(savedSnapshot)

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">Settings</h1>

      <div className="mt-6 space-y-4">
        <label className="flex items-center justify-between">
          <span>Sound</span>
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={(e) => update('soundEnabled', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between">
          <span>Show keyboard</span>
          <input
            type="checkbox"
            checked={settings.showKeyboard}
            onChange={(e) => update('showKeyboard', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between">
          <span>Show English key labels</span>
          <input
            type="checkbox"
            checked={settings.showEnglishKeys}
            onChange={(e) => update('showEnglishKeys', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between">
          <span>Keyboard opacity</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={settings.keyboardOpacity}
            onChange={(e) => update('keyboardOpacity', Number(e.target.value))}
          />
        </label>

        <label className="flex items-center justify-between">
          <span>Romanization</span>
          <input
            type="checkbox"
            checked={settings.romanizationEnabled}
            onChange={(e) => update('romanizationEnabled', e.target.checked)}
          />
        </label>

        <label className="flex items-center justify-between">
          <span>Meaning language</span>
          <select
            value={settings.meaningLanguage}
            onChange={(e) => update('meaningLanguage', e.target.value as UserSettings['meaningLanguage'])}
          >
            <option value="th">Thai</option>
            <option value="en">English</option>
            <option value="both">Both</option>
          </select>
        </label>

        <label className="flex items-center justify-between">
          <span>Theme</span>
          <select
            value={settings.theme}
            onChange={(e) => update('theme', e.target.value as UserSettings['theme'])}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={fetcher.state === 'submitting'}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
        >
          Save
        </button>
        {isSaved && fetcher.data && <span className="text-sm text-emerald-600">Saved</span>}
      </div>
    </main>
  )
}
```

Every `<label>` above wraps its `<input>`/`<select>`, so React Testing Library's `getByLabelText('Sound')` etc. resolve correctly without needing separate `htmlFor`/`id` pairs.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/settings/SettingsPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/SettingsPage.tsx src/features/settings/SettingsPage.test.tsx
git commit -m "feat(settings): add the SettingsPage form"
```

---

### Task 7: Wire it all together — `CourseListPage`, `router.ts`, manual verification

**Files:**
- Modify: `src/features/course/CourseListPage.tsx`
- Modify: `src/features/course/CourseListPage.test.tsx`
- Modify: `src/app/router.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: nothing — this is the integration point.

- [ ] **Step 1: Write the failing test**

Add this test to the existing `describe('CourseListPage', ...)` block in `src/features/course/CourseListPage.test.tsx` (its 4 existing tests from the review-session round stay unchanged):

```tsx
  it('always shows a Settings link', async () => {
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

    const link = await screen.findByRole('link', { name: 'Settings' })
    expect(link).toHaveAttribute('href', '/settings')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/course/CourseListPage.test.tsx`
Expected: FAIL — the new test fails (no Settings link yet); the 4 existing tests still pass.

- [ ] **Step 3: Add the Settings link**

In `src/features/course/CourseListPage.tsx`, add a `<Link to="/settings">` — the file's current content (from the review-session round) is:

```tsx
import { Link, useLoaderData } from 'react-router'
import type { CourseListLoaderData } from './CourseListPage.loader'

export default function CourseListPage() {
  const { courses, dueReviewCount } = useLoaderData() as CourseListLoaderData

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">Jamozy</h1>

      {dueReviewCount > 0 && (
        <Link to="/review" className="mt-2 block text-sm text-amber-700 underline">
          {dueReviewCount} words due for review
        </Link>
      )}

      {courses.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No courses yet.</p>
      ) : (
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
      )}
    </main>
  )
}
```

Replace it in full, adding the always-visible Settings link:

```tsx
import { Link, useLoaderData } from 'react-router'
import type { CourseListLoaderData } from './CourseListPage.loader'

export default function CourseListPage() {
  const { courses, dueReviewCount } = useLoaderData() as CourseListLoaderData

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium text-slate-900">Jamozy</h1>
        <Link to="/settings" className="text-sm text-slate-600 underline">
          Settings
        </Link>
      </div>

      {dueReviewCount > 0 && (
        <Link to="/review" className="mt-2 block text-sm text-amber-700 underline">
          {dueReviewCount} words due for review
        </Link>
      )}

      {courses.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No courses yet.</p>
      ) : (
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
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/course/CourseListPage.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Wire the new route into the router**

Replace `src/app/router.ts` in full (adds the `/settings` route and its two new imports; every other route stays exactly as it is):

```ts
import { createBrowserRouter } from 'react-router'
import {
  courseRepo,
  lessonRepo,
  progressRepo,
  userProfileRepo,
  reviewRepo,
} from '../infrastructure/firebase/repositories'
import { signInAnonymouslyIfNeeded } from '../infrastructure/firebase/firebase'
import CourseListPage from '../features/course/CourseListPage'
import { createCourseListLoader } from '../features/course/CourseListPage.loader'
import CourseMapPage from '../features/course/CourseMapPage'
import { createCourseMapLoader } from '../features/course/CourseMapPage.loader'
import LessonDetailPage from '../features/lesson/LessonDetailPage'
import { createLessonDetailLoader } from '../features/lesson/LessonDetailPage.loader'
import { createCompleteLessonSessionAction } from '../features/lesson/LessonDetailPage.action'
import ReviewPage from '../features/review/ReviewPage'
import { createReviewLoader } from '../features/review/ReviewPage.loader'
import { createSubmitReviewSessionAction } from '../features/review/ReviewPage.action'
import SettingsPage from '../features/settings/SettingsPage'
import { createSettingsLoader } from '../features/settings/SettingsPage.loader'
import { createUpdateSettingsAction } from '../features/settings/SettingsPage.action'
import RouteError from './RouteError'
import NotFoundPage from './NotFoundPage'

export const router = createBrowserRouter([
  {
    path: '/',
    Component: CourseListPage,
    loader: createCourseListLoader({
      courseRepo,
      reviewRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/courses/:courseId',
    Component: CourseMapPage,
    loader: createCourseMapLoader({
      courseRepo,
      lessonRepo,
      progressRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/lessons/:lessonId',
    Component: LessonDetailPage,
    loader: createLessonDetailLoader({
      lessonRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    action: createCompleteLessonSessionAction({
      courseRepo,
      lessonRepo,
      progressRepo,
      userProfileRepo,
      reviewRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/review',
    Component: ReviewPage,
    loader: createReviewLoader({
      reviewRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    action: createSubmitReviewSessionAction({
      reviewRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '/settings',
    Component: SettingsPage,
    loader: createSettingsLoader({
      userProfileRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    action: createUpdateSettingsAction({
      userProfileRepo,
      ensureUser: signInAnonymouslyIfNeeded,
    }),
    ErrorBoundary: RouteError,
  },
  {
    path: '*',
    Component: NotFoundPage,
  },
])
```

- [ ] **Step 6: Run the full suite**

Run: `pnpm exec vitest run`
Expected: PASS, every test in the project (this task's + all prior tasks' + everything from earlier rounds).

- [ ] **Step 7: Typecheck, lint, build**

Run: `pnpm exec tsc -b && pnpm lint && pnpm build`
Expected: no errors; `dist/` builds successfully.

- [ ] **Step 8: Manual browser verification**

Run: `pnpm dev`, then in a browser (or via the `claude-in-chrome` tool):

1. Visit `/` — confirm a "Settings" link is always visible next to the "Jamozy" heading, regardless of due-review count.
2. Click it — confirm `/settings` loads with all 7 controls, seeded with the default values (sound/keyboard/English keys/romanization checked, opacity slider at 1, meaning language "Both", theme "Light") for this test user's first visit.
3. Change a few values — toggle Sound off, move the opacity slider, switch meaning language to "English", switch theme to "Dark".
4. Click Save — confirm the button disables briefly, then re-enables with a "Saved" indicator next to it.
5. Change one field again (e.g. toggle Sound back on) — confirm "Saved" disappears immediately, before clicking Save again.
6. Reload the page (full browser reload, not SPA navigation) — confirm the loader now returns the values from step 3 that were actually saved (Sound off, moved opacity, English, Dark), not the defaults — proving the write actually landed in Firestore and the read path picks it up.
7. Check the browser console for errors at every step above.

Fix any issues found before proceeding.

- [ ] **Step 9: Commit**

```bash
git add src/features/course/CourseListPage.tsx src/features/course/CourseListPage.test.tsx src/app/router.ts
git commit -m "feat(settings): wire the /settings route and its CourseListPage entry point"
```
