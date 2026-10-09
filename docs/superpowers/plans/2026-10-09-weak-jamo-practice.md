# Weak Jamo Practice (Spec B3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `weak-jamo` practice mode. It is entered from `/review` and played at `/review/weak-jamo`, with exercises picked from the Home static export by the learner's weakest key-level jamo. Sessions are recorded with Player Stats and jamo stats, and count as `practicesCompleted`.

**Architecture:**

- Pure domain functions pick up to 3 target jamo from `JamoStats` and choose up to 10 Home exercises by weighted score.
- A new session-aware `JamoStatsRepository` reads `learnerStats/jamo` from Firestore or IndexedDB.
- Two loaders and one action wire it up.
- The existing Review typing component is generalized to take plain `{ id, targetText }` exercises and a submit body builder.

**Tech Stack:** React 19, React Router loaders/actions/fetchers, Zustand, Zod 4, Firebase modular SDK, IndexedDB, Vitest + RTL, `@firebase/rules-unit-testing` (`pnpm test:rules`).

**Spec:** `docs/superpowers/specs/2026-10-09-weak-jamo-practice-design.md`

## Global Constraints

- **Content:** Home static export only, via the existing `HomeContentRepository`. Zero Firestore reads for content.
- **Policy numbers:**
  - Targets: at most 3 (`WEAK_JAMO_TARGETS`), each with ≥ 20 attempts (`MIN_RANKED_JAMO_ATTEMPTS`) and a mistake rate > 0. Highest rate first; a tie goes to more attempts.
  - Session: 10 exercises (`WEAK_JAMO_SESSION_SIZE`), drawn randomly from the top 30 by score (`WEAK_JAMO_POOL_SIZE`).
  - Score = Σ (count of target-jamo keys in `targetText` × that jamo's mistake rate). Exercises scoring 0 are skipped, and no `id` repeats.
- **Key-level jamo:** use the same rule as `jamoCountsFrom` (`ExpectedKey.jamo`). Skip `slot: 'literal'` keys and targets the keymap cannot type.
- **Exercise identity:** `home.json` guarantees exercise IDs are unique only
  within a lesson, so `PracticeExercise.id` is `${lessonId}:${exerciseId}`.
- **Session:** context `{ mode: 'weak-jamo' }` and `expGained: 0`.
  - Effects: `{ progress: [], reviewItems: [], ...(jamoCounts ? { jamoCounts } : {}) }`.
  - Never read, create, or update a `ReviewItem`.
- **Stats:**
  - `periodStatsFrom` counts lessons only for `learning-path` and `home`.
  - `review` counts `reviewsCompleted`; `weak-jamo` counts `practicesCompleted` (new, optional, read as 0).
  - `perfectLessons` counts lesson modes only.
- **Firestore:** never write `undefined` values. No Rules change is needed; `learnerStats` already exists.
- **Failure handling:**
  - If loading `home.json` or jamo stats fails, `/review` still works, with `weakJamo: null`.
  - `/review/weak-jamo` redirects to `/review` when it has nothing to play.
- **Testing:**
  - Run only the test files you add or change, plus `pnpm test:rules` for emulator files. Do **not** run full `pnpm test` or `pnpm build`.
  - No new automated tests for UI-only work (repo rule), but the existing `ReviewTypingSession`/`ReviewPage` tests must still pass.
  - Run `pnpm exec tsc -b` and `pnpm lint` once in Task 7.
- **Repo rules:**
  - Do not `git commit` or `git push`; each task ends with a suggested message only.
  - Never add a Co-Authored-By trailer.

## Review Focus

1. **Content contains a space** (`'안녕 하세요'`): it must not score for `' '`, and the score counts keys, not syllables (`'과'` has one `ㅗ` key). Pinned in Task 1.
2. **A learner whose weak jamo appears in no Home exercise** gets no button, and gets no crash or empty session at `/review/weak-jamo`. Pinned in Task 5.
3. **An old profile `sessionAggregate` without `practicesCompleted`** must add without `NaN`. Pinned in Task 2.
4. **`home.json` missing or failing to load** (`getHomeContent` returns `null` or throws) keeps `/review` working. Pinned in Task 5.
5. **Two quick `/review/weak-jamo` sessions in a row** use different `submissionId`s, so the second is not deduped away. The existing store generates a new ID on every `start()`. Checked in Task 6 by reading the code; no new test (UI).

---

## File Structure

| File                                                                                             | Responsibility                                                           |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| `src/domain/models/jamo-stat.ts` (modify)                                                        | Export `jamoKeysOf(targetText)` so selection and counting share one rule |
| `src/domain/practice/weak-jamo.ts` (create)                                                      | Targets, score, selection, and Home exercise flattening                  |
| `src/domain/models/learning-session.ts`, `player-stats.ts`, `session-aggregate.ts` (modify)      | `weak-jamo` context and `practicesCompleted`                             |
| `src/domain/repositories/jamo-stats-repository.ts` (create)                                      | `getJamoStats`                                                           |
| `src/infrastructure/firebase/repositories/firestore-jamo-stats.ts` (modify)                      | Export `toJamoStats`; add `FirebaseJamoStatsRepository`                  |
| `src/infrastructure/local/local-repositories.ts` (modify)                                        | `LocalJamoStatsRepository`                                               |
| `src/app/learner-repositories.ts`, `src/app/router.ts` (modify)                                  | Session-aware repo and the new route                                     |
| `src/application/submit-weak-jamo-session.ts` (create)                                           | Use case                                                                 |
| `src/features/review/WeakJamoPage.*` (create)                                                    | Loader, action, and page                                                 |
| `src/features/review/ReviewPage.loader.ts`, `ReviewPage.tsx`, `ReviewTypingSession.tsx` (modify) | Entry button and the generalized player                                  |

---

### Task 1: Weak jamo selection domain

**Files:**

- Modify: `src/domain/models/jamo-stat.ts`
- Create: `src/domain/practice/weak-jamo.ts`, `src/domain/practice/weak-jamo.test.ts`

**Interfaces — Produces:**

```ts
// jamo-stat.ts
export function jamoKeysOf(targetText: string): string[] // key-level jamo, literal/untypeable skipped
// weak-jamo.ts
export const WEAK_JAMO_TARGETS = 3
export const WEAK_JAMO_SESSION_SIZE = 10
export const WEAK_JAMO_POOL_SIZE = 30
export interface WeakJamoTarget {
  jamo: string
  mistakeRate: number
  attempts: number
}
export interface PracticeExercise {
  id: string
  targetText: string
  lessonType: LessonType
}
export function weakJamoTargets(stats: JamoStats): WeakJamoTarget[]
export function weakJamoScore(
  targetText: string,
  targets: WeakJamoTarget[],
): number
export function selectWeakJamoExercises(
  targets: WeakJamoTarget[],
  exercises: PracticeExercise[],
  random?: () => number,
): PracticeExercise[]
export function homePracticeExercises(content: HomeContent): PracticeExercise[]
```

- [ ] **Step 1: Write the failing tests** (`weak-jamo.test.ts`)

```ts
import { describe, expect, it } from 'vitest'
import type { JamoStats } from '../models/jamo-stat'
import {
  homePracticeExercises,
  selectWeakJamoExercises,
  weakJamoScore,
  weakJamoTargets,
  type PracticeExercise,
} from './weak-jamo'

const at = new Date(0)
const stat = (accepted: number, rejected: number) => ({
  acceptedKeystrokes: accepted,
  rejectedKeystrokes: rejected,
  firstPracticedAt: at,
  lastPracticedAt: at,
})

describe('weakJamoTargets', () => {
  it('keeps up to 3 practiced jamo with mistakes, highest rate first', () => {
    const stats: JamoStats = {
      ㅓ: stat(82, 18), // 18%
      ㅗ: stat(88, 12), // 12%
      ㄹ: stat(91, 9), // 9%
      ㅏ: stat(95, 5), // 5% — fourth
      ㄱ: stat(1, 1), // too few attempts
      ㄴ: stat(40, 0), // no mistakes
    }
    expect(weakJamoTargets(stats).map((target) => target.jamo)).toEqual([
      'ㅓ',
      'ㅗ',
      'ㄹ',
    ])
  })

  it('breaks a rate tie by more attempts and returns [] without data', () => {
    expect(weakJamoTargets({ ㄱ: stat(18, 2), ㄴ: stat(36, 4) })[0].jamo).toBe(
      'ㄴ',
    )
    expect(weakJamoTargets({})).toEqual([])
  })
})

describe('weakJamoScore', () => {
  const targets = [
    { jamo: 'ㅓ', mistakeRate: 0.2, attempts: 50 },
    { jamo: 'ㅗ', mistakeRate: 0.1, attempts: 50 },
  ]
  it('weights key-level target jamo by mistake rate, ignoring spaces', () => {
    expect(weakJamoScore('거', targets)).toBeCloseTo(0.2)
    expect(weakJamoScore('과', targets)).toBeCloseTo(0.1) // ㅘ = ㅗ + ㅏ
    expect(weakJamoScore('어 어', targets)).toBeCloseTo(0.4)
    expect(weakJamoScore('가', targets)).toBe(0)
  })
})

describe('selectWeakJamoExercises', () => {
  const targets = [{ jamo: 'ㅓ', mistakeRate: 0.2, attempts: 50 }]
  const exercise = (id: string, targetText: string): PracticeExercise => ({
    id,
    targetText,
    lessonType: 'word',
  })

  it('skips zero scores and duplicates and returns at most 10', () => {
    const pool = [
      exercise('zero', '가'),
      exercise('dup', '거'),
      exercise('dup', '거'),
      ...Array.from({ length: 12 }, (_, index) => exercise(`e${index}`, '어')),
    ]
    const picked = selectWeakJamoExercises(targets, pool, () => 0)
    expect(picked).toHaveLength(10)
    expect(picked.some((item) => item.id === 'zero')).toBe(false)
    expect(new Set(picked.map((item) => item.id)).size).toBe(10)
  })

  it('draws only from the 30 highest scores', () => {
    const strong = Array.from({ length: 30 }, (_, index) =>
      exercise(`strong${index}`, '어어'),
    )
    const weak = Array.from({ length: 30 }, (_, index) =>
      exercise(`weak${index}`, '어'),
    )
    const picked = selectWeakJamoExercises(
      targets,
      [...weak, ...strong],
      Math.random,
    )
    expect(picked.every((item) => item.id.startsWith('strong'))).toBe(true)
  })

  it('returns [] without targets', () => {
    expect(selectWeakJamoExercises([], [exercise('a', '어')])).toEqual([])
  })
})

describe('homePracticeExercises', () => {
  it('flattens Home lessons and tags each exercise with its lesson type', () => {
    const exerciseFields = {
      romanization: null,
      meaningTh: '',
      meaningEn: '',
      difficulty: 'easy' as const,
      hint: null,
    }
    const content = {
      units: [
        {
          id: 'u',
          title: '',
          description: '',
          order: 0,
          lessons: [
            {
              id: 'l1',
              title: '',
              type: 'word' as const,
              order: 0,
              exercises: [{ id: 'e1', targetText: '어', ...exerciseFields }],
            },
            {
              id: 'l2',
              title: '',
              type: 'sentence' as const,
              order: 1,
              exercises: [{ id: 'e2', targetText: '어 어', ...exerciseFields }],
            },
          ],
        },
      ],
    }
    expect(homePracticeExercises(content as never)).toEqual([
      { id: 'l1:e1', targetText: '어', lessonType: 'word' },
      { id: 'l2:e2', targetText: '어 어', lessonType: 'sentence' },
    ])
  })
})
```

Before writing the fixture, check the real `HomeContent` top-level fields in `src/domain/models/home-content.ts`, and build it with every required field instead of `as never` if the type allows.

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/domain/practice/weak-jamo.test.ts` (module not found)

- [ ] **Step 3: Implement**

`jamo-stat.ts`: add and export the following, and make `jamoCountsFrom` use `jamoKeysOf` for the accepted side (behavior unchanged; its tests stay green):

```ts
/** Key-level jamo of a target; literal keys and untypeable targets give none. */
export function jamoKeysOf(targetText: string): string[] {
  return typeableKeys(targetText)
    .filter((key) => key.slot !== 'literal' && isJamo(key.jamo))
    .map((key) => key.jamo)
}
```

`weak-jamo.ts`:

```ts
import type { HomeContent } from '../models/home-content'
import {
  jamoKeysOf,
  MIN_RANKED_JAMO_ATTEMPTS,
  type JamoStats,
} from '../models/jamo-stat'
import type { LessonType } from '../models/lesson'

// Weak Jamo practice (DEC-051): picks the learner's weakest key-level jamo and
// Home exercises that drill them. Policy numbers are not schema.
export const WEAK_JAMO_TARGETS = 3
export const WEAK_JAMO_SESSION_SIZE = 10
export const WEAK_JAMO_POOL_SIZE = 30

export interface WeakJamoTarget {
  jamo: string
  mistakeRate: number
  attempts: number
}
export interface PracticeExercise {
  id: string
  targetText: string
  lessonType: LessonType
}

export function weakJamoTargets(stats: JamoStats): WeakJamoTarget[] {
  return Object.entries(stats)
    .map(([jamo, stat]) => {
      const attempts = stat.acceptedKeystrokes + stat.rejectedKeystrokes
      return {
        jamo,
        attempts,
        mistakeRate: attempts === 0 ? 0 : stat.rejectedKeystrokes / attempts,
      }
    })
    .filter(
      (target) =>
        target.attempts >= MIN_RANKED_JAMO_ATTEMPTS && target.mistakeRate > 0,
    )
    .sort((a, b) => b.mistakeRate - a.mistakeRate || b.attempts - a.attempts)
    .slice(0, WEAK_JAMO_TARGETS)
}

export function weakJamoScore(
  targetText: string,
  targets: WeakJamoTarget[],
): number {
  const rates = new Map(
    targets.map((target) => [target.jamo, target.mistakeRate]),
  )
  return jamoKeysOf(targetText).reduce(
    (sum, jamo) => sum + (rates.get(jamo) ?? 0),
    0,
  )
}

export function selectWeakJamoExercises(
  targets: WeakJamoTarget[],
  exercises: PracticeExercise[],
  random: () => number = Math.random,
): PracticeExercise[] {
  if (targets.length === 0) return []
  const seen = new Set<string>()
  const pool = exercises
    .filter((exercise) => !seen.has(exercise.id) && seen.add(exercise.id))
    .map((exercise) => ({
      exercise,
      score: weakJamoScore(exercise.targetText, targets),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, WEAK_JAMO_POOL_SIZE)
    .map((entry) => entry.exercise)
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    ;[pool[index], pool[swap]] = [pool[swap], pool[index]]
  }
  return pool.slice(0, WEAK_JAMO_SESSION_SIZE)
}

export function homePracticeExercises(
  content: HomeContent,
): PracticeExercise[] {
  return content.units.flatMap((unit) =>
    unit.lessons.flatMap((lesson) =>
      lesson.exercises.map((exercise) => ({
        id: `${lesson.id}:${exercise.id}`,
        targetText: exercise.targetText,
        lessonType: lesson.type,
      })),
    ),
  )
}
```

- [ ] **Step 4: Run, expect PASS** — `pnpm vitest run src/domain/practice/weak-jamo.test.ts src/domain/models/jamo-stat.test.ts`

- [ ] **Step 5: Suggested commit** — `feat(practice): add weak jamo target and exercise selection`

---

### Task 2: `weak-jamo` context and `practicesCompleted`

**Files:**

- Modify: `src/domain/models/learning-session.ts`, `src/domain/models/player-stats.ts`, `src/domain/models/session-aggregate.ts`
- Test: `src/domain/models/player-stats.test.ts`, `src/domain/models/session-aggregate.test.ts`

**Interfaces — Produces:**

- `LearningSessionContext` gains `{ mode: 'weak-jamo' }`.
- `PeriodStats.practicesCompleted: number`.
- `SessionAggregate.practicesCompleted?: number`.

- [ ] **Step 1: Write the failing tests**

```ts
// player-stats.test.ts, inside describe('periodStatsFrom')
it('counts a weak jamo practice only as a practice', () => {
  expect(
    periodStatsFrom(
      session({
        context: { mode: 'weak-jamo' },
        rejectedKeystrokes: 0,
        isReplay: true,
      }),
    ),
  ).toMatchObject({
    practicesCompleted: 1,
    lessonsCompleted: 0,
    lessonsReplayed: 0,
    perfectLessons: 0,
    reviewsCompleted: 0,
  })
  expect(periodStatsFrom(session()).practicesCompleted).toBe(0)
})
```

```ts
// session-aggregate.test.ts
it('adds practicesCompleted onto an aggregate without it', () => {
  const legacy = {
    exp: 0,
    exercisesAttempted: 0,
    acceptedKeystrokes: 0,
    rejectedKeystrokes: 0,
    totalTypingTimeSeconds: 0,
    bestAccuracy: 0,
  }
  const practice = aggregateFromSession({
    ...base,
    context: { mode: 'weak-jamo' },
  })
  expect(practice).toMatchObject({ practicesCompleted: 1, lessonsCompleted: 0 })
  expect(addSessionAggregate(legacy, practice).practicesCompleted).toBe(1)
})
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/domain/models/player-stats.test.ts src/domain/models/session-aggregate.test.ts`

- [ ] **Step 3: Implement**

- `learning-session.ts`: add `| { mode: 'weak-jamo' }` to the context union.
- `player-stats.ts`:
  - Add `practicesCompleted` to `PeriodStats` and `emptyPeriodStats`.
  - In `periodStatsFrom`:
    ```ts
    const mode = session.context.mode
    const isLesson = mode === 'learning-path' || mode === 'home'
    ...
    reviewsCompleted: mode === 'review' ? 1 : 0,
    practicesCompleted: mode === 'weak-jamo' ? 1 : 0,
    ```
  - `addPeriod` already sums every key and defaults missing ones through `emptyPeriodStats`, so stored day docs without the field stay valid.
- `session-aggregate.ts`:
  - Add `practicesCompleted?: number`, set to `0` in `emptySessionAggregate`.
  - `aggregateFromSession` sets `practicesCompleted: period.practicesCompleted`.
  - `addSessionAggregate` sets `practicesCompleted: (current.practicesCompleted ?? 0) + (next.practicesCompleted ?? 0)`.
- Fix any existing test that asserts the full `PeriodStats` or `emptySessionAggregate` with `toEqual`: add `practicesCompleted: 0` there and ledger it.

- [ ] **Step 4: Run, expect PASS** — the same command plus `pnpm vitest run src/infrastructure/local/guest-database-stats.test.ts`

- [ ] **Step 5: Suggested commit** — `feat(stats): count weak jamo practice as practicesCompleted`

---

### Task 3: Session-aware `JamoStatsRepository`

**Files:**

- Create: `src/domain/repositories/jamo-stats-repository.ts`
- Modify: `src/infrastructure/firebase/repositories/firestore-jamo-stats.ts` (export `toJamoStats`, add `FirebaseJamoStatsRepository`)
- Modify: `src/infrastructure/local/local-repositories.ts` (`LocalJamoStatsRepository`)
- Modify: `src/app/learner-repositories.ts`, `src/app/learner-repositories.test.ts`, `src/test/fakes.ts` (`FakeJamoStatsRepository`)
- Modify: `src/infrastructure/firebase/repositories/firebase-session-submission-repository.emulator.test.ts` (append)
- Test: `src/infrastructure/local/local-jamo-stats-repository.test.ts` (create)

**Interfaces — Produces:**

```ts
export interface JamoStatsRepository {
  getJamoStats(userId: string): Promise<JamoStats>
}
export function toJamoStats(
  stored: Record<string, unknown> | undefined,
): JamoStats // Timestamp → Date
export class FirebaseJamoStatsRepository implements JamoStatsRepository {
  constructor(firestore?: Firestore)
}
export class LocalJamoStatsRepository implements JamoStatsRepository {
  constructor(db?: GuestDatabase)
}
export class FakeJamoStatsRepository implements JamoStatsRepository {
  constructor(stats?: Record<string, JamoStats>)
}
// createLearnerRepositories: guest/authenticated gain jamoStatsRepo; result gains jamoStatsRepo
```

- [ ] **Step 1: Write the failing tests**

Emulator (append inside the existing describe):

```ts
it('reads jamo stats back as Dates, and {} without a doc', async () => {
  const { firestore, repo } = learnerRepository()
  const reader = new FirebaseJamoStatsRepository(firestore)
  expect(await reader.getJamoStats('learner-1')).toEqual({})
  await repo.submit('learner-1', session, jamoEffects)
  const stats = await reader.getJamoStats('learner-1')
  expect(stats.ㄱ).toMatchObject({
    acceptedKeystrokes: 2,
    rejectedKeystrokes: 1,
  })
  expect(stats.ㄱ.firstPracticedAt).toBeInstanceOf(Date)
})
```

`local-jamo-stats-repository.test.ts` (use a memory double of `GuestDatabase.get`, as `local-session-submission-repository.test.ts` does):

```ts
it('reads the learnerStats record and returns {} when absent', async () => {
  const records = new Map<string, unknown>([
    ['learnerStats|u1:jamo', { jamo: { ㄱ: { acceptedKeystrokes: 1 } } }],
  ])
  const db = {
    get: async (store: string, key: string) =>
      records.get(`${store}|${key}`) ?? null,
  }
  const repo = new LocalJamoStatsRepository(db as never)
  expect(await repo.getJamoStats('u1')).toEqual({
    ㄱ: { acceptedKeystrokes: 1 },
  })
  expect(await repo.getJamoStats('u2')).toEqual({})
})
```

`learner-repositories.test.ts`: add an assertion that `jamoStatsRepo.getJamoStats` uses the guest repo for a guest session. Follow the file's existing pattern, and pass a `FakeJamoStatsRepository` on each side.

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/infrastructure/local/local-jamo-stats-repository.test.ts src/app/learner-repositories.test.ts`, and `pnpm test:rules`

- [ ] **Step 3: Implement**

- `jamo-stats-repository.ts`: the interface above.
- `firestore-jamo-stats.ts`:
  - Move the Timestamp conversion into the exported `toJamoStats(stored)`, and have `readJamoStatsWrite` use it.
  - Add:
    ```ts
    export class FirebaseJamoStatsRepository implements JamoStatsRepository {
      constructor(private readonly firestore: Firestore = db) {}
      async getJamoStats(userId: string): Promise<JamoStats> {
        const snapshot = await getDoc(
          doc(this.firestore, 'users', userId, 'learnerStats', 'jamo'),
        )
        return snapshot.exists() ? toJamoStats(snapshot.data().jamo) : {}
      }
    }
    ```
    Import `db` from `../firebase` and `doc`/`getDoc` from `firebase/firestore`.
- `local-repositories.ts`: `export class LocalJamoStatsRepository implements JamoStatsRepository { constructor(private db: GuestDatabase = guestDatabase) {} async getJamoStats(u: string) { return (await this.db.get<{ jamo: JamoStats }>('learnerStats', key(u, 'jamo')))?.jamo ?? {} } }`. Check that `key(u, 'jamo')` yields `${u}:jamo`, matching the writer in `guest-database.ts`.
- `fakes.ts`: `FakeJamoStatsRepository` returns `stats[userId] ?? {}`.
- `learner-repositories.ts`: add `jamoStatsRepo` to both sides and return `jamoStatsRepo: { getJamoStats: async (u) => (await choose(...)).getJamoStats(u) } satisfies JamoStatsRepository`.
- `router.ts`: pass `jamoStatsRepo: new LocalJamoStatsRepository()` and `jamoStatsRepo: new FirebaseJamoStatsRepository()`.

- [ ] **Step 4: Run, expect PASS** (same commands)

- [ ] **Step 5: Suggested commit** — `feat(stats): read jamo stats through a session-aware repository`

---

### Task 4: `submitWeakJamoSession` use case and action

**Files:**

- Create: `src/application/submit-weak-jamo-session.ts`, `src/application/submit-weak-jamo-session.test.ts`
- Create: `src/features/review/WeakJamoPage.action.ts`, `src/features/review/WeakJamoPage.action.test.ts`

**Interfaces — Produces:**

```ts
export interface WeakJamoResult { exerciseId: string; targetText: string; lessonType: LessonType; wasCorrect: boolean; mistakeCount: number; typingSeconds: number; elapsedSeconds: number }
export interface SubmitWeakJamoSessionInput { submissionId: string; startedAtMs: number; durationSeconds: number; exercisesAttempted: number; acceptedKeystrokes: number; rejectedKeystrokes: number; results: WeakJamoResult[]; jamoCounts?: JamoCounts }
export interface SubmitWeakJamoSessionOutcome { correctCount: number; needsPracticeCount: number }
export function submitWeakJamoSession(deps: { sessionSubmissionRepo: SessionSubmissionRepository; userProfileRepo?: UserProfileRepository }, userId: string, input: SubmitWeakJamoSessionInput, now?: Date): Promise<SubmitWeakJamoSessionOutcome>
export type WeakJamoActionData = SubmitWeakJamoSessionOutcome | { error: string }
export function createSubmitWeakJamoSessionAction(deps: {...; ensureUser}): (args: ActionFunctionArgs) => Promise<WeakJamoActionData>
```

- [ ] **Step 1: Write the failing tests**

```ts
// submit-weak-jamo-session.test.ts
import { describe, expect, it } from 'vitest'
import { submitWeakJamoSession } from './submit-weak-jamo-session'
import { FakeSessionSubmissionRepository } from '../test/fakes'

const input = {
  submissionId: 'wj-1',
  startedAtMs: 0,
  durationSeconds: 20,
  exercisesAttempted: 2,
  acceptedKeystrokes: 6,
  rejectedKeystrokes: 1,
  results: [
    {
      exerciseId: 'e1',
      targetText: '거기',
      lessonType: 'word' as const,
      wasCorrect: true,
      mistakeCount: 0,
      typingSeconds: 2,
      elapsedSeconds: 3,
    },
    {
      exerciseId: 'e2',
      targetText: '어 어',
      lessonType: 'sentence' as const,
      wasCorrect: false,
      mistakeCount: 1,
      typingSeconds: 3,
      elapsedSeconds: 4,
    },
  ],
}

describe('submitWeakJamoSession', () => {
  it('submits a weak-jamo session with stats and no learner-state effects', async () => {
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    const outcome = await submitWeakJamoSession(
      { sessionSubmissionRepo },
      'u1',
      { ...input, jamoCounts: { ㅓ: { accepted: 4, rejected: 1 } } },
      new Date('2026-10-09T01:00:00Z'),
    )
    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 1 })
    const [submission] = sessionSubmissionRepo.submissions
    expect(submission.session).toMatchObject({
      id: 'wj-1',
      context: { mode: 'weak-jamo' },
      expGained: 0,
      charactersTyped: 4,
      wordsPracticed: 1,
      sentencesPracticed: 1,
      typingSeconds: 5,
      exerciseMistakes: [0, 1],
    })
    expect(submission.effects).toEqual({
      progress: [],
      reviewItems: [],
      jamoCounts: { ㅓ: { accepted: 4, rejected: 1 } },
    })
  })

  it('omits jamoCounts when absent', async () => {
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await submitWeakJamoSession({ sessionSubmissionRepo }, 'u1', input)
    expect(sessionSubmissionRepo.submissions[0].effects).not.toHaveProperty(
      'jamoCounts',
    )
  })
})
```

```ts
// WeakJamoPage.action.test.ts
it('drops invalid jamo counts, still submits, and returns an error object on failure', async () => {
  const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
  const action = createSubmitWeakJamoSessionAction({
    sessionSubmissionRepo,
    ensureUser: async () => ({ uid: 'u1' }),
  })
  const request = (body: unknown) =>
    new Request('http://localhost/review/weak-jamo', {
      method: 'POST',
      body: JSON.stringify(body),
    })
  const body = {
    submissionId: 's1',
    startedAtMs: 0,
    durationSeconds: 1,
    exercisesAttempted: 0,
    acceptedKeystrokes: 0,
    rejectedKeystrokes: 0,
    results: [],
    jamoCounts: { x: { accepted: -1, rejected: 0 } },
  }
  expect(await action({ request: request(body) } as never)).toEqual({
    correctCount: 0,
    needsPracticeCount: 0,
  })
  expect(sessionSubmissionRepo.submissions[0].effects).not.toHaveProperty(
    'jamoCounts',
  )

  const failing = createSubmitWeakJamoSessionAction({
    sessionSubmissionRepo: {
      submit: async () => {
        throw new Error('offline')
      },
    },
    ensureUser: async () => ({ uid: 'u1' }),
  })
  expect(
    await failing({
      request: request({ ...body, submissionId: 's2' }),
    } as never),
  ).toHaveProperty('error')
})
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/application/submit-weak-jamo-session.test.ts src/features/review/WeakJamoPage.action.test.ts`

- [ ] **Step 3: Implement**

- **Use case:**
  - Build the stats as `results.map(({ targetText, lessonType, mistakeCount, typingSeconds, elapsedSeconds }) => ({ targetText, lessonType, mistakeCount, typingSeconds, elapsedSeconds }))`.
  - Get the timezone from `(await deps.userProfileRepo?.getUserProfile(userId))?.timezone ?? deviceTimeZone()`.
  - Submit:
    ```ts
    { id, context: { mode: 'weak-jamo' }, startedAt: new Date(startedAtMs), completedAt: now, durationSeconds, exercisesAttempted, acceptedKeystrokes, rejectedKeystrokes, expGained: 0, ...sessionStatsFrom(stats, undefined, timeZone, now) }
    ```
    with effects `{ progress: [], reviewItems: [], ...(input.jamoCounts ? { jamoCounts: input.jamoCounts } : {}) }`.
  - Count correct and needs-practice from `wasCorrect`.
- **Action:**
  - Zod schema mirroring the input, with `lessonType: z.enum([...LessonType values])`, `results: z.array(...).max(50)`, and `jamoCounts: jamoCountsSchema.optional().catch(undefined)`.
  - Drop an `undefined` `jamoCounts` key before the call.
  - Wrap only the submit in `try/catch` and return `{ error: 'Your practice could not be saved. Check your connection and try again.' }`, as `LessonDetailPage.action.ts` does.
  - A malformed body throws, as the Review action does.

- [ ] **Step 4: Run, expect PASS** (same command)

- [ ] **Step 5: Suggested commit** — `feat(practice): submit weak jamo practice sessions`

---

### Task 5: Loaders and route

**Files:**

- Create: `src/application/get-weak-jamo-practice.ts`, `src/application/get-weak-jamo-practice.test.ts`
- Modify: `src/features/review/ReviewPage.loader.ts`, `src/features/review/ReviewPage.loader.test.ts`
- Create: `src/features/review/WeakJamoPage.loader.ts`, `src/features/review/WeakJamoPage.loader.test.ts`
- Modify: `src/app/router.ts` (route `/review/weak-jamo` with loader + action + `ErrorBoundary: RouteError`)

**Interfaces — Produces:**

```ts
export interface WeakJamoSummary {
  targets: WeakJamoTarget[]
  available: number
}
export function getWeakJamoSummary(
  deps: {
    jamoStatsRepo: JamoStatsRepository
    contentRepo: HomeContentRepository
  },
  userId: string,
): Promise<WeakJamoSummary | null> // null on failure or no content
export function getWeakJamoPractice(
  deps: same,
  userId: string,
  random?: () => number,
): Promise<{ targets: WeakJamoTarget[]; exercises: PracticeExercise[] } | null> // null when nothing to play
// ReviewLoaderData gains: weakJamo: WeakJamoSummary | null
export interface WeakJamoLoaderData {
  targets: WeakJamoTarget[]
  exercises: PracticeExercise[]
  settings: UserSettings
}
```

`available` counts the scoring candidates, capped at 10: `Math.min(WEAK_JAMO_SESSION_SIZE, candidates with score > 0)`.

- [ ] **Step 1: Write the failing tests**

```ts
// get-weak-jamo-practice.test.ts
const weakStats = {
  ㅓ: {
    acceptedKeystrokes: 80,
    rejectedKeystrokes: 20,
    firstPracticedAt: new Date(0),
    lastPracticedAt: new Date(0),
  },
}
const content = (texts: string[]) => ({
  getHomeContent: async () => homeContentWith(texts),
}) // helper builds a valid HomeContent with one word lesson

it('summarizes targets and available exercises', async () => {
  const summary = await getWeakJamoSummary(
    {
      jamoStatsRepo: new FakeJamoStatsRepository({ u1: weakStats }),
      contentRepo: content(['어', '가']),
    },
    'u1',
  )
  expect(summary).toEqual({
    targets: [{ jamo: 'ㅓ', mistakeRate: 0.2, attempts: 100 }],
    available: 1,
  })
})

it('returns null when content is missing, fails, or has no matching exercise', async () => {
  const deps = (contentRepo: HomeContentRepository) => ({
    jamoStatsRepo: new FakeJamoStatsRepository({ u1: weakStats }),
    contentRepo,
  })
  expect(
    await getWeakJamoSummary(deps({ getHomeContent: async () => null }), 'u1'),
  ).toBeNull()
  expect(
    await getWeakJamoSummary(
      deps({
        getHomeContent: async () => {
          throw new Error('404')
        },
      }),
      'u1',
    ),
  ).toBeNull()
  expect(await getWeakJamoPractice(deps(content(['가'])), 'u1')).toBeNull()
})

it('returns null without enough practiced jamo', async () => {
  expect(
    await getWeakJamoSummary(
      {
        jamoStatsRepo: new FakeJamoStatsRepository(),
        contentRepo: content(['어']),
      },
      'u1',
    ),
  ).toBeNull()
})
```

- In `ReviewPage.loader.test.ts`, extend an existing test's deps with `jamoStatsRepo` and `contentRepo`. Assert `weakJamo` is `null` when `getHomeContent` throws and the previews still load.
- In `WeakJamoPage.loader.test.ts`, assert the loader throws a redirect `Response` with status 302 and `Location: /review` when there is nothing to play. It returns `{ targets, exercises, settings }` otherwise.

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/application/get-weak-jamo-practice.test.ts src/features/review/ReviewPage.loader.test.ts src/features/review/WeakJamoPage.loader.test.ts`

- [ ] **Step 3: Implement**

- **`get-weak-jamo-practice.ts`:**
  - Wrap the reads in `try/catch` and return `null` on error.
  - Use `homePracticeExercises`, `weakJamoTargets`, `weakJamoScore` and `selectWeakJamoExercises`.
  - Return `null` when there are no targets or no scoring exercise.
- **`ReviewPage.loader.ts`:**
  - Add `jamoStatsRepo` and `contentRepo` to the deps.
  - Run `getWeakJamoSummary` inside the existing `Promise.all`, after `ensureUser`.
  - Return `weakJamo`.
- **`WeakJamoPage.loader.ts`:**
  - Get the user, settings, and `getWeakJamoPractice`.
  - When the result is `null`, `throw redirect('/review')` (from `react-router`).
- **`router.ts`:**
  - Add `jamoStatsRepo` and `contentRepo: new StaticHomeContentRepository()` to the `/review` loader deps. Reuse a single `StaticHomeContentRepository` instance if the router already creates one.
  - Add the route:
    ```ts
    { path: '/review/weak-jamo', Component: WeakJamoPage, loader: createWeakJamoLoader({...}), action: createSubmitWeakJamoSessionAction({ sessionSubmissionRepo, userProfileRepo, ensureUser: getActiveUser }), ErrorBoundary: RouteError }
    ```
    Task 6 creates `WeakJamoPage`. If you run Task 5 first, add a placeholder default export that renders `null`.

- [ ] **Step 4: Run, expect PASS** (same command)

- [ ] **Step 5: Suggested commit** — `feat(practice): load weak jamo targets and practice exercises`

---

### Task 6: UI — Review button, generalized player, Weak Jamo page

UI-only: no new automated tests (repo rule). The existing `ReviewTypingSession.test.tsx` and `ReviewPage.test.tsx` must pass after the prop change; update their props to the new shape.

**Files:**

- Modify: `src/features/review/ReviewTypingSession.tsx`, `ReviewTypingSession.test.tsx`
- Modify: `src/features/review/ReviewPage.tsx`
- Create: `src/features/review/WeakJamoPage.tsx`

- [ ] **Step 1: Generalize `ReviewTypingSession`**
  - Props become `exercises: Array<{ id: string; targetText: string }>`, `onComplete(outcome)`, `keyboardSettings`, plus:
    - `buildBody(payload: { submissionId, metrics: LessonResult, results: ExerciseResult[] }) => Record<string, unknown>`
    - `action?: string` (fetcher submit target; omit it for the current route)
  - Keep start, typing, and keyboard behavior unchanged.
  - Move the current Review body construction into `ReviewPage`'s `buildBody`, which maps `exerciseId` to `itemId` exactly as today, including `jamoCounts`.
  - When `fetcher.data` has `error`, show the message and a "Try again" button that re-submits the same stored body (same `submissionId`). The `fetcher.data` check must not call `onComplete` for an error object.
- [ ] **Step 2: Update `ReviewTypingSession.test.tsx` and `ReviewPage.tsx`** to pass `exercises={items.map(({ id, targetText }) => ({ id, targetText }))}` and the review `buildBody`.
  - Run `pnpm vitest run src/features/review/ReviewTypingSession.test.tsx src/features/review/ReviewPage.test.tsx`. Expected: PASS, with the same assertions as before.
- [ ] **Step 3: Review entry card** in `ReviewPage.tsx`:
  - When `weakJamo` is present, render a card below the heading on the idle view, shown even when `items.length === 0`.
    - Title "Practice weak jamo".
    - Targets as `ㅓ 18% · ㅗ 12% · ㄹ 9%`, from `Math.round(mistakeRate * 100)`.
    - `<Link to="/review/weak-jamo">` styled as the existing `Button`.
  - Use the existing classes and components (`PageSurface`, `Button`, and the rounded card classes used by preview items).
- [ ] **Step 4: `WeakJamoPage.tsx`**
  - Read `WeakJamoLoaderData` and show `PageNav` (back to `/review`, label "Review") and `PageHeading` (eyebrow "WEAK JAMO", title `Practice ${targets.map(t => t.jamo).join(' ')}`).
  - Render `ReviewTypingSession` with `exercises` and a `buildBody` that sends the action schema fields:
    - per result `{ exerciseId, targetText, lessonType, wasCorrect, mistakeCount, typingSeconds, elapsedSeconds }`, with `lessonType` looked up from `exercises` by id;
    - plus `jamoCounts` from `metrics` when present.
  - **Completion view:**
    - "{correct} correct, {needs} need more practice".
    - For each target jamo, this session's accuracy from `metrics.jamoCounts[jamo]`: `accepted / (accepted + rejected)`, shown as a percentage, or "–" when absent.
      - Keep `metrics` in component state from the `buildBody` call, or recompute it from the session before submit.
    - A "Practice again" button that calls `revalidator.revalidate()` and resets local state, so the loader draws a new set.
    - A `Link` back to `/review`.
- [ ] **Step 5: Check Review Focus 5** by reading `lesson-session-store.start()`: it must create a new `submissionId` on every start. Ledger the result.
- [ ] **Step 6: Suggested commit** — `feat(practice): add the weak jamo practice page and Review entry`

---

### Task 7: Docs, DEC-051, and final checks

**Files:**

- Modify: `docs/DECISIONS.md` (DEC-051 and its index row)
- Modify: `docs/LEARNING-MODES.md`: Weak Jamo is now a mode. Describe its content source, its "no ReviewItem, no EXP yet" rule, and `practicesCompleted`, and remove it from the "future experiences" list.
- Modify: `docs/DOMAIN-MODEL.md`: the `weak-jamo` context in the `LearningSessionContext` block, plus `practicesCompleted` in the Player Stats period fields and `sessionAggregate`.
- Modify: `docs/SESSION-AND-HISTORY.md`: note that practice sessions (`weak-jamo`) use the same receipt boundary.
- Modify: `docs/PROGRESS.md`: add a row for Weak Jamo practice (Done, DEC-051).
- Modify: `docs/superpowers/specs/2026-10-09-weak-jamo-practice-design.md`: Status → Accepted as DEC-051.
- Append: `docs/log/2026-10.md` (read only its last lines).

- [ ] **Step 1: DEC-051** — "Weak Jamo practice picks Home exercises by the learner's weakest key-level jamo". Include:
  - The decisions table from the spec.
  - The reason: zero content reads, reusing the jamo stats and the Review player.
  - The `periodStatsFrom` change (lesson modes are now explicit).
  - The deferred practice EXP (DEC-045).
  - Rejected options: ReviewItem-based selection, synthetic drills, Learning Path lesson reads, and the `review` context.
- [ ] **Step 2: Topic docs** as listed above.
- [ ] **Step 3: Final checks**
  - Run `pnpm exec tsc -b` and `pnpm lint`; both must pass.
  - Re-run every test file touched in Tasks 1–6 in one `pnpm vitest run <files>`, plus `pnpm test:rules`.
  - Do not run full `pnpm test` or `pnpm build`.
- [ ] **Step 4: Log entry and handoff note**
  - Write a 3–5 bullet log entry.
  - Handoff note to the user:
    - No Rules change is needed.
    - Run full `pnpm test` and `pnpm build`.
    - Manually verify:
      - The `/review` card appears once a jamo has ≥ 20 attempts with mistakes.
      - Play `/review/weak-jamo`, then check `learningSessions` (`mode: 'weak-jamo'`), `dailyStats.practicesCompleted`, and `learnerStats/jamo`.
- [ ] **Step 5: Suggested commit** — `docs(practice): record DEC-051 weak jamo practice`
