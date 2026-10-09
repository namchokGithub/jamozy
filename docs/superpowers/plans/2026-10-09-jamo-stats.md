# Jamo and Lesson Stats (Spec B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record per-jamo (key-level) typing stats on every session submit for Guest (IndexedDB) and account (Firestore) users. Add pure rankings for jamo and lessons. Data only; no UI.

**Architecture:**

- Clients derive `JamoCounts` from finished `ExerciseResult`s. Accepted counts come from `buildExpectedKeys(targetText)`; rejected counts come from `MistakeEvent.expectedJamo`.
- Use cases pass the counts as `SessionSubmissionEffects.jamoCounts`, never as a `LearningSession` field.
- Inside the existing receipt-deduped submit transaction, both adapters read one map document, fold it with the pure `applyJamoCounts`, and write it back.
- Guest→account migration ignores jamo stats.

**Tech Stack:** TypeScript, React Router actions, Zod 4, Firebase modular SDK (`runTransaction`), IndexedDB, Vitest, `@firebase/rules-unit-testing` + Firestore Emulator (`pnpm test:rules`).

**Spec:** `docs/superpowers/specs/2026-10-09-jamo-stats-design.md`

## Global Constraints

- **Jamo identity:** count at the key level, using `ExpectedKey.jamo`.
  - `ㅘ` counts once as `ㅗ` and once as `ㅏ`; `ㄳ` counts as `ㄱ` and `ㅅ`; `ㄲ` counts once.
  - Skip `slot: 'literal'` keys and any jamo not in `JAMO_TO_KEY`.
- **Rejected input:** count it against the jamo that was _expected_ (`MistakeEvent.expectedJamo`), never the jamo that was pressed.
- **Storage:**
  - Firestore: `users/{userId}/learnerStats/jamo` → `{ jamo: Record<string, JamoStat> }`, written whole with `set`.
  - IndexedDB: store `learnerStats`, key `${userId}:jamo`, `VERSION = 8`.
- **Submit behavior:**
  - `jamoCounts` absent or empty → no read and no write of `learnerStats`.
  - Never write `undefined` field values to Firestore.
- **Migration:** `migrateSessionOutcome` never reads or writes `learnerStats`. This is an intentional exception to DEC-030.
- **Validation:** keys must be in `JAMO_TO_KEY`, and values must be integers in 0..10,000. On invalid input, drop `jamoCounts` and still submit the rest of the session.
- **Rankings:** `MIN_RANKED_JAMO_ATTEMPTS = 20`.
  - Weakest: highest mistake rate.
  - Strongest: lowest mistake rate.
  - Ties go to the jamo with more attempts.
- **Lesson rankings:** computed from `lessonProgress` with `status: 'completed'` only.
- **Testing:**
  - Run only the test files you add or change, plus `pnpm test:rules` for emulator files. Do **not** run full `pnpm test` or `pnpm build`.
  - Run `pnpm exec tsc -b` and `pnpm lint` once in Task 7.
- **Repo rules:**
  - Do not `git commit`; each task ends with a suggested message only.
  - Never add a Co-Authored-By trailer.
  - Change `firestore.rules` only after the user explicitly confirms (Task 2, Step 1).

## Review Focus

1. **Spaces and punctuation in targets** (`'안녕 하세요'`) must not create a `' '` key. Pinned in Task 1.
2. **A duplicate submit** (same session ID) must not add jamo counts twice. Pinned in Task 2 (emulator).
3. **Timestamps read back from Firestore** are `Timestamp` objects, not `Date`. Applying counts must still keep `firstPracticedAt` and must not crash. Pinned in Task 2 (emulator, second submit).
4. **A tampered or garbage payload** (unknown key `'x'`, negative or huge value) must still save the lesson, without jamo counts. Pinned in Task 4 and Task 5.
5. **A Home job queued before deploy** (no `jamoCounts` on `HomePartialResult`) must still submit and count only the new exercises. Pinned in Task 6.

---

## File Structure

| File                                                                        | Responsibility                                                                                    |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `src/domain/models/jamo-stat.ts` (create)                                   | Types, `jamoCountsFrom`, `mergeJamoCounts`, `applyJamoCounts`, `jamoRankings`, `jamoCountsSchema` |
| `src/domain/models/lesson-rankings.ts` (create)                             | `lessonRankings(progress)`                                                                        |
| `src/domain/repositories/session-submission-repository.ts` (modify)         | `SessionSubmissionEffects.jamoCounts?`                                                            |
| `src/infrastructure/firebase/repositories/firestore-jamo-stats.ts` (create) | Read, apply, and write the jamo doc inside a Firestore transaction                                |
| `firebase-session-submission-repository.ts` (modify)                        | Call the helper                                                                                   |
| `src/infrastructure/local/guest-database.ts` (modify)                       | Store `learnerStats` (v8); apply in `putSessionOnce`                                              |
| Application + features (modify)                                             | Produce and pass `jamoCounts` from each play mode                                                 |

---

### Task 1: Jamo and lesson stats domain

**Files:**

- Create: `src/domain/models/jamo-stat.ts`, `src/domain/models/jamo-stat.test.ts`
- Create: `src/domain/models/lesson-rankings.ts`, `src/domain/models/lesson-rankings.test.ts`

**Interfaces — Produces:**

```ts
export interface JamoStat {
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  firstPracticedAt: Date
  lastPracticedAt: Date
}
export type JamoStats = Record<string, JamoStat>
export type JamoCounts = Record<string, { accepted: number; rejected: number }>
export const MIN_RANKED_JAMO_ATTEMPTS = 20
export const jamoCountsSchema: z.ZodType<JamoCounts>
export function jamoCountsFrom(
  results: Array<Pick<ExerciseResult, 'targetText' | 'mistakes'>>,
): JamoCounts
export function mergeJamoCounts(
  a: JamoCounts | undefined,
  b: JamoCounts,
): JamoCounts
export function applyJamoCounts(
  current: JamoStats,
  counts: JamoCounts,
  now: Date,
): JamoStats
export interface RankedJamo {
  jamo: string
  attempts: number
  rejected: number
  mistakeRate: number
}
export function jamoRankings(stats: JamoStats): {
  mostPracticed: RankedJamo | null
  mostMistyped: RankedJamo | null
  weakest: RankedJamo | null
  strongest: RankedJamo | null
}
// lesson-rankings.ts
export function lessonRankings(progress: Progress[]): {
  bestAccuracy: { lessonId: string; bestAccuracy: number } | null
  mostReplayed: { lessonId: string; replays: number } | null
}
```

- [ ] **Step 1: Write the failing tests** (`jamo-stat.test.ts`)

```ts
import { describe, expect, it } from 'vitest'
import {
  applyJamoCounts,
  jamoCountsFrom,
  jamoCountsSchema,
  jamoRankings,
  mergeJamoCounts,
  type JamoStats,
} from './jamo-stat'

const mistake = (expectedJamo: string) => ({
  syllableIndex: 0,
  expectedCode: 'KeyH',
  expectedShift: false,
  expectedJamo,
  pressedCode: 'KeyJ',
  pressedShift: false,
})

describe('jamoCountsFrom', () => {
  it('counts key-level jamo: compound vowels split, doubles once', () => {
    expect(jamoCountsFrom([{ targetText: '과', mistakes: [] }])).toEqual({
      ㄱ: { accepted: 1, rejected: 0 },
      ㅗ: { accepted: 1, rejected: 0 },
      ㅏ: { accepted: 1, rejected: 0 },
    })
    expect(jamoCountsFrom([{ targetText: '까', mistakes: [] }])).toEqual({
      ㄲ: { accepted: 1, rejected: 0 },
      ㅏ: { accepted: 1, rejected: 0 },
    })
  })

  it('charges a mistake to the expected jamo', () => {
    expect(
      jamoCountsFrom([
        { targetText: '고', mistakes: [mistake('ㅗ'), mistake('ㅗ')] },
      ]).ㅗ,
    ).toEqual({ accepted: 1, rejected: 2 })
  })

  it('skips spaces, punctuation, and unknown expected jamo', () => {
    const counts = jamoCountsFrom([
      { targetText: '가 나!', mistakes: [mistake(' '), mistake('?')] },
    ])
    expect(Object.keys(counts).sort()).toEqual(['ㄱ', 'ㄴ', 'ㅏ'])
  })
})

describe('mergeJamoCounts', () => {
  it('adds counts per jamo', () => {
    expect(
      mergeJamoCounts(
        { ㄱ: { accepted: 1, rejected: 1 } },
        { ㄱ: { accepted: 2, rejected: 0 }, ㅏ: { accepted: 1, rejected: 0 } },
      ),
    ).toEqual({
      ㄱ: { accepted: 3, rejected: 1 },
      ㅏ: { accepted: 1, rejected: 0 },
    })
    expect(
      mergeJamoCounts(undefined, { ㄱ: { accepted: 1, rejected: 0 } }),
    ).toEqual({ ㄱ: { accepted: 1, rejected: 0 } })
  })
})

describe('applyJamoCounts', () => {
  const first = new Date('2026-10-01T00:00:00Z')
  const now = new Date('2026-10-09T00:00:00Z')

  it('adds counters, keeps firstPracticedAt, and adds new jamo', () => {
    const current: JamoStats = {
      ㄱ: {
        acceptedKeystrokes: 5,
        rejectedKeystrokes: 1,
        firstPracticedAt: first,
        lastPracticedAt: first,
      },
    }
    const next = applyJamoCounts(
      current,
      { ㄱ: { accepted: 2, rejected: 1 }, ㅏ: { accepted: 3, rejected: 0 } },
      now,
    )
    expect(next.ㄱ).toEqual({
      acceptedKeystrokes: 7,
      rejectedKeystrokes: 2,
      firstPracticedAt: first,
      lastPracticedAt: now,
    })
    expect(next.ㅏ).toEqual({
      acceptedKeystrokes: 3,
      rejectedKeystrokes: 0,
      firstPracticedAt: now,
      lastPracticedAt: now,
    })
  })

  it('does not add a key for a zero count', () => {
    expect(
      applyJamoCounts({}, { ㄱ: { accepted: 0, rejected: 0 } }, now),
    ).toEqual({})
  })
})

describe('jamoRankings', () => {
  const at = new Date(0)
  const stat = (accepted: number, rejected: number) => ({
    acceptedKeystrokes: accepted,
    rejectedKeystrokes: rejected,
    firstPracticedAt: at,
    lastPracticedAt: at,
  })

  it('ranks only jamo with at least 20 attempts for weakest and strongest', () => {
    const rankings = jamoRankings({
      ㄱ: stat(1, 1), // 50% but only 2 attempts
      ㅓ: stat(82, 18), // 18%
      ㅗ: stat(88, 12), // 12%
      ㄹ: stat(30, 0), // 0%
    })
    expect(rankings.weakest?.jamo).toBe('ㅓ')
    expect(rankings.strongest?.jamo).toBe('ㄹ')
    expect(rankings.mostPracticed).toMatchObject({ jamo: 'ㅓ', attempts: 100 })
    expect(rankings.mostMistyped).toMatchObject({ jamo: 'ㅓ', rejected: 18 })
    expect(rankings.weakest?.mistakeRate).toBeCloseTo(0.18)
  })

  it('breaks a rate tie by more attempts', () => {
    expect(
      jamoRankings({ ㄱ: stat(20, 0), ㄴ: stat(40, 0) }).strongest?.jamo,
    ).toBe('ㄴ')
  })

  it('returns null when there is no data or nothing reaches the minimum', () => {
    expect(jamoRankings({})).toEqual({
      mostPracticed: null,
      mostMistyped: null,
      weakest: null,
      strongest: null,
    })
    expect(jamoRankings({ ㄱ: stat(3, 1) }).weakest).toBeNull()
  })
})

describe('jamoCountsSchema', () => {
  it('accepts known jamo with integer counts and rejects anything else', () => {
    expect(
      jamoCountsSchema.safeParse({ ㄱ: { accepted: 2, rejected: 0 } }).success,
    ).toBe(true)
    expect(
      jamoCountsSchema.safeParse({ x: { accepted: 2, rejected: 0 } }).success,
    ).toBe(false)
    expect(
      jamoCountsSchema.safeParse({ ㄱ: { accepted: -1, rejected: 0 } }).success,
    ).toBe(false)
    expect(
      jamoCountsSchema.safeParse({ ㄱ: { accepted: 10_001, rejected: 0 } })
        .success,
    ).toBe(false)
    expect(
      jamoCountsSchema.safeParse({ ㄱ: { accepted: 1.5, rejected: 0 } })
        .success,
    ).toBe(false)
  })
})
```

`lesson-rankings.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { lessonRankings } from './lesson-rankings'
import type { Progress } from './progress'

const progress = (
  lessonId: string,
  overrides: Partial<Progress>,
): Progress => ({
  lessonId,
  status: 'completed',
  bestAccuracy: 0,
  bestSpeedWpm: 0,
  attempts: 1,
  lastAttemptAt: null,
  completedAt: null,
  ...overrides,
})

describe('lessonRankings', () => {
  it('uses completed lessons only', () => {
    const rankings = lessonRankings([
      progress('a', { bestAccuracy: 92, attempts: 4 }),
      progress('b', { bestAccuracy: 99, attempts: 2 }),
      progress('c', { status: 'unlocked', bestAccuracy: 100, attempts: 9 }),
    ])
    expect(rankings).toEqual({
      bestAccuracy: { lessonId: 'b', bestAccuracy: 99 },
      mostReplayed: { lessonId: 'a', replays: 3 },
    })
  })

  it('returns null without completed lessons or replays', () => {
    expect(
      lessonRankings([progress('a', { attempts: 1 })]).mostReplayed,
    ).toBeNull()
    expect(lessonRankings([])).toEqual({
      bestAccuracy: null,
      mostReplayed: null,
    })
  })
})
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/domain/models/jamo-stat.test.ts src/domain/models/lesson-rankings.test.ts`

- [ ] **Step 3: Implement `jamo-stat.ts`**

```ts
import { z } from 'zod'
import { JAMO_TO_KEY } from '../korean/keymap'
import { buildExpectedKeys } from '../korean/target-sequence'
import type { ExerciseResult } from '../korean/lesson-session'

// Per-learner key-level jamo stats (DEC-028, DEC-050). Rejected input is
// charged to the jamo that was expected, never the one pressed.

export interface JamoStat {
  acceptedKeystrokes: number
  rejectedKeystrokes: number
  firstPracticedAt: Date
  lastPracticedAt: Date
}
export type JamoStats = Record<string, JamoStat>
export type JamoCounts = Record<string, { accepted: number; rejected: number }>

export const MIN_RANKED_JAMO_ATTEMPTS = 20
const MAX_COUNT_PER_SESSION = 10_000

const isJamo = (jamo: string) => Object.hasOwn(JAMO_TO_KEY, jamo)
const count = z.number().int().min(0).max(MAX_COUNT_PER_SESSION)

export const jamoCountsSchema = z
  .record(z.string(), z.object({ accepted: count, rejected: count }))
  .refine((counts) => Object.keys(counts).every(isJamo))

function bump(
  counts: JamoCounts,
  jamo: string,
  field: 'accepted' | 'rejected',
) {
  if (!isJamo(jamo)) return
  const entry = (counts[jamo] ??= { accepted: 0, rejected: 0 })
  entry[field] += 1
}

export function jamoCountsFrom(
  results: Array<Pick<ExerciseResult, 'targetText' | 'mistakes'>>,
): JamoCounts {
  const counts: JamoCounts = {}
  for (const result of results) {
    for (const key of buildExpectedKeys(result.targetText))
      if (key.slot !== 'literal') bump(counts, key.jamo, 'accepted')
    for (const mistake of result.mistakes)
      bump(counts, mistake.expectedJamo, 'rejected')
  }
  return counts
}

export function mergeJamoCounts(
  a: JamoCounts | undefined,
  b: JamoCounts,
): JamoCounts {
  const merged: JamoCounts = {}
  for (const source of [a ?? {}, b])
    for (const [jamo, { accepted, rejected }] of Object.entries(source)) {
      const entry = (merged[jamo] ??= { accepted: 0, rejected: 0 })
      entry.accepted += accepted
      entry.rejected += rejected
    }
  return merged
}

export function applyJamoCounts(
  current: JamoStats,
  counts: JamoCounts,
  now: Date,
): JamoStats {
  const next: JamoStats = { ...current }
  for (const [jamo, { accepted, rejected }] of Object.entries(counts)) {
    if (accepted + rejected === 0) continue
    const existing = current[jamo]
    next[jamo] = {
      acceptedKeystrokes: (existing?.acceptedKeystrokes ?? 0) + accepted,
      rejectedKeystrokes: (existing?.rejectedKeystrokes ?? 0) + rejected,
      firstPracticedAt: existing?.firstPracticedAt ?? now,
      lastPracticedAt: now,
    }
  }
  return next
}

export interface RankedJamo {
  jamo: string
  attempts: number
  rejected: number
  mistakeRate: number
}

export function jamoRankings(stats: JamoStats) {
  const ranked: RankedJamo[] = Object.entries(stats).map(([jamo, stat]) => {
    const attempts = stat.acceptedKeystrokes + stat.rejectedKeystrokes
    return {
      jamo,
      attempts,
      rejected: stat.rejectedKeystrokes,
      mistakeRate: attempts === 0 ? 0 : stat.rejectedKeystrokes / attempts,
    }
  })
  const top = (items: RankedJamo[], score: (item: RankedJamo) => number) =>
    items.reduce<RankedJamo | null>((best, item) => {
      if (!best) return item
      const diff = score(item) - score(best)
      return diff > 0 || (diff === 0 && item.attempts > best.attempts)
        ? item
        : best
    }, null)
  const eligible = ranked.filter(
    (item) => item.attempts >= MIN_RANKED_JAMO_ATTEMPTS,
  )
  return {
    mostPracticed: top(ranked, (item) => item.attempts),
    mostMistyped: top(
      ranked.filter((item) => item.rejected > 0),
      (item) => item.rejected,
    ),
    weakest: top(eligible, (item) => item.mistakeRate),
    strongest: top(eligible, (item) => -item.mistakeRate),
  }
}
```

`lesson-rankings.ts`:

```ts
import type { Progress } from './progress'

// Lesson item stats (DEC-050), derived from stored lessonProgress only.
export function lessonRankings(progress: Progress[]) {
  const completed = progress.filter((entry) => entry.status === 'completed')
  const best = completed.reduce<Progress | null>(
    (top, entry) =>
      !top || entry.bestAccuracy > top.bestAccuracy ? entry : top,
    null,
  )
  const replayed = completed
    .filter((entry) => entry.attempts > 1)
    .reduce<Progress | null>(
      (top, entry) => (!top || entry.attempts > top.attempts ? entry : top),
      null,
    )
  return {
    bestAccuracy: best
      ? { lessonId: best.lessonId, bestAccuracy: best.bestAccuracy }
      : null,
    mostReplayed: replayed
      ? { lessonId: replayed.lessonId, replays: replayed.attempts - 1 }
      : null,
  }
}
```

Check: `ExpectedKey.slot` must include `'literal'` (it does in `target-sequence.ts`, `toExpectedKey(char, i, 'literal')`). If `buildExpectedKeys` throws on a character it cannot decompose, wrap the call in `try/catch` and skip that result. Add a test for it if so.

- [ ] **Step 4: Run, expect PASS** (same command)

- [ ] **Step 5: Suggested commit** — `feat(stats): add jamo stats and lesson rankings domain`

---

### Task 2: Firestore submit applies jamo counts (+ Rules, emulator test)

**Files:**

- Modify: `src/domain/repositories/session-submission-repository.ts`
- Create: `src/infrastructure/firebase/repositories/firestore-jamo-stats.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-session-submission-repository.ts`
- Modify: `firestore.rules`
- Modify: `src/infrastructure/firebase/repositories/firebase-session-submission-repository.emulator.test.ts` (append; the file is already in `test:rules`)
- Modify: `src/infrastructure/firebase/repositories/firebase-account-migration-repository.test.ts` (append)

**Interfaces:**

- Consumes: `applyJamoCounts`, `JamoCounts`, `JamoStats` (Task 1).
- Produces:
  - `SessionSubmissionEffects.jamoCounts?: JamoCounts`
  - `readJamoStatsWrite(deps: { db: Firestore; doc: typeof doc }, transaction: StatsTransaction, userId: string, counts: JamoCounts | undefined, now: Date): Promise<(writer: StatsTransaction) => void>`

- [ ] **Step 1: Confirm the Rules change with the user.** Ask: "Task 2 adds an owner-only `match /learnerStats/{doc}` to `firestore.rules`. OK to edit?" Continue only after an explicit yes.

- [ ] **Step 2: Write the failing tests**

Append to the emulator file (reuse its `learnerRepository`, `session`, and setup):

```ts
const jamoEffects = {
  progress: [],
  reviewItems: [],
  jamoCounts: {
    ㄱ: { accepted: 2, rejected: 1 },
    ㅏ: { accepted: 2, rejected: 0 },
  },
}

it('writes jamo stats once per session ID and keeps firstPracticedAt', async () => {
  const { firestore, repo } = learnerRepository()
  await repo.submit('learner-1', session, jamoEffects)
  await repo.submit('learner-1', session, jamoEffects) // retry: no double count
  const later = {
    ...session,
    id: 'session-2',
    completedAt: new Date('2026-10-10T01:00:00Z'),
  }
  await repo.submit('learner-1', later, jamoEffects) // reads stored Timestamps back

  const data = (
    await getDoc(doc(firestore, 'users/learner-1/learnerStats/jamo'))
  ).data()
  expect(data?.jamo.ㄱ).toMatchObject({
    acceptedKeystrokes: 4,
    rejectedKeystrokes: 2,
  })
  expect(data?.jamo.ㄱ.firstPracticedAt.toDate()).toEqual(session.completedAt)
  expect(data?.jamo.ㄱ.lastPracticedAt.toDate()).toEqual(later.completedAt)
})

it('does not create the jamo doc without counts', async () => {
  const { firestore, repo } = learnerRepository()
  await repo.submit('learner-1', session, noEffects)
  expect(
    (
      await getDoc(doc(firestore, 'users/learner-1/learnerStats/jamo'))
    ).exists(),
  ).toBe(false)
})

it('lets only the owner read learnerStats', async () => {
  const { repo } = learnerRepository()
  await repo.submit('learner-1', session, jamoEffects)
  const other = testEnvironment
    .authenticatedContext('learner-2')
    .firestore() as unknown as Firestore
  await assertFails(getDoc(doc(other, 'users/learner-1/learnerStats/jamo')))
})
```

Append to `firebase-account-migration-repository.test.ts` (reuse `createRepository` and `sessionOutcome`):

```ts
it('does not migrate jamo stats', async () => {
  const { repository, documents } = createRepository()
  await repository.migrateSessionOutcome('account-1', {
    ...sessionOutcome,
    effects: {
      ...sessionOutcome.effects,
      jamoCounts: { ㄱ: { accepted: 1, rejected: 0 } },
    },
  })
  expect(documents.has('users/account-1/learnerStats/jamo')).toBe(false)
})
```

- [ ] **Step 3: Run, expect FAIL** — `pnpm test:rules` (the new emulator tests fail; earlier ones pass), and `pnpm vitest run src/infrastructure/firebase/repositories/firebase-account-migration-repository.test.ts`. The migration test should already PASS; it pins that behavior.

- [ ] **Step 4: Implement**

`session-submission-repository.ts`:

```ts
import type { JamoCounts } from '../models/jamo-stat'
export interface SessionSubmissionEffects {
  progress: Progress[]
  reviewItems: ReviewItem[]
  // Key-level jamo counts (DEC-050); applied on submit, never migrated.
  jamoCounts?: JamoCounts
}
```

`firestore.rules`, inside `match /users/{userId}`:

```
      match /learnerStats/{statsId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
```

`firestore-jamo-stats.ts`:

```ts
import type { doc as docFn, Firestore, Transaction } from 'firebase/firestore'
import {
  applyJamoCounts,
  type JamoCounts,
  type JamoStat,
  type JamoStats,
} from '../../../domain/models/jamo-stat'

type StatsTransaction = Pick<Transaction, 'get' | 'set'>
type StoredJamoStat = Omit<JamoStat, 'firstPracticedAt' | 'lastPracticedAt'> & {
  firstPracticedAt: { toDate(): Date }
  lastPracticedAt: { toDate(): Date }
}

// Jamo stats (DEC-050) inside a submit transaction: read first, write after
// every other read, so callers keep Firestore's reads-before-writes rule.
export async function readJamoStatsWrite(
  deps: { db: Firestore; doc: typeof docFn },
  transaction: StatsTransaction,
  userId: string,
  counts: JamoCounts | undefined,
  now: Date,
): Promise<(writer: StatsTransaction) => void> {
  if (!counts || Object.keys(counts).length === 0) return () => {}
  const ref = deps.doc(deps.db, 'users', userId, 'learnerStats', 'jamo')
  const snapshot = await transaction.get(ref)
  const stored = (snapshot.exists() ? snapshot.data().jamo : undefined) as
    Record<string, StoredJamoStat> | undefined
  const current: JamoStats = Object.fromEntries(
    Object.entries(stored ?? {}).map(([jamo, stat]) => [
      jamo,
      {
        ...stat,
        firstPracticedAt: stat.firstPracticedAt.toDate(),
        lastPracticedAt: stat.lastPracticedAt.toDate(),
      },
    ]),
  )
  const next = applyJamoCounts(current, counts, now)
  return (writer) => {
    writer.set(ref, { jamo: next })
  }
}
```

`firebase-session-submission-repository.ts` `submit`:

- After `const writeStats = await readSessionStatsWrites(...)`, add:
  ```ts
  const writeJamo = await readJamoStatsWrite(
    { db, doc },
    transaction,
    userId,
    effects.jamoCounts,
    session.completedAt,
  )
  ```
- Call `writeJamo(transaction)` immediately before `return outcome`.
- If `effects.jamoCounts` is `undefined`, the `outcome` receipt contains `effects` with that key absent, because callers must omit it rather than set `undefined`. Task 4–6 enforce this.

- [ ] **Step 5: Run, expect PASS** — `pnpm test:rules` and `pnpm vitest run src/infrastructure/firebase/repositories/firebase-session-submission-repository.test.ts src/infrastructure/firebase/repositories/firebase-account-migration-repository.test.ts`

- [ ] **Step 6: Suggested commit** — `feat(stats): record jamo stats in the Firestore submit transaction`

---

### Task 3: Guest IndexedDB applies jamo counts

**Files:**

- Modify: `src/infrastructure/local/guest-database.ts`
- Modify: `src/infrastructure/local/guest-database-stats.test.ts` (append)

**Interfaces — Produces:** `guestJamoWrite(current: JamoStats | undefined, counts: JamoCounts | undefined, now: Date): JamoStats | null`, where `null` means skip the write. It is exported for tests.

- [ ] **Step 1: Write the failing test**

```ts
import { guestJamoWrite } from './guest-database'

describe('guestJamoWrite', () => {
  const now = new Date('2026-10-09T00:00:00Z')
  it('skips the write without counts and applies counts otherwise', () => {
    expect(guestJamoWrite(undefined, undefined, now)).toBeNull()
    expect(guestJamoWrite(undefined, {}, now)).toBeNull()
    expect(
      guestJamoWrite(undefined, { ㄱ: { accepted: 1, rejected: 0 } }, now),
    ).toEqual({
      ㄱ: {
        acceptedKeystrokes: 1,
        rejectedKeystrokes: 0,
        firstPracticedAt: now,
        lastPracticedAt: now,
      },
    })
  })
})
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/infrastructure/local/guest-database-stats.test.ts`

- [ ] **Step 3: Implement**

- Set `VERSION = 8` and add `'learnerStats'` to `stores`.
- Add:
  ```ts
  export function guestJamoWrite(
    current: JamoStats | undefined,
    counts: JamoCounts | undefined,
    now: Date,
  ): JamoStats | null {
    if (!counts || Object.keys(counts).length === 0) return null
    return applyJamoCounts(current ?? {}, counts, now)
  }
  ```
- `putSessionOnce`: widen `effects` to `SessionSubmissionEffects` (or add `jamoCounts?: JamoCounts`) and add `'learnerStats'` to the transaction's store list.
  - In `monthly.onsuccess`, before any `put`, issue `const jamo = transaction.objectStore('learnerStats').get(`${userId}:jamo`)`.
  - Move the existing writes into `jamo.onsuccess`, and add:
    ```ts
    const nextJamo = guestJamoWrite(
      (jamo.result as { jamo: JamoStats } | undefined)?.jamo,
      effects.jamoCounts,
      session.completedAt,
    )
    if (nextJamo)
      transaction
        .objectStore('learnerStats')
        .put({ jamo: nextJamo }, `${userId}:jamo`)
    ```
  - Add `jamo.onerror = () => reject(jamo.error)`.
- IndexedDB stores `Date` values natively, so no conversion is needed.

- [ ] **Step 4: Run, expect PASS** — the same test plus `pnpm vitest run src/infrastructure/local/local-session-submission-repository.test.ts`

- [ ] **Step 5: Suggested commit** — `feat(stats): record jamo stats for Guests in IndexedDB`

---

### Task 4: Learning Path and one-page send jamo counts

**Files:**

- Modify: `src/domain/korean/lesson-session.ts` (`LessonResult.jamoCounts`, `getLessonResult`, `lessonResultSchema`)
- Modify: `src/features/lesson/LessonTypingSession.tsx` (payload)
- Modify: `src/application/complete-lesson-session.ts` (effects)
- Modify: `src/domain/models/one-page-learning-checkpoint.ts`, `src/application/save-one-page-checkpoint.ts`
- Test: `src/domain/korean/lesson-session.test.ts`, `src/application/complete-lesson-session.test.ts`, `src/application/save-one-page-checkpoint.test.ts`

**Interfaces:**

- Consumes: `jamoCountsFrom`, `mergeJamoCounts`, `jamoCountsSchema` (Task 1); `SessionSubmissionEffects.jamoCounts` (Task 2).
- Produces: `LessonResult.jamoCounts?: JamoCounts`, `OnePagePartialLessonResult.jamoCounts?: JamoCounts`.

- [ ] **Step 1: Write the failing tests**

`lesson-session.test.ts`:

```ts
it('reports key-level jamo counts in the lesson result', () => {
  let state = startLessonSession([{ id: 'e1', targetText: '가' }])
  state = pressKey(state, 'KeyQ', false, 0) // wrong: expected ㄱ
  state = pressKey(state, 'KeyR', false, 1_000)
  state = pressKey(state, 'KeyK', false, 2_000)
  expect(getLessonResult(state).jamoCounts).toEqual({
    ㄱ: { accepted: 1, rejected: 1 },
    ㅏ: { accepted: 1, rejected: 0 },
  })
})

it('drops invalid jamo counts instead of rejecting the lesson result', () => {
  const base = {
    accuracy: 100,
    speedWpm: 0,
    durationSeconds: 1,
    startedAtMs: 0,
    exercisesAttempted: 1,
    acceptedKeystrokes: 2,
    rejectedKeystrokes: 0,
    mistakes: [],
  }
  const parsed = lessonResultSchema.parse({
    ...base,
    jamoCounts: { x: { accepted: -1, rejected: 0 } },
  })
  expect(parsed).not.toHaveProperty('jamoCounts')
  expect(
    lessonResultSchema.parse({
      ...base,
      jamoCounts: { ㄱ: { accepted: 1, rejected: 0 } },
    }).jamoCounts,
  ).toEqual({ ㄱ: { accepted: 1, rejected: 0 } })
})
```

`complete-lesson-session.test.ts` (reuse the stats test's deps):

```ts
it('passes jamo counts to the submission effects', async () => {
  // ... deps as in the stats test
  await completeLessonSession(
    deps,
    'user1',
    'l1',
    { ...resultWithStats, jamoCounts: { ㄱ: { accepted: 1, rejected: 0 } } },
    'jamo-1',
  )
  expect(deps.sessionSubmissionRepo.submissions[0]?.effects.jamoCounts).toEqual(
    { ㄱ: { accepted: 1, rejected: 0 } },
  )
})

it('omits jamoCounts from effects when the result has none', async () => {
  await completeLessonSession(deps, 'user1', 'l1', resultWithoutJamo, 'jamo-2')
  expect(deps.sessionSubmissionRepo.submissions[0]?.effects).not.toHaveProperty(
    'jamoCounts',
  )
})
```

`save-one-page-checkpoint.test.ts`: assert that after two recorded exercises (`'가'`, `'나'`), `completedLesson.result.jamoCounts` equals `{ ㄱ: {accepted:1,rejected:0}, ㄴ: {accepted:1,rejected:0}, ㅏ: {accepted:2,rejected:0} }`.

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/domain/korean/lesson-session.test.ts src/application/complete-lesson-session.test.ts src/application/save-one-page-checkpoint.test.ts`

- [ ] **Step 3: Implement**

- `lesson-session.ts`:
  - `LessonResult` gains `jamoCounts?: JamoCounts`. `getLessonResult` sets `jamoCounts: jamoCountsFrom(state.completedResults)`.
  - `lessonResultSchema` gains `jamoCounts: jamoCountsSchema.optional().catch(undefined)`.
  - After parsing, a caught value leaves `jamoCounts: undefined` on the object. Strip it with `.transform(({ jamoCounts, ...rest }) => (jamoCounts ? { ...rest, jamoCounts } : rest))` on the object schema so the key is absent.
  - Watch for a cycle: `jamo-stat.ts` imports `ExerciseResult` as a type only from `lesson-session.ts`, so the runtime import goes one way only.
- `LessonTypingSession.tsx`: add `...(result.jamoCounts ? { jamoCounts: result.jamoCounts } : {})` to `submittedPayload.current`.
- `complete-lesson-session.ts`: build the effects as `{ progress, reviewItems, ...(result.jamoCounts ? { jamoCounts: result.jamoCounts } : {}) }`.
- One-page:
  - `OnePagePartialLessonResult` gains `jamoCounts?: JamoCounts`.
  - `recordOnePageExercise` sets `jamoCounts: mergeJamoCounts(existing.jamoCounts, jamoCountsFrom([input.result]))` for a new exercise.
  - `lessonResult(partial)` returns `...(partial.jamoCounts ? { jamoCounts: partial.jamoCounts } : {})`.

- [ ] **Step 4: Run, expect PASS** (same command)

- [ ] **Step 5: Suggested commit** — `feat(stats): send jamo counts from Learning Path sessions`

---

### Task 5: Review sends jamo counts

**Files:**

- Modify: `src/application/submit-review-session.ts` (`SubmitReviewSessionInput.jamoCounts?`)
- Modify: `src/features/review/ReviewPage.action.ts` (schema)
- Modify: `src/features/review/ReviewTypingSession.tsx` (payload)
- Test: `src/application/submit-review-session.test.ts`, `src/features/review/ReviewPage.action.test.ts` (create if absent; otherwise append)

- [ ] **Step 1: Write the failing tests**

```ts
// submit-review-session.test.ts
it('passes jamo counts to the submission effects', async () => {
  const repo = new FakeReviewRepository()
  const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
  await repo.addReviewItem('u1', makeItem('a'))
  await submitReviewSession({ reviewRepo: repo, sessionSubmissionRepo }, 'u1', {
    ...input([{ itemId: 'a', wasCorrect: true }]),
    jamoCounts: { ㄱ: { accepted: 1, rejected: 0 } },
  })
  expect(sessionSubmissionRepo.submissions[0]?.effects.jamoCounts).toEqual({
    ㄱ: { accepted: 1, rejected: 0 },
  })
})
```

```ts
// ReviewPage.action.test.ts — invalid counts are dropped, the review still saves
it('drops invalid jamo counts and still submits', async () => {
  const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
  const action = createSubmitReviewSessionAction({
    reviewRepo: new FakeReviewRepository(),
    sessionSubmissionRepo,
    ensureUser: async () => ({ uid: 'u1' }),
  })
  const body = {
    submissionId: 's1',
    startedAtMs: 0,
    durationSeconds: 1,
    exercisesAttempted: 0,
    acceptedKeystrokes: 0,
    rejectedKeystrokes: 0,
    results: [],
    jamoCounts: { x: { accepted: 1, rejected: 0 } },
  }
  await action({
    request: new Request('http://test', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
    params: {},
    context: {},
  } as never)
  expect(sessionSubmissionRepo.submissions[0]?.effects).not.toHaveProperty(
    'jamoCounts',
  )
})
```

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/application/submit-review-session.test.ts src/features/review/ReviewPage.action.test.ts`

- [ ] **Step 3: Implement**

- `SubmitReviewSessionInput` gains `jamoCounts?: JamoCounts`. The effects become `{ progress: [], reviewItems, ...(input.jamoCounts ? { jamoCounts: input.jamoCounts } : {}) }`.
- `ReviewPage.action.ts`:
  - Add `jamoCounts: jamoCountsSchema.optional().catch(undefined)` to the schema.
  - Before calling the use case, drop the key when it is `undefined`: `const { jamoCounts, ...rest } = body; submitReviewSession(deps, uid, jamoCounts ? { ...rest, jamoCounts } : rest)`.
- `ReviewTypingSession.tsx`: add `...(metrics.jamoCounts ? { jamoCounts: metrics.jamoCounts } : {})` to the submitted body. `metrics` is `getLessonResult(session)` and already carries the counts after Task 4.

- [ ] **Step 4: Run, expect PASS** (same command)

- [ ] **Step 5: Suggested commit** — `feat(stats): send jamo counts from Review sessions`

---

### Task 6: Home sends jamo counts

**Files:**

- Modify: `src/domain/models/progress.ts` (`HomePartialResult.jamoCounts?`)
- Modify: `src/domain/models/home-sync-job.ts` (`HomeSessionTotals.jamoCounts?`)
- Modify: `src/domain/home/home-session.ts` (`homeReplayTotals`)
- Modify: `src/application/record-home-exercise.ts`, `src/application/home-session-submission.ts`
- Test: `src/application/record-home-exercise.test.ts`, `src/domain/home/home-session.test.ts`

- [ ] **Step 1: Write the failing tests** (`record-home-exercise.test.ts`; reuse `setup`, `lesson`, `result`, and `at`)

```ts
it('accumulates jamo counts across exercises and submits them on completion', async () => {
  const { deps, submissions } = setup()
  for (const id of ['e1', 'e2', 'e3'])
    await recordHomeExercise(deps, {
      userId: 'u1',
      lesson,
      result: result(id, 2, id === 'e2' ? 1 : 0),
      submissionId: `s-${id}`,
      now: at(0),
    })
  // targetText '가' each time; the mistake fixture expects ㄱ
  expect(submissions[0].effects.jamoCounts).toEqual({
    ㄱ: { accepted: 3, rejected: 1 },
    ㅏ: { accepted: 3, rejected: 0 },
  })
})

it('counts only new exercises for a partial result saved before jamo counts', async () => {
  const { deps, progressRepo, submissions } = setup()
  await progressRepo.saveProgress('u1', {
    lessonId: 'lesson-1',
    status: 'unlocked',
    bestAccuracy: 0,
    bestSpeedWpm: 0,
    attempts: 0,
    lastAttemptAt: at(0),
    completedAt: null,
    completedExerciseIds: ['e1', 'e2'],
    homePartialResult: {
      submissionId: 's-old',
      startedAtMs: at(0).getTime(),
      acceptedKeystrokes: 4,
      rejectedKeystrokes: 0,
    },
  })
  await recordHomeExercise(deps, {
    userId: 'u1',
    lesson,
    result: result('e3'),
    submissionId: 'x',
    now: at(10),
  })
  expect(submissions[0].effects.jamoCounts).toEqual({
    ㄱ: { accepted: 1, rejected: 0 },
    ㅏ: { accepted: 1, rejected: 0 },
  })
})
```

`home-session.test.ts`: extend the existing `homeReplayTotals` expectation with `jamoCounts: { ㄱ: { accepted: 1, rejected: 1 }, ㅏ: { accepted: 1, rejected: 0 } }`, matching that test's `'가'` exercise with one mistake. Adjust the expected jamo to the fixture's actual `expectedJamo`.

- [ ] **Step 2: Run, expect FAIL** — `pnpm vitest run src/application/record-home-exercise.test.ts src/domain/home/home-session.test.ts`

- [ ] **Step 3: Implement**

- Add `jamoCounts?: JamoCounts` to `HomePartialResult` and to `HomeSessionTotals`.
- `recordHomeExercise`:
  - Set `partial.jamoCounts = mergeJamoCounts(previous.jamoCounts, jamoCountsFrom([result]))`.
  - Pass `jamoCounts: partial.jamoCounts` in `totals`.
- `homeReplayTotals`: add `jamoCounts: getLessonResult(state, now).jamoCounts ?? {}`.
- `submitHomeSession`: build the effects as `{ progress: [input.progress], reviewItems: [], ...(input.totals.jamoCounts && Object.keys(input.totals.jamoCounts).length > 0 ? { jamoCounts: input.totals.jamoCounts } : {}) }`.
- `progress-mapper.ts` copies `homePartialResult` whole, so no change is needed there. Verify this.

- [ ] **Step 4: Run, expect PASS** (same command plus `pnpm vitest run src/application/home-session-submission.test.ts src/application/home-outbox.test.ts`)

- [ ] **Step 5: Suggested commit** — `feat(stats): send jamo counts from Home sessions`

---

### Task 7: Docs, DEC-050, and final checks

**Files:**

- Modify: `docs/DECISIONS.md` (DEC-050 entry and index row; amend the DEC-028 index status to `Accepted (JamoStat storage amended by DEC-050)`)
- Modify: `docs/DOMAIN-MODEL.md` (JamoStat section: path `learnerStats/jamo` map, key-level jamo, `literal` skipped; `SessionSubmissionEffects.jamoCounts`)
- Modify: `docs/AUTH-AND-PERSISTENCE.md` (Guest store `learnerStats`, DB v8; merge-policy row: jamo stats are not migrated)
- Modify: `docs/PROGRESS.md` (row "JamoStats domain/repository support" → Done (data only), with DEC-050)
- Modify: `docs/superpowers/specs/2026-10-09-jamo-stats-design.md` (Status → Accepted as DEC-050)
- Append: `docs/log/2026-10.md` (read only its last lines)

- [ ] **Step 1: DEC-050** — "Key-level jamo stats live in one map document, updated in the submit transaction". Include:
  - The decisions table from the spec.
  - The reasons: one read and one write per submit, versus 10–20 for per-jamo docs, and the rankings read one doc.
  - The migration exception.
  - Rejected options: per-jamo docs, fire-and-forget writes, and `increment()` per field.
- [ ] **Step 2: Topic docs** as listed under Files.
- [ ] **Step 3: Final checks**
  - Run `pnpm exec tsc -b` and `pnpm lint`; both must pass.
  - Re-run every test file touched in Tasks 1–6 in one `pnpm vitest run <files>` call, and run `pnpm test:rules`.
  - Do not run full `pnpm test` or `pnpm build`.
- [ ] **Step 4: Log entry and handoff note**
  - Write a 3–5 bullet log entry.
  - Handoff note to the user:
    - Deploy Rules (`learnerStats`) before code.
    - Run full `pnpm test` and `pnpm build`.
    - Manually verify: play a lesson, a review, and Home, then check `users/{id}/learnerStats/jamo`.
- [ ] **Step 5: Suggested commit** — `docs(stats): record DEC-050 jamo stats`
