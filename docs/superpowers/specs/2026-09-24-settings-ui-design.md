# Settings UI — Design Spec

## Goal

Build a `/settings` route that reads and writes `UserProfile.settings` (`UserSettings`, [[DEC-013]]) — the last unbuilt piece of README's MVP checklist besides a dedicated Lesson Result screen and the DEC-015 security gap.

## Scope

**In scope:** a `/settings` route (loader + action + page), two new application-layer use cases (`get-settings.ts`, `update-settings.ts`), a shared `defaultUserProfile` factory extracted from `complete-lesson.ts`, an always-visible "Settings" link on `CourseListPage`.

**Deliberately out of scope this round, per the user's explicit scope choice:** none of the 7 settings actually change any other screen's behavior yet. `VirtualKeyboard.tsx` keeps rendering unconditionally with English key labels always shown; `LessonDetailPage`/`ReviewPage` keep showing both Thai and English meaning text; there is no sound anywhere in the app; there is no dark-mode CSS anywhere in the app. This round is a correctly-persisting form only — wiring each setting into its consumer is separate future work, one setting (or a related cluster of settings) at a time.

## Architecture

```
CourseListPage ("Settings" link, always shown — unlike Review's conditional due-count badge)
   ↓
GET /settings route loader → getSettings(userProfileRepo, uid) → UserSettings
   (returns just the settings object, not the whole UserProfile — the page has no use for exp/stats)
   ↓
SettingsPage.tsx
   - controlled form, all 7 UserSettings fields, local state seeded from loader data
   - Save button: disabled while fetcher.state === 'submitting'; shows "Saved" for a moment
     once fetcher.state is back to 'idle' and fetcher.data is set (the same success signal
     LessonTypingSession/ReviewTypingSession already use, but shown to the user this time
     instead of driving a page transition)
   ↓ (on Save click)
   fetcher.submit(settingsState, { method: 'post', encType: 'application/json' })
   ↓
POST /settings route action, body: UserSettings directly (not wrapped, not partial)
   ↓
userSettingsSchema.parse(...) (Zod, lives in domain/models/user-profile.ts next to UserSettings —
   matches the precedent of lessonResultSchema living next to LessonResult in lesson-session.ts)
   ↓
updateSettings(userProfileRepo, uid, settings) — read-modify-write:
   - existing profile found → { ...profile, settings } (exp/stats/createdAt untouched)
   - no profile yet → defaultUserProfile(uid, now) with settings replaced by the submitted value
   ↓
saveUserProfile(userProfileRepo, uid, updatedProfile)
```

## Key decisions

1. **`getSettings`/`updateSettings` operate on `UserSettings` only, never the whole `UserProfile`.** The loader returns `{ settings: UserSettings }`; the action's Zod schema validates exactly a `UserSettings` shape, nothing wrapped around it. This was an explicit correction from the initial design pass: neither function needs to expose `exp`/`stats`/`createdAt` to the settings page at all.

2. **`defaultUserProfile(userId, now)` moves from a private helper in `complete-lesson.ts` to an exported function in `domain/models/user-profile.ts`, reused by both.** Today the exact 7-field default settings object (`soundEnabled: true, showKeyboard: true, showEnglishKeys: true, keyboardOpacity: 1, romanizationEnabled: true, meaningLanguage: 'both', theme: 'light'`) plus zeroed stats live only inside `complete-lesson.ts`, private and untested in isolation. `get-settings.ts` needs the same defaults for a user who has never completed a lesson (no `UserProfile` doc exists yet) or clicked Save before. Duplicating the 7 values in two files risks drift; exporting the existing factory and updating `complete-lesson.ts` to import it keeps exactly one source of truth. `complete-lesson.test.ts`'s existing behavior and assertions are unaffected — same values, different import path.

3. **`update-settings.ts` is a read-modify-write, never a blind overwrite.** It calls `getUserProfile` first: if a profile exists, only `.settings` is replaced (`exp`/`stats`/`createdAt` carried through unchanged) — this is the same shape of correctness bug class as [[DEC-018]]'s WPM/accuracy-scale catch, just simpler to get right here since there's no unit conversion involved, only "don't clobber fields you're not supposed to touch." If no profile exists yet, it builds one from `defaultUserProfile(uid, now)` with the submitted settings substituted in, and that first Save is what actually creates the user's `UserProfile` document — a `GET /settings` before that point never writes anything (loaders stay pure reads, matching every other route in this app).

4. **Save button UX:** disabled while `fetcher.state === 'submitting'` (prevents a double-click from firing two identical, harmless-but-redundant writes); shows a brief "Saved" indicator once the fetcher returns to `idle` with data. Unlike the lesson/review typing flows, a settings save has no double-submission *correctness* risk — the write is idempotent (same `UserSettings` object every time) — so this is purely UX polish, not a data-integrity guard. The "Saved" indicator must track the *last-saved* snapshot, not just "a submission finished": if the learner edits any field after a successful save, the indicator clears immediately (the current form state no longer matches what's persisted), rather than staying stuck on "Saved" through an unsaved edit.

5. **Entry point:** an always-visible "Settings" link on `CourseListPage` (not conditional, unlike Review's due-count badge which only appears when something is actually due). No persistent nav bar — same constraint as the Review round.

## Data flow / field-level shape

```ts
// domain/models/user-profile.ts additions
export function defaultUserProfile(userId: string, now: Date): UserProfile { /* moved from complete-lesson.ts, unchanged */ }
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

```ts
// application/get-settings.ts
export async function getSettings(
  userProfileRepo: UserProfileRepository,
  userId: string,
  now: Date = new Date(),
): Promise<UserSettings> {
  const profile = await userProfileRepo.getUserProfile(userId)
  return profile?.settings ?? defaultUserProfile(userId, now).settings
}
```

```ts
// application/update-settings.ts
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

## New files

- `src/application/get-settings.ts` (+ test)
- `src/application/update-settings.ts` (+ test)
- `src/features/settings/SettingsPage.tsx` (+ test)
- `src/features/settings/SettingsPage.loader.ts` (+ test)
- `src/features/settings/SettingsPage.action.ts` (+ test)

## Modified files

- `src/domain/models/user-profile.ts` — adds exported `defaultUserProfile` and `userSettingsSchema`.
- `src/application/complete-lesson.ts` — removes its private `defaultUserProfile`, imports the shared one instead. No behavior change; existing tests must still pass unmodified.
- `src/features/course/CourseListPage.tsx` — adds an always-visible "Settings" link.
- `src/app/router.ts` — new `/settings` route (loader + action).

## Testing

- `defaultUserProfile`: same assertions `complete-lesson.test.ts` already implicitly relies on, now directly testable in isolation if useful; `complete-lesson.test.ts` itself must still pass unchanged after the import swap (regression check, not new behavior).
- `get-settings.ts`: returns an existing profile's settings unchanged; returns default settings (not `null`, no throw) for a user with no profile yet; never writes anything (spy on `saveUserProfile`, assert not called).
- `update-settings.ts`: existing profile → only `.settings` changes, `exp`/`stats`/`createdAt` are byte-for-byte preserved; no existing profile → a new one is created via `defaultUserProfile` with the submitted settings, not zeroed/default settings.
- `SettingsPage.loader.ts`/`SettingsPage.action.ts`: same shape of tests as the lesson/review loaders/actions — `ensureUser` called first, malformed body (e.g. `keyboardOpacity: 1.5`, missing field, wrong enum value) rejected by Zod.
- `SettingsPage.tsx`: renders all 7 fields seeded from loader data; clicking Save disables the button while the fetcher is submitting and re-enables after; shows a "Saved" indicator once the fetcher completes successfully.
- `CourseListPage`: the Settings link is present and always rendered (no conditional, unlike the review-count badge).

## Review Focus (carried into the implementation plan)

1. **`update-settings.ts` must never clobber `exp`/`stats`/`createdAt` on an existing profile** — a learner who has completed lessons and earned EXP must not have it reset to 0 by an unrelated settings save.
2. **A brand-new user (no `UserProfile` doc yet) must see sensible default settings on `/settings` without any write happening on page load**, and their first Save must be the point a profile document actually gets created.
3. **`complete-lesson.ts`'s behavior must be provably unchanged after the `defaultUserProfile` extraction** — its existing test suite is the regression gate; the refactor must not need any of those tests to change.
4. **`keyboardOpacity` must be validated within `[0, 1]`** — an out-of-range or non-numeric value in the submitted body must be rejected by Zod before it ever reaches Firestore.
5. **The Save button's disabled/"Saved" states must not get stuck** — a fast double-click must not double-submit visibly, and the "Saved" indicator must not persist forever or reappear incorrectly after the user edits a field again without saving.
