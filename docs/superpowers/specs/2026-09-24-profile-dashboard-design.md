# Profile Dashboard — Design

## Goal

A read-only `/profile` page showing the learner's level, EXP progress, and
all `UserStats` fields, linked from `CourseListPage`.

## Scope

In scope: one new route, one new read-only use case, one new page component,
a nav link. Out of scope: writing to the profile from this page (no action,
no form), editing stats, any new domain fields (`UserStats`/`exp` already
carry everything this page needs), streaks/achievements (tracked separately
in README's post-MVP list).

## Architecture

Mirrors the existing `get-settings.ts` → `SettingsPage.loader.ts` →
`SettingsPage.tsx` shape, since that pattern (read-only use case, default
fallback for a new user, no write side effect on a read path) is already
established and this page has no reason to deviate from it.

```
UserProfileRepository.getUserProfile
        │
        ▼
application/get-profile-summary.ts   (falls back to defaultUserProfile)
        │
        ▼
features/profile/ProfilePage.loader.ts
        │
        ▼
features/profile/ProfilePage.tsx  (+ format-typing-time.ts, pure)
```

## Components

- **`application/get-profile-summary.ts`** (new)
  `getProfileSummary(userProfileRepo: UserProfileRepository, userId: string, now: Date = new Date()): Promise<ProfileSummary>`
  where `ProfileSummary = { exp: number; level: number; stats: UserStats }`.
  Reads via `userProfileRepo.getUserProfile`; when no profile document
  exists yet, falls back to `defaultUserProfile(userId, now)` — same
  no-write-on-read behavior as `getSettings`. Derives `level` via the
  existing `levelFromExp(exp)`.

- **`features/profile/format-typing-time.ts`** (new)
  `formatTypingTime(totalSeconds: number): string`. Pure,
  `Math.floor(totalSeconds / 60)` gives whole minutes. `0`–`59` seconds
  (0 whole minutes) → `"0 min"`; 1–59 whole minutes → `"N min"`; 60+
  whole minutes → `"Xh Ym"` (omit `Ym` when the remainder is 0, e.g.
  `"2h"` not `"2h 0m"`). Extracted to its own file up front (not defined
  inside `ProfilePage.tsx`) to avoid the
  `react-refresh/only-export-components` lint trip hit in the previous
  round, where a pure function exported from a component file broke Vite
  Fast Refresh.

- **`features/profile/ProfilePage.loader.ts`** (new)
  `createProfileLoader(deps: { userProfileRepo: UserProfileRepository; ensureUser: () => Promise<{ uid: string }> })`.
  Signs the user in, calls `getProfileSummary`, returns
  `{ summary: ProfileSummary }` as `ProfileLoaderData`. Exact mirror of
  `SettingsPage.loader.ts`.

- **`features/profile/ProfilePage.tsx`** (new)
  Reads `{ summary }` via `useLoaderData<ProfileLoaderData>()`. Renders:
  - `Level {summary.level}` heading.
  - An EXP progress bar: `levelFromExp` uses flat 100-EXP-per-level
    thresholds, so progress within the current level is
    `summary.exp % 100` out of `100` — no new domain rule, just reusing
    the existing one. Label as `"{exp % 100} / 100 EXP"`.
  - The 6 `UserStats` fields: lessons completed, words practiced, average
    accuracy (`{n}%`), best accuracy (`{n}%`), average speed
    (`{n} WPM`), total typing time (via `formatTypingTime`).

- **`app/router.ts`** — new `/profile` route: `loader` only (no `action` —
  nothing is written from this page), `ErrorBoundary: RouteError` like
  every other route.

- **`features/course/CourseListPage.tsx`** — add a "Profile" link next to
  the existing "Settings" link (same always-visible treatment, no
  conditional logic).

## Error Handling

No new error paths. `ensureUser`/`RouteError` behave exactly as every
other route already does; `getProfileSummary` cannot throw for a missing
profile (falls back to defaults, exactly like `getSettings`).

## Testing

- `get-profile-summary.test.ts`: new user gets zeroed `UserStats` and
  `exp: 0`/`level: 1`; an existing user's real `exp`/`stats` are returned
  unchanged; `level` derivation at the `exp = 99` vs `exp = 100` boundary.
- `format-typing-time.test.ts`: `0` seconds → `"0 min"`, under a minute
  (e.g. `45s` → `"0 min"`), minutes-only (e.g. `125s` → `"2 min"`),
  hours+minutes (e.g. `3665s` → `"1h 1m"`), exact-hour case (e.g.
  `7200s` → `"2h"`, no trailing `"0m"`).
- `ProfilePage.loader.test.ts`: mirrors `SettingsPage.loader.test.ts`'s
  shape — returns the loader's `summary` field from a fake repo.
- `ProfilePage.test.tsx`: renders level, EXP bar text, and all 6 stats
  from a fixed `ProfileSummary`.
- `CourseListPage.test.tsx`: gains an assertion that a "Profile" link is
  present, alongside the existing "Settings" link assertion.

## Review Focus

- A new user who has never completed a lesson: all stats render as `0`
  (or `0%`/`0 WPM`/`"0 min"`), not `NaN`/`undefined`/blank — `UserStats`'
  numeric fields default to `0` in `defaultUserProfile`, so this should
  fall out of the existing fallback, but no task's test currently pins
  the *rendered* zero-state text explicitly.
- `exp` values that are not an exact multiple of 100 render a partial EXP
  bar correctly (e.g. `exp = 250` → level 3, `50 / 100 EXP`), not just the
  round-number cases.
- `totalTypingTimeSeconds` at exactly a multiple of 3600 (an exact number
  of hours) omits a spurious `"0m"` suffix.
- `averageAccuracy`/`bestAccuracy` are stored as the 0–100 scale used
  elsewhere in this codebase (see `getLessonResult`'s DEC-018 note) — the
  page must not re-scale or divide them again before appending `%`.
- The Profile link's placement/order relative to the existing Settings
  link on `CourseListPage` doesn't break any existing `CourseListPage`
  test that queries links by role/name.
