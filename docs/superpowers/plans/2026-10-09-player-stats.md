# Player Stats (Spec A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record lifetime, daily, and monthly Player Stats (LEVELING.md → Jamozy Player Stats) on every session submit, for Guest (IndexedDB) and account (Firestore) users. Data only; no UI.

**Architecture:** Clients measure per-exercise stats (`ExerciseStat`). Use cases fold them into new optional `LearningSession` fields. One pure domain function, `applySessionStats`, turns the current profile stats plus that day's and month's docs into their next values. The Firestore submit transaction, the IndexedDB `putSessionOnce` transaction, and Guest→account `migrateSessionOutcome` all call it inside their existing receipt-deduped transaction.

**Tech Stack:** TypeScript, React Router actions, Zustand, Firebase modular SDK (`runTransaction`), IndexedDB, Zod, Vitest, `@firebase/rules-unit-testing` + Firestore Emulator (`pnpm test:rules`).

**Spec:** `docs/superpowers/specs/2026-10-09-player-stats-design.md`

## Global Constraints

- No UI changes. No backfill of old data; new stats start at 0 on deploy.
- All new persisted fields are optional; old docs and sessions read as 0 / absent.
- Words/sentences/characters: `word` → words; `phrase`/`sentence` → sentences; characters = Hangul syllables of a finished `targetText`, spaces excluded.
- Perfect lesson = mode `learning-path` or `home` with `rejectedKeystrokes === 0` (replays count; review never).
- Perfect streak counts exercises, continues across sessions, and resets on any exercise with a mistake.
- Typing time: from the first to the last keystroke of each exercise; skip any gap > 10 seconds (`TYPING_GAP_LIMIT_MS = 10_000`).
- Learning time = `session.learningSeconds ?? session.durationSeconds`. Home sets `learningSeconds` to the sum of per-exercise `elapsedSeconds`.
- Active day = a `localDate` with ≥ 1 submitted session (any mode). A session older than `lastActiveDate` adds to daily stats but never changes the streak.
- `localDate` uses `profile.timezone`, else the device zone. When `profile.timezone` is unset, it is filled with `session.timeZone` in the same transaction. If both are missing, use the fallback zone `Asia/Bangkok`.
- Daily doc: `users/{id}/dailyStats/{YYYY-MM-DD}`. Monthly doc: `users/{id}/monthlyStats/{YYYY-MM}`. Guest IndexedDB keys: `${userId}:${date}`.
- Stats change only inside the existing submit or migration transaction, after the `sessionOutcomes` receipt check.
- **Testing:**
  - Run only the test files you add or change: `pnpm vitest run <files>`, plus `pnpm test:rules` for emulator files.
  - Do **not** run the full `pnpm test` or `pnpm build`; the repo owner runs both (handoff).
  - Run `pnpm exec tsc -b` and `pnpm lint` once at the end (Task 10).
- **Repo rules:**
  - Do not run `git commit`; each task ends with a suggested commit message only.
  - Never add Co-Authored-By trailers.
  - **Firestore Rules:** change `firestore.rules` only after the user explicitly confirms (Task 4, Step 1).

## Review Focus

1. **Midnight boundary.** A session finished at 2026-10-09T17:30Z in `Asia/Bangkok` must land on `2026-10-10`. Pinned in Task 2 (`localDateIn`).
2. **Duplicate submit.** A retry with the same session ID must not change stats twice. Pinned in Task 4 (emulator) and Task 5 (Guest fake DB).
3. **Old data with missing fields.** A profile with an old `sessionAggregate` (no new fields) and a session without stats must not produce `NaN`. Pinned in Task 2 (`applySessionStats` legacy session) and Task 3 (`addSessionAggregate` legacy).
4. **Pending Home sync jobs from before deploy.** These have no `typingSeconds` / `elapsedSeconds` / `lesson.type`; they must still parse and submit. Pinned in Task 1 (schema) and Task 8 (`recordHomeExercise` without type).
5. **Migration order.** Guest outcomes stored out of order must apply by `completedAt` so the streak counts up. Pinned in Task 9.

---

## File Structure

| File                                                                                                                                    | Responsibility                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/domain/korean/lesson-session.ts` (modify)                                                                                          | Per-exercise timing;`ExerciseResult.typingSeconds/elapsedSeconds`; `LessonResult.exercises`                                               |
| `src/domain/models/player-stats.ts` (create)                                                                                            | `ExerciseStat`, `PeriodStats`, `PlayerStats`, `localDateIn`, `deviceTimeZone`, `sessionStatsFrom`, `periodStatsFrom`, `applySessionStats` |
| `src/domain/models/learning-session.ts` (modify)                                                                                        | Optional stats fields on`LearningSession`                                                                                                 |
| `src/domain/models/session-aggregate.ts` (modify)                                                                                       | New sum/max fields                                                                                                                        |
| `src/domain/models/user-profile.ts`, `guest-migration.ts` (modify)                                                                      | `timezone`, `playerStats`; merge rule                                                                                                     |
| `src/domain/models/review-item.ts` (modify)                                                                                             | `sourceLessonType?`                                                                                                                       |
| `src/infrastructure/firebase/repositories/firestore-player-stats.ts` (create)                                                           | Read/apply/write stats inside a Firestore transaction (shared by submit + migration)                                                      |
| `firebase-session-submission-repository.ts`, `firebase-account-migration-repository.ts`, `firebase-user-profile-repository.ts` (modify) | Call the shared helper; map new profile fields                                                                                            |
| `src/infrastructure/local/guest-database.ts` (modify)                                                                                   | Stores`dailyStats`/`monthlyStats`, version 7, apply stats in `putSessionOnce`                                                             |
| Application + features (modify)                                                                                                         | Build`ExerciseStat[]` and pass them from each play mode                                                                                   |

---

### Task 1: Per-exercise timing in the lesson session reducer

**Files:**

- Modify: `src/domain/korean/lesson-session.ts`
- Modify: `src/features/typing/lesson-session-store.ts`, `src/features/home/home-player-store.ts`, `src/features/home/one-page-player-store.ts` (pass `Date.now()`)
- Test: `src/domain/korean/lesson-session.test.ts`

**Interfaces:**

- Produces:
  - `ExerciseResult.typingSeconds?: number`, `ExerciseResult.elapsedSeconds?: number`
  - `pressKey(state, code, shiftKey, nowMs?: number)`
  - `LessonResult.exercises?: ExerciseStat[]` (type from Task 2; to avoid a cycle, define `ExerciseStat` in Task 2's file and import it here as a type only)
  - `TYPING_GAP_LIMIT_MS = 10_000`

Note: Task 2 creates `player-stats.ts`. If you run Task 1 first, create the file now with only the `ExerciseStat` interface from Task 2, Step 3.

- [ ] **Step 1: Write the failing tests** (append to `lesson-session.test.ts`; reuse the file's existing helper that types a target, or press keys with `keysFor` as the file already does)

```ts
describe('exercise timing', () => {
  it('sums keystroke gaps up to 10 seconds and skips longer gaps', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    // 가 = KeyR, KeyK
    state = pressKey(state, 'KeyR', false, 1_000)
    state = pressKey(state, 'KeyK', false, 13_000) // 12s gap: skipped
    expect(state.lastCompletedExercise?.typingSeconds).toBe(0)
    expect(state.lastCompletedExercise?.elapsedSeconds).toBe(12)
  })

  it('counts a gap of exactly 10 seconds', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyR', false, 0)
    state = pressKey(state, 'KeyK', false, 10_000)
    expect(state.lastCompletedExercise?.typingSeconds).toBe(10)
  })

  it('restarts timing for the next exercise and counts wrong keys', () => {
    let state = startLessonSession([
      { id: 'e1', targetText: '가' },
      { id: 'e2', targetText: '가' },
    ])
    state = pressKey(state, 'KeyR', false, 0)
    state = pressKey(state, 'KeyK', false, 1_000)
    state = pressKey(state, 'KeyQ', false, 60_000) // wrong key, first of e2
    state = pressKey(state, 'KeyR', false, 61_000)
    state = pressKey(state, 'KeyK', false, 63_000)
    expect(state.completedResults[1]).toMatchObject({
      typingSeconds: 3,
      elapsedSeconds: 3,
    })
  })

  it('records zero time when no clock is passed', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    expect(state.lastCompletedExercise).toMatchObject({
      typingSeconds: 0,
      elapsedSeconds: 0,
    })
  })

  it('reports per-exercise stats in the lesson result', () => {
    let state = startLessonSession([{ id: 'e1', targetText: '가' }])
    state = pressKey(state, 'KeyQ', false, 0)
    state = pressKey(state, 'KeyR', false, 1_000)
    state = pressKey(state, 'KeyK', false, 2_000)
    expect(getLessonResult(state).exercises).toEqual([
      {
        targetText: '가',
        mistakeCount: 1,
        typingSeconds: 2,
        elapsedSeconds: 2,
      },
    ])
  })

  it('still parses an exercise result saved before timing existed', () => {
    expect(
      exerciseResultSchema.parse({
        exerciseId: 'e1',
        targetText: '가',
        correctKeyCount: 2,
        mistakes: [],
      }),
    ).not.toHaveProperty('typingSeconds')
  })
})
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm vitest run src/domain/korean/lesson-session.test.ts`
Expected: FAIL (`typingSeconds` undefined / `exercises` undefined)

- [ ] **Step 3: Implement**

In `lesson-session.ts`:

```ts
import type { ExerciseStat } from '../models/player-stats'

export const TYPING_GAP_LIMIT_MS = 10_000

interface ExerciseTiming {
  firstKeyAtMs: number | null
  lastKeyAtMs: number | null
  typingMs: number
}
const emptyTiming = (): ExerciseTiming => ({
  firstKeyAtMs: null,
  lastKeyAtMs: null,
  typingMs: 0,
})

function nextTiming(
  timing: ExerciseTiming,
  nowMs: number | undefined,
): ExerciseTiming {
  if (nowMs === undefined) return timing
  const gap = timing.lastKeyAtMs === null ? 0 : nowMs - timing.lastKeyAtMs
  return {
    firstKeyAtMs: timing.firstKeyAtMs ?? nowMs,
    lastKeyAtMs: nowMs,
    typingMs:
      timing.typingMs + (gap > 0 && gap <= TYPING_GAP_LIMIT_MS ? gap : 0),
  }
}
```

- `ExerciseResult` gains `typingSeconds?: number` and `elapsedSeconds?: number`. Add `.optional()` fields `typingSeconds: z.number().min(0).optional()` and `elapsedSeconds: z.number().min(0).optional()` to `exerciseResultSchema`.
- `LessonSessionState` gains `timing: ExerciseTiming`. `startLessonSession` sets `timing: emptyTiming()`.
- `pressKey(state, code, shiftKey, nowMs?: number)`:
  - Compute `const timing = nextTiming(state.timing ?? emptyTiming(), nowMs)` for every key that reaches the typing reducer. Modifier keys return the same state from the reducer; skip timing when `nextSession === state.currentSession`.
  - Keep `timing` on the in-progress branch.
  - On completion, build the result with:

    ```ts
    typingSeconds: timing.typingMs / 1000,
    elapsedSeconds:
      timing.firstKeyAtMs === null || timing.lastKeyAtMs === null
        ? 0
        : (timing.lastKeyAtMs - timing.firstKeyAtMs) / 1000,
    ```

    Then reset `timing: emptyTiming()` for the next exercise.
- `LessonResult` gains `exercises?: ExerciseStat[]`. `getLessonResult` sets:
  ```ts
  exercises: state.completedResults.map((r) => ({
    targetText: r.targetText,
    mistakeCount: r.mistakes.length,
    typingSeconds: r.typingSeconds ?? 0,
    elapsedSeconds: r.elapsedSeconds ?? 0,
  })),
  ```
- `lessonResultSchema` gains:
  ```ts
  exercises: z.array(z.object({
    targetText: z.string(),
    mistakeCount: z.number().int().min(0),
    typingSeconds: z.number().min(0),
    elapsedSeconds: z.number().min(0),
  })).max(100).optional(),
  ```
- In the three stores, call `pressKeyReducer(session, code, shiftKey, Date.now())`.

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm vitest run src/domain/korean/lesson-session.test.ts`

- [ ] **Step 5: Suggested commit** — `feat(typing): measure per-exercise typing and elapsed time`

---

### Task 2: Player stats domain (`player-stats.ts`)

**Files:**

- Create: `src/domain/models/player-stats.ts`
- Modify: `src/domain/models/learning-session.ts`
- Test: `src/domain/models/player-stats.test.ts`

**Interfaces:**

- Produces:

```ts
export interface ExerciseStat {
  targetText: string
  mistakeCount: number
  typingSeconds: number
  elapsedSeconds: number
  lessonType?: LessonType
}
export interface PeriodStats {
  expEarned
  lessonsCompleted
  lessonsReplayed
  reviewsCompleted
  perfectLessons
  correctKeystrokes
  incorrectKeystrokes
  charactersTyped
  wordsPracticed
  sentencesPracticed
  typingSeconds
  learningSeconds
} // all number
export interface PlayerStats {
  activeDays: number
  streak: { current: number; longest: number; lastActiveDate: string | null }
  perfectStreak: { current: number; longest: number }
  records: {
    mostExpDay: DatedRecord | null
    mostExpMonth: DatedRecord | null
    mostLessonsDay: DatedRecord | null
  }
}
export interface DatedRecord {
  value: number
  period: string
} // 'YYYY-MM-DD' or 'YYYY-MM'
export type SessionStats = Pick<
  LearningSession,
  | 'localDate'
  | 'timeZone'
  | 'typingSeconds'
  | 'charactersTyped'
  | 'wordsPracticed'
  | 'sentencesPracticed'
  | 'exerciseMistakes'
>
export const FALLBACK_TIME_ZONE = 'Asia/Bangkok'
export function deviceTimeZone(): string
export function localDateIn(date: Date, timeZone: string): string
export function sessionStatsFrom(
  exercises: ExerciseStat[],
  lessonType: LessonType | undefined,
  timeZone: string,
  completedAt: Date,
): SessionStats
export function periodStatsFrom(session: LearningSession): PeriodStats
export const emptyPeriodStats: () => PeriodStats
export const emptyPlayerStats: () => PlayerStats
export function applySessionStats(
  current: {
    player: PlayerStats | undefined
    daily: PeriodStats | null
    monthly: PeriodStats | null
    profileTimeZone: string | undefined
  },
  session: LearningSession,
): {
  player: PlayerStats
  daily: PeriodStats
  monthly: PeriodStats
  date: string
  month: string
}
```

- `LearningSession` gains these optional fields:
  - `localDate?: string`
  - `timeZone?: string`
  - `typingSeconds?: number`
  - `learningSeconds?: number`
  - `charactersTyped?: number`
  - `wordsPracticed?: number`
  - `sentencesPracticed?: number`
  - `exerciseMistakes?: number[]`
  - `isReplay?: boolean`

- [ ] **Step 1: Add the optional fields to `LearningSession`** in `learning-session.ts`, each with a one-line comment such as `// Player stats (DEC-049); absent on sessions before it.`
- [ ] **Step 2: Write the failing tests** (`player-stats.test.ts`)

```ts
import { describe, expect, it } from 'vitest'
import type { LearningSession } from './learning-session'
import {
  applySessionStats,
  emptyPeriodStats,
  emptyPlayerStats,
  localDateIn,
  periodStatsFrom,
  sessionStatsFrom,
} from './player-stats'

const at = (iso: string) => new Date(iso)
const stat = (targetText: string, mistakeCount = 0) => ({
  targetText,
  mistakeCount,
  typingSeconds: 2,
  elapsedSeconds: 3,
})

function session(overrides: Partial<LearningSession> = {}): LearningSession {
  return {
    id: 's1',
    context: { mode: 'learning-path', lessonId: 'l1' },
    startedAt: at('2026-10-09T01:00:00Z'),
    completedAt: at('2026-10-09T01:05:00Z'),
    durationSeconds: 300,
    exercisesAttempted: 2,
    acceptedKeystrokes: 20,
    rejectedKeystrokes: 0,
    expGained: 25,
    localDate: '2026-10-09',
    typingSeconds: 60,
    charactersTyped: 4,
    wordsPracticed: 2,
    sentencesPracticed: 0,
    exerciseMistakes: [0, 0],
    ...overrides,
  }
}

const fresh = {
  player: undefined,
  daily: null,
  monthly: null,
  profileTimeZone: 'Asia/Bangkok',
}

describe('localDateIn', () => {
  it('uses the zone, not UTC, across midnight', () => {
    expect(localDateIn(at('2026-10-09T17:30:00Z'), 'Asia/Bangkok')).toBe(
      '2026-10-10',
    )
    expect(localDateIn(at('2026-10-09T17:30:00Z'), 'UTC')).toBe('2026-10-09')
  })
})

describe('sessionStatsFrom', () => {
  it('counts Hangul syllables without spaces and words for word lessons', () => {
    const stats = sessionStatsFrom(
      [stat('사과'), stat('안녕 하세요', 1)],
      'word',
      'Asia/Bangkok',
      at('2026-10-09T01:00:00Z'),
    )
    expect(stats).toEqual({
      localDate: '2026-10-09',
      timeZone: 'Asia/Bangkok',
      typingSeconds: 4,
      charactersTyped: 7,
      wordsPracticed: 2,
      sentencesPracticed: 0,
      exerciseMistakes: [0, 1],
    })
  })

  it('counts phrase and sentence lessons as sentences', () => {
    expect(
      sessionStatsFrom(
        [stat('가')],
        'phrase',
        'UTC',
        at('2026-10-09T00:00:00Z'),
      ).sentencesPracticed,
    ).toBe(1)
  })

  it('uses per-exercise lesson types (review) and counts only characters when absent', () => {
    const stats = sessionStatsFrom(
      [{ ...stat('가'), lessonType: 'sentence' }, stat('나')],
      undefined,
      'UTC',
      at('2026-10-09T00:00:00Z'),
    )
    expect(stats).toMatchObject({
      charactersTyped: 2,
      wordsPracticed: 0,
      sentencesPracticed: 1,
    })
  })
})

describe('periodStatsFrom', () => {
  it('maps a perfect first-time lesson', () => {
    expect(periodStatsFrom(session())).toEqual({
      ...emptyPeriodStats(),
      expEarned: 25,
      lessonsCompleted: 1,
      perfectLessons: 1,
      correctKeystrokes: 20,
      charactersTyped: 4,
      wordsPracticed: 2,
      typingSeconds: 60,
      learningSeconds: 300,
    })
  })

  it('counts a replay as completed and replayed; a review as neither', () => {
    expect(periodStatsFrom(session({ isReplay: true }))).toMatchObject({
      lessonsCompleted: 1,
      lessonsReplayed: 1,
    })
    expect(
      periodStatsFrom(
        session({ context: { mode: 'review' }, rejectedKeystrokes: 0 }),
      ),
    ).toMatchObject({
      lessonsCompleted: 0,
      reviewsCompleted: 1,
      perfectLessons: 0,
    })
  })

  it('prefers learningSeconds over durationSeconds', () => {
    expect(
      periodStatsFrom(session({ learningSeconds: 40 })).learningSeconds,
    ).toBe(40)
  })
})

describe('applySessionStats', () => {
  it('starts a streak and an active day on the first session', () => {
    const next = applySessionStats(fresh, session())
    expect(next).toMatchObject({ date: '2026-10-09', month: '2026-10' })
    expect(next.player).toMatchObject({
      activeDays: 1,
      streak: { current: 1, longest: 1, lastActiveDate: '2026-10-09' },
      perfectStreak: { current: 2, longest: 2 },
      records: {
        mostExpDay: { value: 25, period: '2026-10-09' },
        mostExpMonth: { value: 25, period: '2026-10' },
        mostLessonsDay: { value: 1, period: '2026-10-09' },
      },
    })
  })

  it('keeps the streak on the same day and adds to the daily doc', () => {
    const first = applySessionStats(fresh, session())
    const second = applySessionStats(
      {
        ...fresh,
        player: first.player,
        daily: first.daily,
        monthly: first.monthly,
      },
      session({ id: 's2' }),
    )
    expect(second.player.activeDays).toBe(1)
    expect(second.player.streak.current).toBe(1)
    expect(second.daily.expEarned).toBe(50)
    expect(second.player.records.mostExpDay).toEqual({
      value: 50,
      period: '2026-10-09',
    })
  })

  it('extends on the next day, resets after a gap, keeps the longest', () => {
    const one = applySessionStats(fresh, session())
    const two = applySessionStats(
      { ...fresh, player: one.player },
      session({ localDate: '2026-10-10' }),
    )
    expect(two.player.streak).toEqual({
      current: 2,
      longest: 2,
      lastActiveDate: '2026-10-10',
    })
    const gap = applySessionStats(
      { ...fresh, player: two.player },
      session({ localDate: '2026-10-13' }),
    )
    expect(gap.player.streak).toEqual({
      current: 1,
      longest: 2,
      lastActiveDate: '2026-10-13',
    })
  })

  it('adds a late session to its day without touching the streak', () => {
    const today = applySessionStats(fresh, session({ localDate: '2026-10-09' }))
    const late = applySessionStats(
      { ...fresh, player: today.player },
      session({ localDate: '2026-10-05' }),
    )
    expect(late.date).toBe('2026-10-05')
    expect(late.player.streak).toEqual(today.player.streak)
    expect(late.player.activeDays).toBe(2)
  })

  it('continues the perfect streak across sessions and resets on a mistake', () => {
    const one = applySessionStats(fresh, session({ exerciseMistakes: [0, 0] }))
    const two = applySessionStats(
      { ...fresh, player: one.player },
      session({ exerciseMistakes: [0, 2, 0] }),
    )
    expect(two.player.perfectStreak).toEqual({ current: 1, longest: 3 })
  })

  it('treats a session without stats fields as zero and dates it from completedAt', () => {
    const legacy = session({
      localDate: undefined,
      typingSeconds: undefined,
      charactersTyped: undefined,
      wordsPracticed: undefined,
      sentencesPracticed: undefined,
      exerciseMistakes: undefined,
      completedAt: at('2026-10-09T17:30:00Z'),
    })
    const next = applySessionStats(fresh, legacy)
    expect(next.date).toBe('2026-10-10')
    expect(next.daily.typingSeconds).toBe(0)
    expect(Number.isNaN(next.daily.charactersTyped)).toBe(false)
  })
})
```

- [ ] **Step 3: Run, expect FAIL**

Run: `pnpm vitest run src/domain/models/player-stats.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 4: Implement `player-stats.ts`**

```ts
import type { LessonType } from './lesson'
import type { LearningSession } from './learning-session'

// Player stats (DEC-049): per-session inputs and the pure fold that keeps
// lifetime state, daily docs, and monthly docs. Every adapter calls
// applySessionStats inside its receipt-deduped submit transaction.

export interface ExerciseStat {
  targetText: string
  mistakeCount: number
  typingSeconds: number
  elapsedSeconds: number
  // Set per exercise only when a session mixes lessons (Review).
  lessonType?: LessonType
}

export interface PeriodStats {
  expEarned: number
  lessonsCompleted: number
  lessonsReplayed: number
  reviewsCompleted: number
  perfectLessons: number
  correctKeystrokes: number
  incorrectKeystrokes: number
  charactersTyped: number
  wordsPracticed: number
  sentencesPracticed: number
  typingSeconds: number
  learningSeconds: number
}

export interface DatedRecord {
  value: number
  // 'YYYY-MM-DD' for day records, 'YYYY-MM' for month records.
  period: string
}

export interface PlayerStats {
  activeDays: number
  streak: { current: number; longest: number; lastActiveDate: string | null }
  perfectStreak: { current: number; longest: number }
  records: {
    mostExpDay: DatedRecord | null
    mostExpMonth: DatedRecord | null
    mostLessonsDay: DatedRecord | null
  }
}

export type SessionStats = Required<
  Pick<
    LearningSession,
    | 'localDate'
    | 'timeZone'
    | 'typingSeconds'
    | 'charactersTyped'
    | 'wordsPracticed'
    | 'sentencesPracticed'
    | 'exerciseMistakes'
  >
>

export const FALLBACK_TIME_ZONE = 'Asia/Bangkok'

export function deviceTimeZone(): string {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE
    )
  } catch {
    return FALLBACK_TIME_ZONE
  }
}

/** Calendar date ('YYYY-MM-DD') of `date` in `timeZone`. */
export function localDateIn(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const part = (type: string) => parts.find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

const HANGUL_SYLLABLE = /[가-힣]/gu
const syllableCount = (text: string) => text.match(HANGUL_SYLLABLE)?.length ?? 0

export function sessionStatsFrom(
  exercises: ExerciseStat[],
  lessonType: LessonType | undefined,
  timeZone: string,
  completedAt: Date,
): SessionStats {
  const typeOf = (exercise: ExerciseStat) => exercise.lessonType ?? lessonType
  return {
    localDate: localDateIn(completedAt, timeZone),
    timeZone,
    typingSeconds: exercises.reduce((sum, e) => sum + e.typingSeconds, 0),
    charactersTyped: exercises.reduce(
      (sum, e) => sum + syllableCount(e.targetText),
      0,
    ),
    wordsPracticed: exercises.filter((e) => typeOf(e) === 'word').length,
    sentencesPracticed: exercises.filter((e) => {
      const type = typeOf(e)
      return type === 'phrase' || type === 'sentence'
    }).length,
    exerciseMistakes: exercises.map((e) => e.mistakeCount),
  }
}

export const emptyPeriodStats = (): PeriodStats => ({
  expEarned: 0,
  lessonsCompleted: 0,
  lessonsReplayed: 0,
  reviewsCompleted: 0,
  perfectLessons: 0,
  correctKeystrokes: 0,
  incorrectKeystrokes: 0,
  charactersTyped: 0,
  wordsPracticed: 0,
  sentencesPracticed: 0,
  typingSeconds: 0,
  learningSeconds: 0,
})

export const emptyPlayerStats = (): PlayerStats => ({
  activeDays: 0,
  streak: { current: 0, longest: 0, lastActiveDate: null },
  perfectStreak: { current: 0, longest: 0 },
  records: { mostExpDay: null, mostExpMonth: null, mostLessonsDay: null },
})

export function periodStatsFrom(session: LearningSession): PeriodStats {
  const isReview = session.context.mode === 'review'
  const isLesson = !isReview
  return {
    expEarned: session.expGained,
    lessonsCompleted: isLesson ? 1 : 0,
    lessonsReplayed: isLesson && session.isReplay ? 1 : 0,
    reviewsCompleted: isReview ? 1 : 0,
    perfectLessons: isLesson && session.rejectedKeystrokes === 0 ? 1 : 0,
    correctKeystrokes: session.acceptedKeystrokes,
    incorrectKeystrokes: session.rejectedKeystrokes,
    charactersTyped: session.charactersTyped ?? 0,
    wordsPracticed: session.wordsPracticed ?? 0,
    sentencesPracticed: session.sentencesPracticed ?? 0,
    typingSeconds: session.typingSeconds ?? 0,
    learningSeconds: session.learningSeconds ?? session.durationSeconds,
  }
}

function addPeriod(
  current: PeriodStats | null,
  next: PeriodStats,
): PeriodStats {
  const base = { ...emptyPeriodStats(), ...current }
  return Object.fromEntries(
    Object.entries(next).map(([key, value]) => [
      key,
      (base[key as keyof PeriodStats] ?? 0) + value,
    ]),
  ) as unknown as PeriodStats
}

const dayAfter = (date: string) => {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

function nextStreak(
  streak: PlayerStats['streak'],
  date: string,
): PlayerStats['streak'] {
  const last = streak.lastActiveDate
  if (last !== null && date <= last) return streak
  const current =
    last !== null && date === dayAfter(last) ? streak.current + 1 : 1
  return {
    current,
    longest: Math.max(streak.longest, current),
    lastActiveDate: date,
  }
}

function nextPerfectStreak(
  streak: PlayerStats['perfectStreak'],
  mistakes: number[],
): PlayerStats['perfectStreak'] {
  let { current, longest } = streak
  for (const count of mistakes) {
    current = count === 0 ? current + 1 : 0
    longest = Math.max(longest, current)
  }
  return { current, longest }
}

const higher = (
  record: DatedRecord | null,
  value: number,
  period: string,
): DatedRecord | null =>
  value > 0 && value > (record?.value ?? 0) ? { value, period } : record

export function applySessionStats(
  current: {
    player: PlayerStats | undefined
    daily: PeriodStats | null
    monthly: PeriodStats | null
    profileTimeZone: string | undefined
  },
  session: LearningSession,
): {
  player: PlayerStats
  daily: PeriodStats
  monthly: PeriodStats
  date: string
  month: string
} {
  const date =
    session.localDate ??
    localDateIn(
      session.completedAt,
      current.profileTimeZone ?? session.timeZone ?? FALLBACK_TIME_ZONE,
    )
  const month = date.slice(0, 7)
  const period = periodStatsFrom(session)
  const daily = addPeriod(current.daily, period)
  const monthly = addPeriod(current.monthly, period)
  const player = { ...emptyPlayerStats(), ...current.player }
  return {
    date,
    month,
    daily,
    monthly,
    player: {
      activeDays: player.activeDays + (current.daily ? 0 : 1),
      streak: nextStreak(player.streak, date),
      perfectStreak: nextPerfectStreak(
        player.perfectStreak,
        session.exerciseMistakes ?? [],
      ),
      records: {
        mostExpDay: higher(player.records.mostExpDay, daily.expEarned, date),
        mostExpMonth: higher(
          player.records.mostExpMonth,
          monthly.expEarned,
          month,
        ),
        mostLessonsDay: higher(
          player.records.mostLessonsDay,
          daily.lessonsCompleted,
          date,
        ),
      },
    },
  }
}
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm vitest run src/domain/models/player-stats.test.ts`

- [ ] **Step 6: Suggested commit** — `feat(stats): add player stats domain fold`

---

### Task 3: Session aggregate, profile fields, and merge rule

**Files:**

- Modify: `src/domain/models/session-aggregate.ts`
- Modify: `src/domain/models/user-profile.ts`
- Modify: `src/domain/models/guest-migration.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-user-profile-repository.ts`
- Test: `src/domain/models/session-aggregate.test.ts` (create if absent), `src/domain/models/guest-migration.test.ts`

**Interfaces:**

- Consumes: `LearningSession` stats fields (Task 2), `PlayerStats` (Task 2).
- Produces:
  - `SessionAggregate` gains these optional fields:
    - `lessonsCompleted?`, `lessonsReplayed?`, `reviewsCompleted?`, `perfectLessons?`
    - `charactersTyped?`, `wordsPracticed?`, `sentencesPracticed?`, `typingSeconds?`
    - `longestSessionSeconds?`, `bestWpm?`
  - `UserProfile` gains `timezone?: string` and `playerStats?: PlayerStats`.

- [ ] **Step 1: Write the failing tests**

```ts
// session-aggregate.test.ts
import { describe, expect, it } from 'vitest'
import {
  addSessionAggregate,
  aggregateFromSession,
  emptySessionAggregate,
} from './session-aggregate'
import type { LearningSession } from './learning-session'

const base: LearningSession = {
  id: 's1',
  context: { mode: 'learning-path', lessonId: 'l1' },
  startedAt: new Date(0),
  completedAt: new Date(300_000),
  durationSeconds: 300,
  exercisesAttempted: 2,
  acceptedKeystrokes: 50,
  rejectedKeystrokes: 0,
  expGained: 25,
  typingSeconds: 60,
  learningSeconds: 120,
  charactersTyped: 4,
  wordsPracticed: 2,
  sentencesPracticed: 0,
  isReplay: true,
}

describe('session aggregate stats', () => {
  it('derives the new counters from a session', () => {
    expect(aggregateFromSession(base)).toMatchObject({
      lessonsCompleted: 1,
      lessonsReplayed: 1,
      reviewsCompleted: 0,
      perfectLessons: 1,
      charactersTyped: 4,
      wordsPracticed: 2,
      typingSeconds: 60,
      totalTypingTimeSeconds: 120, // Learning Time: learningSeconds wins
      longestSessionSeconds: 120,
      bestWpm: 10, // 50 / 5 / (60 / 60)
    })
  })

  it('adds onto a legacy aggregate without the new fields', () => {
    const legacy = {
      exp: 5,
      exercisesAttempted: 1,
      acceptedKeystrokes: 1,
      rejectedKeystrokes: 0,
      totalTypingTimeSeconds: 9,
      bestAccuracy: 50,
    }
    const sum = addSessionAggregate(legacy, aggregateFromSession(base))
    expect(sum).toMatchObject({
      lessonsCompleted: 1,
      typingSeconds: 60,
      bestWpm: 10,
      longestSessionSeconds: 120,
    })
    expect(Object.values(sum).some((value) => Number.isNaN(value))).toBe(false)
  })

  it('keeps the max for best WPM and the longest session', () => {
    const first = aggregateFromSession(base)
    const slower = aggregateFromSession({
      ...base,
      typingSeconds: 600,
      learningSeconds: 30,
    })
    expect(addSessionAggregate(first, slower)).toMatchObject({
      bestWpm: 10,
      longestSessionSeconds: 120,
    })
  })

  it('reports zero WPM when no typing time was measured', () => {
    expect(
      aggregateFromSession({ ...base, typingSeconds: undefined }).bestWpm,
    ).toBe(0)
    expect(emptySessionAggregate().bestWpm).toBe(0)
  })
})
```

Append to `guest-migration.test.ts` (use the file's existing profile fixture helper):

```ts
it('keeps the cloud timezone and player stats; falls back to the guest timezone', () => {
  const cloud = {
    ...cloudProfile,
    timezone: 'Asia/Seoul',
    playerStats: { ...emptyPlayerStats(), activeDays: 3 },
  }
  const guest = {
    ...guestProfile,
    timezone: 'Asia/Bangkok',
    playerStats: { ...emptyPlayerStats(), activeDays: 9 },
  }
  expect(mergeProfile(cloud, guest)).toMatchObject({
    timezone: 'Asia/Seoul',
    playerStats: { activeDays: 3 },
  })
  expect(
    mergeProfile({ ...cloudProfile, timezone: undefined }, guest)?.timezone,
  ).toBe('Asia/Bangkok')
})
```

(Guest `playerStats` is never merged: each Guest session is re-applied by `migrateSessionOutcome` (Task 9). Merging it here as well would count it twice.)

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm vitest run src/domain/models/session-aggregate.test.ts src/domain/models/guest-migration.test.ts`

- [ ] **Step 3: Implement**

- `session-aggregate.ts`: add the optional fields to `SessionAggregate` and set all of them to `0` in `emptySessionAggregate`.
- `aggregateFromSession`:
  - Widen its `Pick` to the whole `LearningSession`.
  - Use `periodStatsFrom(session)` (Task 2) for the sums.
  - Set `totalTypingTimeSeconds: session.learningSeconds ?? session.durationSeconds`.
  - Set `longestSessionSeconds` to the same value.
  - Set `bestWpm: (session.typingSeconds ?? 0) > 0 ? session.acceptedKeystrokes / 5 / (session.typingSeconds! / 60) : 0`.
- `addSessionAggregate`: sum each new counter as `(current.x ?? 0) + (next.x ?? 0)`, and use `Math.max(current.x ?? 0, next.x ?? 0)` for `longestSessionSeconds` and `bestWpm`.
- Add a comment over `totalTypingTimeSeconds`: `// Learning Time: session length (DEC-049). Typing Time is typingSeconds.`
- `user-profile.ts`: add `timezone?: string` and `playerStats?: PlayerStats` to `UserProfile`.
- `guest-migration.ts` `mergeProfile`: set `timezone: cloud.timezone ?? guest.timezone` (`...cloud` already keeps `playerStats`).
- `firebase-user-profile-repository.ts`:
  - `toUserProfile` reads `timezone` (string or undefined) and `playerStats` (as `PlayerStats | undefined`).
  - `toUserProfileDoc` spreads both only when defined, in the same style as `legacyBaseline`.

- [ ] **Step 4: Run, expect PASS** (same command)
- [ ] **Step 5: Suggested commit** — `feat(stats): extend session aggregate and profile with player stats`

---

### Task 4: Firestore submit applies stats (+ Rules, emulator test)

**Files:**

- Create: `src/infrastructure/firebase/repositories/firestore-player-stats.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-session-submission-repository.ts`
- Modify: `firestore.rules`, `package.json` (`test:rules` file list)
- Create: `src/infrastructure/firebase/repositories/firebase-session-submission-repository.emulator.test.ts`
- Test (existing fake-transaction test must still pass): `firebase-session-submission-repository.test.ts`

**Interfaces:**

- Consumes: `applySessionStats`, `PeriodStats`, `PlayerStats` (Task 2).
- Produces:

```ts
type StatsTransaction = Pick<Transaction, 'get' | 'set'>
// Reads the day/month docs; returns the writes to apply after all reads.
export async function readSessionStatsWrites(
  deps: { db: Firestore; doc: typeof doc },
  transaction: StatsTransaction,
  userId: string,
  profileData: Record<string, unknown> | undefined,
  session: LearningSession,
): Promise<(transaction: StatsTransaction) => Record<string, unknown>> // returns profile fields to merge
```

Firestore transactions require every read before the first write. The helper therefore does its reads first, then returns a writer. The writer sets the day and month docs and returns the profile fields (`playerStats`, and `timezone` when unset) for the caller to merge into its existing profile `set`.

- [ ] **Step 1: Confirm the Rules change with the user.** Stop and ask: "Task 4 adds owner-only `dailyStats/{date}` and `monthlyStats/{month}` matches to `firestore.rules` (same rule as `learningSessions`). OK to edit?" Continue only after an explicit yes.
- [ ] **Step 2: Write the failing emulator test** (copy the setup block from `firebase-admin-content-repository.emulator.test.ts` with `projectId: 'jamozy-stats-test'`)

```ts
function learnerRepository(uid = 'learner-1') {
  const firestore = testEnvironment
    .authenticatedContext(uid)
    .firestore() as unknown as Firestore
  return {
    firestore,
    repo: new FirebaseSessionSubmissionRepository({
      db: firestore,
      doc,
      runTransaction,
    }),
  }
}

const session: LearningSession = {
  id: 'session-1',
  context: { mode: 'learning-path', lessonId: 'lesson-1' },
  startedAt: new Date('2026-10-09T01:00:00Z'),
  completedAt: new Date('2026-10-09T01:05:00Z'),
  durationSeconds: 300,
  exercisesAttempted: 2,
  acceptedKeystrokes: 20,
  rejectedKeystrokes: 0,
  expGained: 25,
  localDate: '2026-10-09',
  timeZone: 'Asia/Bangkok',
  typingSeconds: 60,
  charactersTyped: 4,
  wordsPracticed: 2,
  sentencesPracticed: 0,
  exerciseMistakes: [0, 0],
}
const noEffects = { progress: [], reviewItems: [] }

it('writes daily, monthly, and profile stats once per session ID', async () => {
  const { firestore, repo } = learnerRepository()
  await repo.submit('learner-1', session, noEffects)
  await repo.submit('learner-1', session, noEffects) // retry

  const daily = (
    await getDoc(doc(firestore, 'users/learner-1/dailyStats/2026-10-09'))
  ).data()
  const monthly = (
    await getDoc(doc(firestore, 'users/learner-1/monthlyStats/2026-10'))
  ).data()
  const profile = (await getDoc(doc(firestore, 'users/learner-1'))).data()
  expect(daily).toMatchObject({
    expEarned: 25,
    lessonsCompleted: 1,
    perfectLessons: 1,
    typingSeconds: 60,
  })
  expect(monthly).toMatchObject({ expEarned: 25 })
  expect(profile).toMatchObject({
    timezone: 'Asia/Bangkok',
    playerStats: {
      activeDays: 1,
      streak: { current: 1, lastActiveDate: '2026-10-09' },
    },
    sessionAggregate: { lessonsCompleted: 1, typingSeconds: 60 },
  })
})

it('adds a second session on the same day into the same docs', async () => {
  const { firestore, repo } = learnerRepository()
  await repo.submit('learner-1', session, noEffects)
  await repo.submit('learner-1', { ...session, id: 'session-2' }, noEffects)
  const daily = (
    await getDoc(doc(firestore, 'users/learner-1/dailyStats/2026-10-09'))
  ).data()
  expect(daily).toMatchObject({ expEarned: 50, lessonsCompleted: 2 })
})

it('lets only the owner read stats docs', async () => {
  const { repo } = learnerRepository()
  await repo.submit('learner-1', session, noEffects)
  const other = testEnvironment
    .authenticatedContext('learner-2')
    .firestore() as unknown as Firestore
  await assertFails(getDoc(doc(other, 'users/learner-1/dailyStats/2026-10-09')))
  await assertFails(getDoc(doc(other, 'users/learner-1/monthlyStats/2026-10')))
})
```

Add the new file to `test:rules` in `package.json` after the admin emulator test path.

- [ ] **Step 3: Run, expect FAIL**

Run: `pnpm test:rules`
Expected: the new tests FAIL (no stats docs / permission denied). The existing 17 tests pass.

- [ ] **Step 4: Implement**

`firestore.rules`, inside `match /users/{userId}`:

```
      match /dailyStats/{date} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }

      match /monthlyStats/{month} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
```

`firestore-player-stats.ts`:

```ts
import type { doc as docFn, Firestore, Transaction } from 'firebase/firestore'
import {
  applySessionStats,
  type PeriodStats,
  type PlayerStats,
} from '../../../domain/models/player-stats'
import type { LearningSession } from '../../../domain/models/learning-session'

type StatsTransaction = Pick<Transaction, 'get' | 'set'>

// Player stats (DEC-049) inside a submit or migration transaction. Reads
// first; the returned writer sets the day/month docs and returns the profile
// fields to merge, so callers keep Firestore's reads-before-writes rule.
export async function readSessionStatsWrites(
  deps: { db: Firestore; doc: typeof docFn },
  transaction: StatsTransaction,
  userId: string,
  profileData: Record<string, unknown> | undefined,
  session: LearningSession,
) {
  const { db, doc } = deps
  const profileTimeZone =
    typeof profileData?.timezone === 'string' ? profileData.timezone : undefined
  // Old sessions have no localDate; applySessionStats derives the same date
  // and month, so ask it for the doc IDs before reading them.
  const preview = applySessionStats(
    { player: undefined, daily: null, monthly: null, profileTimeZone },
    session,
  )
  const dailyRef = doc(db, 'users', userId, 'dailyStats', preview.date)
  const monthlyRef = doc(db, 'users', userId, 'monthlyStats', preview.month)
  const [daily, monthly] = await Promise.all([
    transaction.get(dailyRef),
    transaction.get(monthlyRef),
  ])
  const next = applySessionStats(
    {
      player: profileData?.playerStats as PlayerStats | undefined,
      daily: daily.exists() ? (daily.data() as PeriodStats) : null,
      monthly: monthly.exists() ? (monthly.data() as PeriodStats) : null,
      profileTimeZone,
    },
    session,
  )
  return (writer: StatsTransaction): Record<string, unknown> => {
    writer.set(dailyRef, next.daily)
    writer.set(monthlyRef, next.monthly)
    return {
      playerStats: next.player,
      ...(profileTimeZone || !session.timeZone
        ? {}
        : { timezone: session.timeZone }),
    }
  }
}
```

`firebase-session-submission-repository.ts` `submit`:

- After `const profileValues = profileData.data()` and before the first `transaction.set`, add:
  ```ts
  const writeStats = await readSessionStatsWrites(
    { db, doc },
    transaction,
    userId,
    profileValues,
    session,
  )
  ```
- Then change `profileUpdate` to `{ sessionAggregate: ..., ...writeStats(transaction) }`.
- Fix `readOutcome` so a duplicate keeps the new fields: rebuild `session` from `{ ...raw, startedAt: (raw.startedAt as Timestamp).toDate(), completedAt: (raw.completedAt as Timestamp).toDate() } as LearningSession`, instead of listing fields one by one.
- Update the existing fake in `firebase-session-submission-repository.test.ts` only if it breaks. Its `doc` already joins paths, and its `get` returns `exists: false` for unknown refs, so it should keep working.

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm test:rules` and `pnpm vitest run src/infrastructure/firebase/repositories/firebase-session-submission-repository.test.ts`

- [ ] **Step 6: Suggested commit** — `feat(stats): record player stats in the Firestore submit transaction`

---

### Task 5: Guest IndexedDB submit applies stats

**Files:**

- Modify: `src/infrastructure/local/guest-database.ts`
- Test: `src/infrastructure/local/guest-database-stats.test.ts` (create; tests the pure helper)

**Interfaces:**

- Consumes: `applySessionStats` (Task 2).
- Produces: `guestStatsWrites(profile: UserProfile | undefined, daily: PeriodStats | null, monthly: PeriodStats | null, session: LearningSession): { date: string; month: string; daily: PeriodStats; monthly: PeriodStats; profile: Pick<UserProfile, 'playerStats' | 'timezone'> }`. It is exported from `guest-database.ts` so tests can call it without IndexedDB, because this repo has no IndexedDB test double.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { guestStatsWrites } from './guest-database'
import { defaultUserProfile } from '../../domain/models/user-profile'

const session = {
  id: 's1',
  context: { mode: 'review' as const },
  startedAt: new Date('2026-10-09T01:00:00Z'),
  completedAt: new Date('2026-10-09T01:01:00Z'),
  durationSeconds: 60,
  exercisesAttempted: 1,
  acceptedKeystrokes: 5,
  rejectedKeystrokes: 1,
  expGained: 0,
  localDate: '2026-10-09',
  timeZone: 'Asia/Bangkok',
  exerciseMistakes: [1],
}

describe('guestStatsWrites', () => {
  it('fills the timezone once and counts a review day', () => {
    const profile = defaultUserProfile('guest-1', new Date(0))
    const writes = guestStatsWrites(profile, null, null, session)
    expect(writes.profile.timezone).toBe('Asia/Bangkok')
    expect(writes.daily).toMatchObject({
      reviewsCompleted: 1,
      incorrectKeystrokes: 1,
    })
    expect(writes.profile.playerStats).toMatchObject({
      activeDays: 1,
      perfectStreak: { current: 0 },
    })
    const kept = guestStatsWrites(
      { ...profile, timezone: 'Asia/Seoul' },
      writes.daily,
      writes.monthly,
      session,
    )
    expect(kept.profile.timezone).toBe('Asia/Seoul')
  })
})
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/infrastructure/local/guest-database-stats.test.ts`
- [ ] **Step 3: Implement**

- Set `VERSION = 7` and add `'dailyStats', 'monthlyStats'` to `stores`. The existing `onupgradeneeded` already creates missing stores.
- Export:

```ts
export function guestStatsWrites(
  profile: UserProfile | undefined,
  daily: PeriodStats | null,
  monthly: PeriodStats | null,
  session: LearningSession,
) {
  const next = applySessionStats(
    {
      player: profile?.playerStats,
      daily,
      monthly,
      profileTimeZone: profile?.timezone,
    },
    session,
  )
  return {
    date: next.date,
    month: next.month,
    daily: next.daily,
    monthly: next.monthly,
    profile: {
      playerStats: next.player,
      timezone: profile?.timezone ?? session.timeZone,
    },
  }
}
```

- `putSessionOnce` changes:
  - Change the `session` parameter type to `LearningSession`.
  - Add `'dailyStats', 'monthlyStats'` to the transaction's store list.
  - Inside `profile.onsuccess`, first compute the date with the same rule (`session.localDate ?? localDateIn(session.completedAt, currentProfile?.timezone ?? session.timeZone ?? FALLBACK_TIME_ZONE)`).
  - Issue `get` on `dailyStats` (`${userId}:${date}`) and `monthlyStats` (`${userId}:${date.slice(0, 7)}`), nesting the second `get` in the first `onsuccess`.
  - Then call `guestStatsWrites`. Put the daily and monthly docs, and add `playerStats` and `timezone` to the existing profile `put` object.
  - Keep every write inside the same transaction. Move the existing session/outcome/progress/reviewItems writes into the innermost callback so they stay atomic with the stats.
- `LocalSessionSubmissionRepository` already passes `session`; no change is needed beyond the type.

- [ ] **Step 4: Run, expect PASS** — the same test plus `pnpm vitest run src/infrastructure/local/local-session-submission-repository.test.ts`
- [ ] **Step 5: Suggested commit** — `feat(stats): record player stats for Guest sessions in IndexedDB`

---

### Task 6: Learning Path (and one-page) sessions carry stats

**Files:**

- Modify: `src/application/complete-lesson-session.ts`
- Modify: `src/features/lesson/LessonTypingSession.tsx` (send `exercises` in the payload)
- Modify: `src/application/save-one-page-checkpoint.ts`, `src/domain/models/one-page-learning-checkpoint.ts`
- Test: `src/application/complete-lesson-session.test.ts`, `src/application/save-one-page-checkpoint.test.ts`

**Interfaces:**

- Consumes: `LessonResult.exercises` (Task 1), `sessionStatsFrom`, `deviceTimeZone` (Task 2), `UserProfile.timezone` (Task 3).
- Produces: the Learning Path `LearningSession` with stats, `isReplay`, and `ReviewItem.sourceLessonType` on new review items.

- [ ] **Step 1: Write the failing tests** (append to `complete-lesson-session.test.ts`, reusing its existing deps/fake setup and lesson fixture whose `type` is set; read the submitted session from the fake submission repo the file already inspects)

```ts
it('submits session stats from the lesson result and lesson type', async () => {
  // fixture lesson type 'word'; profile timezone 'Asia/Bangkok'
  const result = {
    ...lessonResult,
    rejectedKeystrokes: 1,
    exercises: [
      {
        targetText: '사과',
        mistakeCount: 0,
        typingSeconds: 2,
        elapsedSeconds: 3,
      },
      {
        targetText: '바나나',
        mistakeCount: 1,
        typingSeconds: 4,
        elapsedSeconds: 5,
      },
    ],
  }
  await completeLessonSession(
    deps,
    'user-1',
    'lesson-1',
    result,
    'sub-1',
    new Date('2026-10-09T17:30:00Z'),
  )
  expect(submittedSession()).toMatchObject({
    localDate: '2026-10-10',
    timeZone: 'Asia/Bangkok',
    typingSeconds: 6,
    charactersTyped: 5,
    wordsPracticed: 2,
    exerciseMistakes: [0, 1],
    isReplay: false,
  })
})

it('marks a completed lesson replay', async () => {
  await progressRepo.saveProgress('user-1', {
    ...completedProgress,
    lessonId: 'lesson-1',
  })
  await completeLessonSession(deps, 'user-1', 'lesson-1', lessonResult, 'sub-2')
  expect(submittedSession().isReplay).toBe(true)
})

it('tags new review items with the source lesson type', async () => {
  await completeLessonSession(
    deps,
    'user-1',
    'lesson-1',
    {
      ...lessonResult,
      mistakes: [{ sourceExerciseId: 'e1', targetText: '사과' }],
    },
    'sub-3',
  )
  expect(submittedEffects().reviewItems[0].sourceLessonType).toBe('word')
})
```

In `save-one-page-checkpoint.test.ts`, assert that `getCheckpointedLessonCompletion(...).result.exercises` lists the recorded exercises in order with `mistakeCount` and `typingSeconds`.

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/application/complete-lesson-session.test.ts src/application/save-one-page-checkpoint.test.ts`
- [ ] **Step 3: Implement**

- `review-item.ts`: add `sourceLessonType?: LessonType` to `ReviewItem`. Also add it in `firebase-review-repository.ts` `toReviewItem`/`toReviewItemDoc`, spreading only when defined.
- `complete-lesson-session.ts`:
  - Move the profile read before building the session.
  - Read the lesson with `deps.lessonRepo.getLessonById(lessonId)`; it is optional, and `lessonType` is `lesson?.type`.
  - Build the session with:
    ```ts
    ...sessionStatsFrom(result.exercises ?? [], lesson?.type, profile.timezone ?? deviceTimeZone(), now),
    isReplay: wasAlreadyCompleted,
    ```
  - Pass `lesson?.type` into `reviewEffects` and set `sourceLessonType` on newly created items only. Existing items keep their stored value: use `...existing` plus `sourceLessonType: existing.sourceLessonType ?? lessonType`.
- `LessonTypingSession.tsx`: add `exercises: result.exercises` to `submittedPayload.current`.
- `one-page-learning-checkpoint.ts`: add `exercises?: ExerciseStat[]` to `OnePagePartialLessonResult`.
  - In `recordOnePageExercise`, append `{ targetText, mistakeCount: result.mistakes.length, typingSeconds: result.typingSeconds ?? 0, elapsedSeconds: result.elapsedSeconds ?? 0 }`.
  - In `lessonResult(partial, now)`, return `exercises: partial.exercises ?? []`.

- [ ] **Step 4: Run, expect PASS** (same command)
- [ ] **Step 5: Suggested commit** — `feat(stats): send Learning Path session stats`

---

### Task 7: Review sessions carry stats

**Files:**

- Modify: `src/application/submit-review-session.ts`
- Modify: `src/features/review/ReviewPage.action.ts` (schema + deps)
- Modify: `src/features/review/ReviewTypingSession.tsx` (payload)
- Modify: the review route wiring that calls `createSubmitReviewSessionAction` (pass `userProfileRepo`; find it with `grep -rn createSubmitReviewSessionAction src/app`)
- Test: `src/application/submit-review-session.test.ts`

**Interfaces:**

- Consumes: `sessionStatsFrom`, `deviceTimeZone`, `ReviewItem.sourceLessonType`.
- Produces: `SubmitReviewSessionResult` gains `mistakeCount?: number`, `typingSeconds?: number`, and `elapsedSeconds?: number`. The deps gain `userProfileRepo?: UserProfileRepository`.

- [ ] **Step 1: Write the failing test**

```ts
it("submits stats using each review item's lesson type", async () => {
  // seed item 'a' with sourceLessonType 'sentence' and targetText '안녕 하세요', item 'b' without a type, targetText '가'
  await submitReviewSession(
    deps,
    'user-1',
    {
      ...input,
      results: [
        {
          itemId: 'a',
          wasCorrect: true,
          mistakeCount: 0,
          typingSeconds: 3,
          elapsedSeconds: 4,
        },
        {
          itemId: 'b',
          wasCorrect: false,
          mistakeCount: 2,
          typingSeconds: 1,
          elapsedSeconds: 1,
        },
      ],
    },
    new Date('2026-10-09T01:00:00Z'),
  )
  expect(submittedSession()).toMatchObject({
    context: { mode: 'review' },
    charactersTyped: 6,
    sentencesPracticed: 1,
    wordsPracticed: 0,
    typingSeconds: 4,
    exerciseMistakes: [0, 2],
  })
})
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/application/submit-review-session.test.ts`
- [ ] **Step 3: Implement**

- In the loop, collect `ExerciseStat` from each found item:
  ```ts
  {
    targetText: item.targetText,
    lessonType: item.sourceLessonType,
    mistakeCount: result.mistakeCount ?? (wasCorrect ? 0 : 1),
    typingSeconds: result.typingSeconds ?? 0,
    elapsedSeconds: result.elapsedSeconds ?? 0,
  }
  ```
- Get the timezone from `(await deps.userProfileRepo?.getUserProfile(userId))?.timezone ?? deviceTimeZone()`.
- Spread `sessionStatsFrom(stats, undefined, timeZone, now)` into the session.
- `ReviewPage.action.ts`: add `mistakeCount: z.number().int().min(0).optional()`, `typingSeconds: z.number().min(0).optional()`, and `elapsedSeconds: z.number().min(0).optional()` to each result. Also add `userProfileRepo?` to deps and pass it through.
- `ReviewTypingSession.tsx`: map `mistakeCount: result.mistakes.length`, `typingSeconds: result.typingSeconds ?? 0`, and `elapsedSeconds: result.elapsedSeconds ?? 0` into each result.

- [ ] **Step 4: Run, expect PASS** (same command)
- [ ] **Step 5: Suggested commit** — `feat(stats): send Review session stats`

---

### Task 8: Home sessions carry stats

**Files:**

- Modify: `src/domain/models/home-sync-job.ts` (`HomeSessionTotals`, exercise job `lesson.type?`)
- Modify: `src/domain/models/progress.ts` (`HomePartialResult.exercises?`)
- Modify: `src/domain/home/home-session.ts` (`homeReplayTotals`)
- Modify: `src/application/record-home-exercise.ts`, `src/application/submit-home-replay.ts`, `src/application/home-session-submission.ts`, `src/application/home-outbox.ts`
- Modify: `src/app/home-services.ts` (send `lesson.type`)
- Modify: `src/infrastructure/firebase/mappers/progress-mapper.ts` (persist `homePartialResult.exercises`) — check the mapper copies `homePartialResult` whole; if it lists fields, add `exercises`.
- Test: `src/application/record-home-exercise.test.ts`, `src/domain/home/home-session.test.ts`

**Interfaces:**

- Consumes: `ExerciseStat`, `sessionStatsFrom`, `deviceTimeZone`.
- Produces:
  - `HomeSessionTotals` gains `exercises?: ExerciseStat[]`.
  - `RecordHomeExerciseInput.lesson` gains `type?: LessonType`.
  - `SubmitHomeReplayInput` gains `lessonType?: LessonType`.
  - `submitHomeSession` input gains `lessonType?: LessonType` and `isReplay: boolean`.

- [ ] **Step 1: Write the failing tests**

```ts
// record-home-exercise.test.ts (reuse the file's deps and two-exercise lesson fixture)
it('accumulates exercise stats across visits and submits them on completion', async () => {
  const lesson = { ...twoExerciseLesson, type: 'word' as const }
  await recordHomeExercise(deps, {
    userId: 'u1',
    lesson,
    result: { ...result1, typingSeconds: 2, elapsedSeconds: 3 },
    submissionId: 'sub',
    now: new Date('2026-10-09T01:00:00Z'),
  })
  await recordHomeExercise(deps, {
    userId: 'u1',
    lesson,
    result: { ...result2, typingSeconds: 4, elapsedSeconds: 6 },
    submissionId: 'ignored',
    now: new Date('2026-10-10T09:00:00Z'),
  })
  expect(submittedSession()).toMatchObject({
    context: { mode: 'home' },
    typingSeconds: 6,
    learningSeconds: 9, // per-exercise elapsed, not the overnight wall clock
    wordsPracticed: 2,
    isReplay: false,
  })
})

it('submits a pending pre-deploy job without type or timing', async () => {
  await recordHomeExercise(deps, {
    userId: 'u1',
    lesson: twoExerciseLesson,
    result: result1,
    submissionId: 'sub',
  })
  await recordHomeExercise(deps, {
    userId: 'u1',
    lesson: twoExerciseLesson,
    result: result2,
    submissionId: 'x',
  })
  expect(submittedSession()).toMatchObject({
    typingSeconds: 0,
    wordsPracticed: 0,
    learningSeconds: 0,
  })
})
```

```ts
// home-session.test.ts
it('includes per-exercise stats in replay totals', () => {
  // build a finished LessonSessionState with pressKey(..., nowMs) as in Task 1
  expect(homeReplayTotals(state).exercises).toEqual([
    { targetText: '가', mistakeCount: 0, typingSeconds: 1, elapsedSeconds: 1 },
  ])
})
```

Also add a `submit-home-replay` assertion that a replay submits `isReplay: true` and that `sentencesPracticed` follows `lessonType: 'sentence'`.

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/application/record-home-exercise.test.ts src/domain/home/home-session.test.ts src/application/submit-home-replay.test.ts`
- [ ] **Step 3: Implement**

- `homeReplayTotals`: add `exercises: getLessonResult(state, now).exercises ?? []`.
- `recordHomeExercise`:
  - Build `const exerciseStat: ExerciseStat = { targetText: result.targetText, mistakeCount: result.mistakes.length, typingSeconds: result.typingSeconds ?? 0, elapsedSeconds: result.elapsedSeconds ?? 0 }`.
  - Set `partial.exercises = [...(previous.exercises ?? []), exerciseStat]`.
  - Pass `exercises: partial.exercises` in `totals`.
  - Call `submitHomeSession(..., { lessonType: lesson.type, isReplay: false, ... })`.
- `submitHomeReplay`: pass `lessonType: input.lessonType` and `isReplay: true`.
- `submitHomeSession`:
  - Read the profile first, as it already does.
  - Add to the session:
    ```ts
    ...sessionStatsFrom(input.totals.exercises ?? [], input.lessonType, profile.timezone ?? deviceTimeZone(), input.now),
    learningSeconds: (input.totals.exercises ?? []).reduce((sum, e) => sum + e.elapsedSeconds, 0),
    isReplay: input.isReplay,
    ```
- `home-sync-job.ts`: in the `kind: 'exercise'` job, the `lesson` type gains `type?: LessonType`. In the `kind: 'replay'` job, add `lessonType?: LessonType`.
- `home-outbox.ts`: pass these through to `recordHomeExercise`/`submitHomeReplay`.
- `home-services.ts`: in `recordExercise`, add `type: lesson.type` to the `lesson` object.
  - `recordReplay` needs the type: change `HomeServices.recordReplay` input to `{ lessonId; lessonType?; totals }`.
  - In `HomePlayer.tsx`, pass `lessonType: played.type`. This is a data-only wiring change; no visible UI change.

- [ ] **Step 4: Run, expect PASS** (same command plus `pnpm vitest run src/application/home-outbox.test.ts` if it exists)
- [ ] **Step 5: Suggested commit** — `feat(stats): send Home session stats`

---

### Task 9: Guest → account migration applies stats in order

**Files:**

- Modify: `src/application/migrate-guest-data-to-account.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-account-migration-repository.ts`
- Test: `src/application/migrate-guest-data-to-account.test.ts`, `src/infrastructure/firebase/repositories/firebase-account-migration-repository.test.ts`

**Interfaces:**

- Consumes: `readSessionStatsWrites` (Task 4).

- [ ] **Step 1: Write the failing tests**

```ts
// migrate-guest-data-to-account.test.ts
it('migrates session outcomes oldest first', async () => {
  // snapshot.sessionOutcomes = [outcome('late', '2026-10-10'), outcome('early', '2026-10-09')]
  await migrateGuestDataToAccount(source, destination, 'guest-1', 'account-1')
  expect(destination.migratedSessionIds).toEqual(['early', 'late'])
})
```

In `firebase-account-migration-repository.test.ts` (reuse its fake transaction), add:

```ts
it('applies player stats when migrating an outcome, once', async () => {
  await repo.migrateSessionOutcome('account-1', outcomeWithStats) // localDate '2026-10-09', expGained 25
  await repo.migrateSessionOutcome('account-1', outcomeWithStats)
  expect(documents.get('users/account-1/dailyStats/2026-10-09')).toMatchObject({
    expEarned: 25,
  })
  expect(documents.get('users/account-1')).toMatchObject({
    playerStats: { activeDays: 1 },
  })
})
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/application/migrate-guest-data-to-account.test.ts src/infrastructure/firebase/repositories/firebase-account-migration-repository.test.ts`
- [ ] **Step 3: Implement**

- In the use case, loop over `[...snapshot.sessionOutcomes].sort((a, b) => a.session.completedAt.getTime() - b.session.completedAt.getTime())`.
- In `migrateSessionOutcome`:
  - After reading `profile`, and before any `transaction.set`, move the progress/review reads ahead of the writes if they are interleaved. All `transaction.get` calls must come first. The current loop calls `get` and then `set` per item, so collect the reads first.
  - Then call `const writeStats = await readSessionStatsWrites({ db, doc }, transaction, accountId, profile.data(), outcome.session)`.
  - Change the profile `set` to `{ sessionAggregate: ..., ...writeStats(transaction) }`.

- [ ] **Step 4: Run, expect PASS** (same command)
- [ ] **Step 5: Suggested commit** — `feat(stats): apply player stats during Guest migration`

---

### Task 10: Docs, DEC-049, and final checks

**Files:**

- Modify: `docs/DECISIONS.md` (DEC-049 entry + index row)
- Modify: `docs/DOMAIN-MODEL.md`, `docs/SESSION-AND-HISTORY.md`, `docs/AUTH-AND-PERSISTENCE.md`
- Modify: `docs/superpowers/specs/2026-10-09-player-stats-design.md` (Status → Accepted as DEC-049; note `playerStats` nesting)
- Append: `docs/log/2026-10.md` (read only its last lines)
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: DEC-049** — "Player stats are folded into lifetime, daily, and monthly state in the submit transaction". Include:

  - The decisions table from the spec.
  - Rejected options: blind `increment()` writes, and computing from `learningSessions` on read.
  - The note that `totalTypingTimeSeconds` stays as Learning Time.

- [ ] **Step 2: Topic docs**

  - **DOMAIN-MODEL:**
    - New `LearningSession` fields.
    - `SessionAggregate` fields.
    - `UserProfile.timezone` and `UserProfile.playerStats`.
    - `ReviewItem.sourceLessonType`.
    - `dailyStats` and `monthlyStats` paths and fields.
  - **SESSION-AND-HISTORY:** session stats, plus how daily and monthly docs relate to history.
  - **AUTH-AND-PERSISTENCE:**
    - Timezone storage per adapter.
    - The Guest stores `dailyStats` and `monthlyStats`.
    - Migration re-applies stats in order and does not merge Guest `playerStats`.

- [ ] **Step 3: Final checks**

  - Run `pnpm exec tsc -b` and `pnpm lint`. Both must pass.
  - Re-run every test file touched in Tasks 1–9 in one `pnpm vitest run <files>` call, plus `pnpm test:rules`.
  - Do not run the full `pnpm test` or `pnpm build`.

- [ ] **Step 4: Log entry and handoff note**

  - **Log entry:** 3–5 bullets with the date, what shipped, and links to the spec, plan, and DEC-049.
  - **Handoff note to the user:**
    - Run `pnpm test` and `pnpm build`.
    - Deploy Rules before code.
    - Manually verify: play a lesson, a review, and a Home lesson, then check `users/{id}/dailyStats`, `monthlyStats`, and the profile.

- [ ] **Step 5: Suggested commit** — `docs(stats): record DEC-049 player stats`
