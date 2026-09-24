# Review System UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real UI for the review system — a `/review` route that shows due `ReviewItem`s, lets a learner practice them by typing (reusing the existing Korean typing engine and virtual keyboard, not a new mechanic), and advances/resets each item's Leitner box on completion.

**Architecture:** Almost everything is reused as-is: `lesson-session.ts` sequences the review items (it only needs `{id, targetText}[]`), `useLessonSessionStore` (already hardened against cross-mount staleness) drives the session, `VirtualKeyboard.tsx` renders unchanged. The genuinely new pieces are a `submit-review-session.ts` use case, a `/review` route (loader + action + page), a `ReviewTypingSession.tsx` sibling to `LessonTypingSession.tsx`, and a due-count badge on `CourseListPage`.

**Tech Stack:** React 19, TypeScript 5, React Router 8 (actions + `useFetcher`), Zustand, Zod 4, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-09-24-review-session-design.md`

## Global Constraints

- `getDueReviewItems` gains a `limit: number = Infinity` parameter — defaults to unbounded so `CourseListPage`'s due-count badge is never silently capped; the `/review` route's own loader is the one place that passes `limit: 20`.
- `wasCorrect` for a review item is `completedResult.mistakes.length === 0` — a single mistake anywhere while typing the item makes the whole item incorrect, even if the learner finishes it cleanly afterward (the typing engine's jamo-level blocking means every item is eventually "finished correctly," so this is the only signal that distinguishes a clean attempt from one with a slip).
- No same-session requeue of a wrong item — a single linear pass, exactly like `lesson-session.ts` already sequences a lesson's exercises. A wrong item's box resets to 1 and it becomes due again in a future session.
- The route action's payload is exactly `{ results: [{ itemId: string, wasCorrect: boolean }] }` — never a full `ReviewItem`, never a client-supplied user id. Every item is re-looked-up server-side via `reviewRepo.getReviewItem(userId, itemId)`, where `userId` always comes from `ensureUser()`.
- No persistent nav bar — the only entry point to `/review` is a conditional link on `CourseListPage`, shown only when the due count is greater than 0.
- `ReviewTypingSession.tsx` is a new, separate component — not a variant of `LessonTypingSession.tsx`, not a shared hook. It reuses the same store/domain logic but has a completely different completion payload and outcome type.
- No Firestore rules changes — `users/{userId}/**` already covers `reviewItems`.

## Review Focus

1. **`wasCorrect` must reflect "any mistake at all," not "did it eventually finish"** — a learner who mistypes once, corrects it, and finishes an item must still see that item's box reset to 1, not advance.
2. **The due-count badge must show the true unbounded count, never silently capped to the 20-item session size** — a learner with 45 items due should see "45," not "20."
3. **An `itemId` that doesn't resolve to a `ReviewItem` under the authenticated uid (stale client state, a removed item, or a value referencing another user's item) must be skipped silently, never thrown, and must never touch another user's data** — the lookup path is uid-scoped from `ensureUser()`, not from anything the client sends.
4. **`ReviewTypingSession` must be immune to the same cross-mount stale-session bug fixed in `LessonTypingSession`** — the store's `generation` counter already covers any consumer, but this component must actually key its submit effect on it, and its test must render through `<StrictMode>` to prove it (the bug only manifested under `StrictMode`'s dev-mode double-invoke of mount effects, which a plain RTL `render()` doesn't exercise).
5. **The empty state (`ReviewPage` with 0 due items) and a freshly re-visited `/review` after a completed session must both render correctly** — no stale summary shown to a learner who hasn't started a session yet, no crash on an empty item list.

---

### Task 1: `get-review-items.ts` — add an optional, unbounded-by-default `limit`

**Files:**
- Modify: `src/application/get-review-items.ts`
- Modify: `src/application/get-review-items.test.ts`

**Interfaces:**
- Produces: `getDueReviewItems(reviewRepo, userId, now?, limit?)` — `limit` defaults to `Infinity`. Consumed by Task 3 (`ReviewPage.loader.ts`, passes `limit: 20`) and Task 7 (`CourseListPage.loader.ts`, passes no `limit`).

- [ ] **Step 1: Write the failing tests**

Add these two tests to the existing `describe('getDueReviewItems', ...)` block in `src/application/get-review-items.test.ts` (its existing 3 tests and `makeItem` helper stay unchanged):

```ts
  it('returns every due item when no limit is given (unbounded)', async () => {
    const repo = new FakeReviewRepository()
    for (let i = 0; i < 25; i++) {
      await repo.addReviewItem('u1', makeItem(`due-${i}`, { nextReviewAt: now }))
    }
    const items = await getDueReviewItems(repo, 'u1', now)
    expect(items).toHaveLength(25)
  })

  it('caps the returned items to an explicit limit, without dropping the rest from the repository', async () => {
    const repo = new FakeReviewRepository()
    for (let i = 0; i < 5; i++) {
      await repo.addReviewItem('u1', makeItem(`due-${i}`, { nextReviewAt: now }))
    }
    const items = await getDueReviewItems(repo, 'u1', now, 3)
    expect(items).toHaveLength(3)

    const allStillThere = await repo.getReviewItems('u1')
    expect(allStillThere.filter((i) => !i.resolved && i.nextReviewAt <= now)).toHaveLength(5)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/application/get-review-items.test.ts`
Expected: FAIL — `getDueReviewItems` doesn't accept a 4th argument yet, and the unbounded test currently passes coincidentally (no cap exists) but the capped test fails since nothing slices the array.

- [ ] **Step 3: Implement**

Replace `src/application/get-review-items.ts` in full:

```ts
import type { ReviewRepository } from '../domain/repositories/review-repository'
import type { ReviewItem } from '../domain/models/review-item'

export async function getDueReviewItems(
  reviewRepo: ReviewRepository,
  userId: string,
  now: Date = new Date(),
  limit: number = Infinity,
): Promise<ReviewItem[]> {
  const items = await reviewRepo.getReviewItems(userId)
  return items.filter((item) => !item.resolved && item.nextReviewAt <= now).slice(0, limit)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/application/get-review-items.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/application/get-review-items.ts src/application/get-review-items.test.ts
git commit -m "feat(review): add an optional, unbounded-by-default limit to getDueReviewItems"
```

---

### Task 2: `submit-review-session.ts` — the new orchestrating use case

**Files:**
- Create: `src/application/submit-review-session.ts`
- Test: `src/application/submit-review-session.test.ts`

**Interfaces:**
- Consumes: `submitReviewResult` (`src/application/submit-review-result.ts`, already exists — signature `submitReviewResult(reviewRepo, userId, item: ReviewItem, wasCorrect: boolean, now?): Promise<ReviewItem>`), `ReviewRepository.getReviewItem(userId, itemId): Promise<ReviewItem | null>` (already exists).
- Produces: `SubmitReviewSessionResult { itemId: string; wasCorrect: boolean }`, `SubmitReviewSessionOutcome { correctCount: number; needsPracticeCount: number }`, `submitReviewSession(reviewRepo, userId, results, now?): Promise<SubmitReviewSessionOutcome>`. Consumed by Task 4 (`ReviewPage.action.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { submitReviewSession } from './submit-review-session'
import { FakeReviewRepository } from '../test/fakes'
import type { ReviewItem } from '../domain/models/review-item'

function makeItem(id: string, overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id,
    sourceLessonId: 'l1',
    sourceExerciseId: 'e1',
    targetText: '안녕',
    reason: 'mistake',
    mistakeCount: 1,
    lastMistakeAt: new Date('2026-01-01'),
    resolved: false,
    box: 1,
    nextReviewAt: new Date('2026-01-02'),
    ...overrides,
  }
}

describe('submitReviewSession', () => {
  const now = new Date('2026-01-05')

  it('advances a correct item and resets an incorrect one, counting each', async () => {
    const repo = new FakeReviewRepository()
    await repo.addReviewItem('u1', makeItem('a', { box: 2 }))
    await repo.addReviewItem('u1', makeItem('b', { box: 3 }))

    const outcome = await submitReviewSession(
      repo,
      'u1',
      [
        { itemId: 'a', wasCorrect: true },
        { itemId: 'b', wasCorrect: false },
      ],
      now,
    )

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 1 })
    expect((await repo.getReviewItem('u1', 'a'))?.box).toBe(3)
    expect((await repo.getReviewItem('u1', 'b'))?.box).toBe(1)
  })

  it('marks an item resolved once a correct answer pushes its box to 5, still counting it correct', async () => {
    const repo = new FakeReviewRepository()
    await repo.addReviewItem('u1', makeItem('a', { box: 4 }))

    const outcome = await submitReviewSession(repo, 'u1', [{ itemId: 'a', wasCorrect: true }], now)

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 0 })
    expect((await repo.getReviewItem('u1', 'a'))?.resolved).toBe(true)
  })

  it('skips an itemId that does not resolve to a ReviewItem under this uid, without throwing', async () => {
    const repo = new FakeReviewRepository()
    await repo.addReviewItem('u1', makeItem('a'))

    const outcome = await submitReviewSession(
      repo,
      'u1',
      [
        { itemId: 'a', wasCorrect: true },
        { itemId: 'does-not-exist', wasCorrect: true },
      ],
      now,
    )

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 0 })
  })

  it('never resolves an itemId that belongs to a different user', async () => {
    const repo = new FakeReviewRepository()
    await repo.addReviewItem('otherUser', makeItem('a'))

    const outcome = await submitReviewSession(repo, 'u1', [{ itemId: 'a', wasCorrect: true }], now)

    expect(outcome).toEqual({ correctCount: 0, needsPracticeCount: 0 })
    expect((await repo.getReviewItem('otherUser', 'a'))?.box).toBe(1) // untouched
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/application/submit-review-session.test.ts`
Expected: FAIL — `src/application/submit-review-session.ts` does not exist yet.

- [ ] **Step 3: Implement**

```ts
import type { ReviewRepository } from '../domain/repositories/review-repository'
import { submitReviewResult } from './submit-review-result'

export interface SubmitReviewSessionResult {
  itemId: string
  wasCorrect: boolean
}

export interface SubmitReviewSessionOutcome {
  correctCount: number
  needsPracticeCount: number
}

export async function submitReviewSession(
  reviewRepo: ReviewRepository,
  userId: string,
  results: SubmitReviewSessionResult[],
  now: Date = new Date(),
): Promise<SubmitReviewSessionOutcome> {
  let correctCount = 0
  let needsPracticeCount = 0

  for (const { itemId, wasCorrect } of results) {
    const item = await reviewRepo.getReviewItem(userId, itemId)
    if (!item) continue

    await submitReviewResult(reviewRepo, userId, item, wasCorrect, now)
    if (wasCorrect) {
      correctCount += 1
    } else {
      needsPracticeCount += 1
    }
  }

  return { correctCount, needsPracticeCount }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/application/submit-review-session.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/application/submit-review-session.ts src/application/submit-review-session.test.ts
git commit -m "feat(review): add submit-review-session orchestrating use case"
```

---

### Task 3: `ReviewPage.loader.ts`

**Files:**
- Create: `src/features/review/ReviewPage.loader.ts`
- Test: `src/features/review/ReviewPage.loader.test.ts`

**Interfaces:**
- Consumes: `getDueReviewItems` (Task 1).
- Produces: `ReviewLoaderData { items: ReviewItem[] }`, `createReviewLoader(deps: { reviewRepo: ReviewRepository; ensureUser: () => Promise<{ uid: string }> })`. Consumed by Task 6 (`ReviewPage.tsx`) and Task 8 (`router.ts`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createReviewLoader } from './ReviewPage.loader'
import { FakeReviewRepository } from '../../test/fakes'
import type { ReviewItem } from '../../domain/models/review-item'

function makeItem(id: string, overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id,
    sourceLessonId: 'l1',
    sourceExerciseId: 'e1',
    targetText: '안녕',
    reason: 'mistake',
    mistakeCount: 1,
    lastMistakeAt: new Date('2026-01-01'),
    resolved: false,
    box: 1,
    nextReviewAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('createReviewLoader', () => {
  it('signs in, then returns up to 20 due items', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const reviewRepo = new FakeReviewRepository()
    for (let i = 0; i < 25; i++) {
      await reviewRepo.addReviewItem('user1', makeItem(`due-${i}`))
    }
    const loader = createReviewLoader({ reviewRepo, ensureUser })

    const data = await loader()

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.items).toHaveLength(20)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/review/ReviewPage.loader.test.ts`
Expected: FAIL — `src/features/review/ReviewPage.loader.ts` does not exist yet.

- [ ] **Step 3: Implement**

```ts
import { getDueReviewItems } from '../../application/get-review-items'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import type { ReviewItem } from '../../domain/models/review-item'

export interface ReviewLoaderData {
  items: ReviewItem[]
}

export function createReviewLoader(deps: {
  reviewRepo: ReviewRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<ReviewLoaderData> => {
    const user = await deps.ensureUser()
    const items = await getDueReviewItems(deps.reviewRepo, user.uid, new Date(), 20)
    return { items }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/review/ReviewPage.loader.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/review/ReviewPage.loader.ts src/features/review/ReviewPage.loader.test.ts
git commit -m "feat(review): add the /review route loader"
```

---

### Task 4: `ReviewPage.action.ts`

**Files:**
- Create: `src/features/review/ReviewPage.action.ts`
- Test: `src/features/review/ReviewPage.action.test.ts`

**Interfaces:**
- Consumes: `submitReviewSession`, `SubmitReviewSessionOutcome` (Task 2).
- Produces: `createSubmitReviewSessionAction(deps: { reviewRepo: ReviewRepository; ensureUser: () => Promise<{ uid: string }> })` returning a React Router `ActionFunction`. Consumed by Task 8 (`router.ts`); its payload shape (`{ results: [{ itemId, wasCorrect }] }`) is what Task 5 (`ReviewTypingSession.tsx`) must submit.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from 'vitest'
import { createSubmitReviewSessionAction } from './ReviewPage.action'
import { FakeReviewRepository } from '../../test/fakes'
import type { ReviewItem } from '../../domain/models/review-item'

function makeItem(id: string, overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id,
    sourceLessonId: 'l1',
    sourceExerciseId: 'e1',
    targetText: '안녕',
    reason: 'mistake',
    mistakeCount: 1,
    lastMistakeAt: new Date('2026-01-01'),
    resolved: false,
    box: 1,
    nextReviewAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('createSubmitReviewSessionAction', () => {
  it('signs in, parses the request body, and submits the review session', async () => {
    const reviewRepo = new FakeReviewRepository()
    await reviewRepo.addReviewItem('user1', makeItem('a'))
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const action = createSubmitReviewSessionAction({ reviewRepo, ensureUser })

    const request = new Request('http://localhost/review', {
      method: 'POST',
      body: JSON.stringify({ results: [{ itemId: 'a', wasCorrect: true }] }),
    })

    const outcome = await action({ request } as never)

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 0 })
  })

  it('rejects a malformed request body', async () => {
    const reviewRepo = new FakeReviewRepository()
    const action = createSubmitReviewSessionAction({
      reviewRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })
    const request = new Request('http://localhost/review', {
      method: 'POST',
      body: JSON.stringify({ results: [{ itemId: 'a' }] }), // missing wasCorrect
    })

    await expect(action({ request } as never)).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/review/ReviewPage.action.test.ts`
Expected: FAIL — `src/features/review/ReviewPage.action.ts` does not exist yet.

- [ ] **Step 3: Implement**

```ts
import { z } from 'zod'
import type { ActionFunctionArgs } from 'react-router'
import {
  submitReviewSession,
  type SubmitReviewSessionOutcome,
} from '../../application/submit-review-session'
import type { ReviewRepository } from '../../domain/repositories/review-repository'

const reviewSessionResultSchema = z.object({
  results: z.array(
    z.object({
      itemId: z.string(),
      wasCorrect: z.boolean(),
    }),
  ),
})

export function createSubmitReviewSessionAction(deps: {
  reviewRepo: ReviewRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async ({ request }: ActionFunctionArgs): Promise<SubmitReviewSessionOutcome> => {
    const body = reviewSessionResultSchema.parse(await request.json())
    const user = await deps.ensureUser()
    return submitReviewSession(deps.reviewRepo, user.uid, body.results)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/review/ReviewPage.action.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/review/ReviewPage.action.ts src/features/review/ReviewPage.action.test.ts
git commit -m "feat(review): add the /review route action"
```

---

### Task 5: `ReviewTypingSession.tsx`

**Files:**
- Create: `src/features/review/ReviewTypingSession.tsx`
- Test: `src/features/review/ReviewTypingSession.test.tsx`

**Interfaces:**
- Consumes: `useLessonSessionStore` (`src/features/typing/lesson-session-store.ts`, already exists — `{ session, start(exercises): number, pressKey(code, shiftKey), generation: number }`), `getCharacterStates`/`getComposedText` (`src/domain/korean/typing-session.ts`), `getLessonProgress` (`src/domain/korean/lesson-session.ts`), `KEY_TO_JAMO` (`src/domain/korean/keymap.ts`), `VirtualKeyboard` (`src/features/typing/VirtualKeyboard.tsx`), `ReviewItem` (`src/domain/models/review-item.ts`), `SubmitReviewSessionOutcome` (Task 2).
- Produces: `ReviewTypingSession` default export, props `{ items: ReviewItem[]; onComplete: (outcome: SubmitReviewSessionOutcome) => void }`. Consumed by Task 6 (`ReviewPage.tsx`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReviewTypingSession from './ReviewTypingSession'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import type { ReviewItem } from '../../domain/models/review-item'
import type { SubmitReviewSessionOutcome } from '../../application/submit-review-session'

function makeItem(id: string, overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id,
    sourceLessonId: 'l1',
    sourceExerciseId: 'e1',
    targetText: '가',
    reason: 'mistake',
    mistakeCount: 1,
    lastMistakeAt: new Date('2026-01-01'),
    resolved: false,
    box: 1,
    nextReviewAt: new Date('2026-01-01'),
    ...overrides,
  }
}

const fakeOutcome: SubmitReviewSessionOutcome = { correctCount: 1, needsPracticeCount: 0 }

function renderSession(
  onComplete: (outcome: SubmitReviewSessionOutcome) => void,
  items: ReviewItem[] = [makeItem('a')],
  action: (args: { request: Request }) => Promise<SubmitReviewSessionOutcome> = async () => fakeOutcome,
) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: () => <ReviewTypingSession items={items} onComplete={onComplete} />,
        action,
      },
    ],
    { initialEntries: ['/'] },
  )
  // Matches src/main.tsx, which wraps the whole app in StrictMode — the same
  // reasoning as LessonTypingSession.test.tsx.
  return render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

describe('ReviewTypingSession', () => {
  beforeEach(() => {
    useLessonSessionStore.setState({ session: null })
  })

  it('highlights the current character and updates the composed text on a correct keydown', async () => {
    renderSession(vi.fn())
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    expect(await screen.findByText('Typed: ㄱ')).toBeInTheDocument()
  })

  it('submits the result and calls onComplete once the review session finishes', async () => {
    const onComplete = vi.fn()
    renderSession(onComplete)
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(onComplete).toHaveBeenCalledWith(fakeOutcome)
  })

  it('submits wasCorrect:false for an item typed with at least one mistake, even once finished', async () => {
    const onComplete = vi.fn()
    const action = vi.fn(async ({ request }: { request: Request }) => {
      const body = (await request.json()) as { results: Array<{ itemId: string; wasCorrect: boolean }> }
      return {
        correctCount: body.results.filter((r) => r.wasCorrect).length,
        needsPracticeCount: body.results.filter((r) => !r.wasCorrect).length,
      }
    })
    renderSession(onComplete, [makeItem('a')], action)
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyT', shiftKey: false }) // wrong key first
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false }) // now correct
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(onComplete).toHaveBeenCalledWith({ correctCount: 0, needsPracticeCount: 1 })
  })

  it('stops handling keydowns after unmount', async () => {
    const { unmount } = renderSession(vi.fn())
    await screen.findByText('가')

    unmount()
    const sessionAfterUnmount = useLessonSessionStore.getState().session
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })

    expect(useLessonSessionStore.getState().session).toBe(sessionAfterUnmount)
  })

  it("does not auto-submit a previous review session's stale completed session when a new one mounts", async () => {
    const itemsA = [makeItem('a')]
    const onCompleteA = vi.fn()
    const { unmount } = renderSession(onCompleteA, itemsA)
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })
    await waitFor(() => expect(onCompleteA).toHaveBeenCalledOnce())
    unmount()

    const itemsB = [makeItem('b', { targetText: '나' })]
    const actionSpyB = vi.fn(async () => fakeOutcome)
    const onCompleteB = vi.fn()
    renderSession(onCompleteB, itemsB, actionSpyB)
    await screen.findByText('나')

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(actionSpyB).not.toHaveBeenCalled()
    expect(onCompleteB).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/review/ReviewTypingSession.test.tsx`
Expected: FAIL — `src/features/review/ReviewTypingSession.tsx` does not exist yet.

- [ ] **Step 3: Implement**

```tsx
import { useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import { getCharacterStates, getComposedText } from '../../domain/korean/typing-session'
import { getLessonProgress } from '../../domain/korean/lesson-session'
import { KEY_TO_JAMO } from '../../domain/korean/keymap'
import VirtualKeyboard from '../typing/VirtualKeyboard'
import type { ReviewItem } from '../../domain/models/review-item'
import type { SubmitReviewSessionOutcome } from '../../application/submit-review-session'

interface ReviewTypingSessionProps {
  items: ReviewItem[]
  onComplete: (outcome: SubmitReviewSessionOutcome) => void
}

export default function ReviewTypingSession({ items, onComplete }: ReviewTypingSessionProps) {
  const { session, start, pressKey, generation } = useLessonSessionStore()
  const fetcher = useFetcher<SubmitReviewSessionOutcome>()
  const hasStarted = useRef(false)
  const hasSubmitted = useRef(false)
  // See LessonTypingSession.tsx / DEC-018 for why this needs to be a
  // generation match rather than a one-shot ref flag: useLessonSessionStore
  // is a module-level singleton shared with the lesson-typing flow too, and
  // React StrictMode's dev-mode double-invoke of mount effects defeats a
  // one-shot guard.
  const myGenerationRef = useRef<number | null>(null)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    myGenerationRef.current = start(items.map((item) => ({ id: item.id, targetText: item.targetText })))
  }, [items, start])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (KEY_TO_JAMO[event.code]) {
        event.preventDefault()
      }
      pressKey(event.code, event.shiftKey)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pressKey])

  useEffect(() => {
    if (generation !== myGenerationRef.current) {
      return
    }
    if (session?.status === 'completed' && !hasSubmitted.current) {
      hasSubmitted.current = true
      const results = session.completedResults.map((result) => ({
        itemId: result.exerciseId,
        wasCorrect: result.mistakes.length === 0,
      }))
      fetcher.submit({ results }, { method: 'post', encType: 'application/json' })
    }
  }, [session, generation, fetcher])

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      onComplete(fetcher.data)
    }
  }, [fetcher.state, fetcher.data, onComplete])

  if (!session || session.status === 'completed') {
    return <p className="mt-4 text-sm text-slate-500">Saving…</p>
  }

  const progress = getLessonProgress(session)
  const characters = Array.from(session.currentSession.targetText)
  const characterStates = getCharacterStates(session.currentSession)
  const composed = getComposedText(session.currentSession)
  const nextKey = session.currentSession.expectedKeys[session.currentSession.keyIndex]

  return (
    <div>
      <p className="text-sm text-slate-500">
        {progress.current} / {progress.total}
      </p>

      <div className="mt-4 flex gap-1 text-3xl">
        {characters.map((char, index) => (
          <span
            key={index}
            className={
              characterStates[index] === 'correct'
                ? 'text-emerald-600'
                : characterStates[index] === 'current'
                  ? 'text-slate-900 underline'
                  : 'text-slate-300'
            }
          >
            {char}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-500">Typed: {composed}</p>
      <VirtualKeyboard nextKey={nextKey} />
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/review/ReviewTypingSession.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors. (The `fetcher.submit({ results }, ...)` call builds a fresh object literal from a `.map()` result, not a named-interface value passed through directly — this is the same shape that satisfies react-router's `JsonObject` typing that `LessonTypingSession.tsx` needed a fix for; if `tsc` still complains, apply the same fresh-literal reshaping used there.)

- [ ] **Step 6: Commit**

```bash
git add src/features/review/ReviewTypingSession.tsx src/features/review/ReviewTypingSession.test.tsx
git commit -m "feat(review): add the interactive ReviewTypingSession component"
```

---

### Task 6: `ReviewPage.tsx`

**Files:**
- Create: `src/features/review/ReviewPage.tsx`
- Test: `src/features/review/ReviewPage.test.tsx`

**Interfaces:**
- Consumes: `ReviewLoaderData` (Task 3), `ReviewTypingSession` (Task 5), `SubmitReviewSessionOutcome` (Task 2).
- Produces: `ReviewPage` default export. Consumed by Task 8 (`router.ts`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import ReviewPage from './ReviewPage'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import type { ReviewItem } from '../../domain/models/review-item'
import type { SubmitReviewSessionOutcome } from '../../application/submit-review-session'

function makeItem(id: string, overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id,
    sourceLessonId: 'l1',
    sourceExerciseId: 'e1',
    targetText: '가',
    reason: 'mistake',
    mistakeCount: 1,
    lastMistakeAt: new Date('2026-01-01'),
    resolved: false,
    box: 1,
    nextReviewAt: new Date('2026-01-01'),
    ...overrides,
  }
}

const fakeOutcome: SubmitReviewSessionOutcome = { correctCount: 1, needsPracticeCount: 0 }

describe('ReviewPage', () => {
  beforeEach(() => {
    useLessonSessionStore.setState({ session: null })
  })

  it('shows an empty state when nothing is due', async () => {
    const router = createMemoryRouter(
      [{ path: '/', Component: ReviewPage, loader: async () => ({ items: [] }) }],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Nothing due right now.')).toBeInTheDocument()
  })

  it('shows a preview list and Start Review button, then switches to the typing session on click', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: ReviewPage,
          loader: async () => ({ items: [makeItem('a')] }),
          action: async () => fakeOutcome,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('가')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Start Review' }))

    expect(await screen.findByText('0 / 1')).toBeInTheDocument()
  })

  it('shows the summary once the review session finishes', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: ReviewPage,
          loader: async () => ({ items: [makeItem('a')] }),
          action: async () => fakeOutcome,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start Review' }))
    await screen.findByText('0 / 1')
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    expect(await screen.findByText('Review complete!')).toBeInTheDocument()
    expect(screen.getByText('1 correct, 0 need more practice')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/review/ReviewPage.test.tsx`
Expected: FAIL — `src/features/review/ReviewPage.tsx` does not exist yet.

- [ ] **Step 3: Implement**

```tsx
import { useState } from 'react'
import { Link, useLoaderData } from 'react-router'
import type { ReviewLoaderData } from './ReviewPage.loader'
import ReviewTypingSession from './ReviewTypingSession'
import type { SubmitReviewSessionOutcome } from '../../application/submit-review-session'

export default function ReviewPage() {
  const { items } = useLoaderData() as ReviewLoaderData
  const [started, setStarted] = useState(false)
  const [outcome, setOutcome] = useState<SubmitReviewSessionOutcome | null>(null)

  if (outcome) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-medium text-slate-900">Review complete!</h1>
        <p className="mt-2 text-slate-700">
          {outcome.correctCount} correct, {outcome.needsPracticeCount} need more practice
        </p>
        <Link to="/" className="mt-4 inline-block text-sm text-slate-600 underline">
          Back to Course List
        </Link>
      </main>
    )
  }

  if (started) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-medium text-slate-900">Review</h1>
        <ReviewTypingSession items={items} onComplete={setOutcome} />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">Review</h1>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Nothing due right now.</p>
      ) : (
        <>
          <ul className="mt-6 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 p-3 text-slate-900">
                {item.targetText}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-white"
          >
            Start Review
          </button>
        </>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/features/review/ReviewPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/review/ReviewPage.tsx src/features/review/ReviewPage.test.tsx
git commit -m "feat(review): add ReviewPage (empty state, preview, session, summary)"
```

---

### Task 7: `CourseListPage` due-review-count badge

**Files:**
- Modify: `src/features/course/CourseListPage.loader.ts`
- Modify: `src/features/course/CourseListPage.loader.test.ts`
- Modify: `src/features/course/CourseListPage.tsx`
- Modify: `src/features/course/CourseListPage.test.tsx`

**Interfaces:**
- Consumes: `getDueReviewItems` (Task 1, called with **no** `limit` argument — the unbounded true count).
- Produces: `CourseListLoaderData` gains `dueReviewCount: number`. Consumed by Task 8 (`router.ts`, which must now inject `reviewRepo` into this loader too) and this task's own `CourseListPage.tsx` render.

- [ ] **Step 1: Write the failing tests**

Replace `src/features/course/CourseListPage.loader.test.ts` in full:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createCourseListLoader } from './CourseListPage.loader'
import { FakeCourseRepository, FakeReviewRepository } from '../../test/fakes'
import type { Course } from '../../domain/models/course'
import type { ReviewItem } from '../../domain/models/review-item'

function makeCourse(id: string): Course {
  return {
    id,
    title: id,
    description: '',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeReviewItem(id: string): ReviewItem {
  return {
    id,
    sourceLessonId: 'l1',
    sourceExerciseId: 'e1',
    targetText: '가',
    reason: 'mistake',
    mistakeCount: 1,
    lastMistakeAt: new Date('2026-01-01'),
    resolved: false,
    box: 1,
    nextReviewAt: new Date('2020-01-01'), // well in the past — always due
  }
}

describe('createCourseListLoader', () => {
  it('signs in before reading courses, and returns them alongside the due review count', async () => {
    const ensureUser = vi.fn().mockResolvedValue({ uid: 'user1' })
    const reviewRepo = new FakeReviewRepository()
    await reviewRepo.addReviewItem('user1', makeReviewItem('r1'))
    const loader = createCourseListLoader({
      courseRepo: new FakeCourseRepository([makeCourse('c1')]),
      reviewRepo,
      ensureUser,
    })

    const data = await loader()

    expect(ensureUser).toHaveBeenCalledOnce()
    expect(data.courses.map((c) => c.id)).toEqual(['c1'])
    expect(data.dueReviewCount).toBe(1)
  })

  it('returns the true unbounded due count, not capped to a session-sized batch', async () => {
    const reviewRepo = new FakeReviewRepository()
    for (let i = 0; i < 25; i++) {
      await reviewRepo.addReviewItem('user1', makeReviewItem(`r${i}`))
    }
    const loader = createCourseListLoader({
      courseRepo: new FakeCourseRepository(),
      reviewRepo,
      ensureUser: vi.fn().mockResolvedValue({ uid: 'user1' }),
    })

    const data = await loader()

    expect(data.dueReviewCount).toBe(25)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/features/course/CourseListPage.loader.test.ts`
Expected: FAIL — `createCourseListLoader` doesn't accept `reviewRepo` yet, and returns no `dueReviewCount`.

- [ ] **Step 3: Implement the loader change**

Replace `src/features/course/CourseListPage.loader.ts` in full:

```ts
import { getCourses } from '../../application/get-course'
import { getDueReviewItems } from '../../application/get-review-items'
import type { CourseRepository } from '../../domain/repositories/course-repository'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import type { Course } from '../../domain/models/course'

export interface CourseListLoaderData {
  courses: Course[]
  dueReviewCount: number
}

export function createCourseListLoader(deps: {
  courseRepo: CourseRepository
  reviewRepo: ReviewRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<CourseListLoaderData> => {
    const user = await deps.ensureUser()
    const courses = await getCourses(deps.courseRepo)
    const dueReviewCount = (await getDueReviewItems(deps.reviewRepo, user.uid)).length
    return { courses, dueReviewCount }
  }
}
```

- [ ] **Step 4: Run the loader tests to verify they pass**

Run: `pnpm exec vitest run src/features/course/CourseListPage.loader.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing component tests**

Replace `src/features/course/CourseListPage.test.tsx` in full:

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
          loader: async () => ({ courses: [makeCourse('c1')], dueReviewCount: 0 }),
        },
      ],
      { initialEntries: ['/'] },
    )

    render(<RouterProvider router={router} />)

    const link = await screen.findByRole('link', { name: /Course c1/i })
    expect(link).toHaveAttribute('href', '/courses/c1')
    expect(screen.getByText('Description for c1')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no courses yet', async () => {
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

    expect(await screen.findByText('No courses yet.')).toBeInTheDocument()
  })

  it('shows a due-review link when items are due', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: CourseListPage,
          loader: async () => ({ courses: [], dueReviewCount: 3 }),
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    const link = await screen.findByRole('link', { name: /3 words due for review/i })
    expect(link).toHaveAttribute('href', '/review')
  })

  it('hides the due-review link when nothing is due', async () => {
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

    await screen.findByText('No courses yet.')
    expect(screen.queryByRole('link', { name: /words due for review/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `pnpm exec vitest run src/features/course/CourseListPage.test.tsx`
Expected: FAIL — the 2 new tests fail (`CourseListPage.tsx` doesn't render a due-review link yet); the 2 existing tests still pass unchanged.

- [ ] **Step 7: Implement the component change**

Replace `src/features/course/CourseListPage.tsx` in full:

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

- [ ] **Step 8: Run test to verify it passes**

Run: `pnpm exec vitest run src/features/course/CourseListPage.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Typecheck and lint**

Run: `pnpm exec tsc -b && pnpm lint`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/features/course/CourseListPage.loader.ts src/features/course/CourseListPage.loader.test.ts src/features/course/CourseListPage.tsx src/features/course/CourseListPage.test.tsx
git commit -m "feat(course): show a due-review-count link on the course list page"
```

---

### Task 8: Wire it all together — `router.ts`, manual verification

**Files:**
- Modify: `src/app/router.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: nothing — this is the integration point.

- [ ] **Step 1: Wire the new route and the updated `CourseListPage` loader deps**

Replace `src/app/router.ts` in full:

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
    path: '*',
    Component: NotFoundPage,
  },
])
```

- [ ] **Step 2: Run the full suite**

Run: `pnpm exec vitest run`
Expected: PASS, every test in the project (this task's + all prior tasks' + everything from earlier rounds).

- [ ] **Step 3: Typecheck, lint, build**

Run: `pnpm exec tsc -b && pnpm lint && pnpm build`
Expected: no errors; `dist/` builds successfully.

- [ ] **Step 4: Manual browser verification**

Run: `pnpm dev`, then in a browser (or via the `claude-in-chrome` tool):

1. Visit `/` — since no `ReviewItem`s exist yet for this test user, confirm **no** "N words due for review" link appears (the honest, currently-true state).
2. Visit `/review` directly — confirm the empty state ("Nothing due right now.") renders, no crash.
3. Go complete a lesson with at least one deliberate wrong keystroke (e.g. `greetings-1`, per the previous round's manual-verification steps) — this creates a real `ReviewItem` in Firestore via the already-shipped `create-review-items.ts` path.
4. Revisit `/` and `/review` — confirm they **still** correctly show no due items (a freshly-created `ReviewItem`'s `nextReviewAt` is 1 day out per the Leitner box-1 interval — it is genuinely not due yet). This is the correct, honest behavior, not a bug: it proves the due-filtering logic is reading real data faithfully, not just wired to something that happens to always show up.
5. **Optional, only if you want to see the full "Start Review → type → summary" happy path against live data today** (not something to do yourself as part of this task — mention it to the user and let them decide): the user could open the Firebase console, find that `ReviewItem` document under `users/{uid}/reviewItems/`, and manually edit `nextReviewAt` to a past date, then reload `/review`. Do not do this automatically — CLAUDE.md's Firebase Caution section requires confirming before writing migration/backfill scripts, and hand-editing a document field to fabricate test data crosses the same line. The Vitest suite already exercises this exact "Start Review → type it → submit → box updates" flow end-to-end against fakes (Tasks 2–6), so live-data coverage here is a nice-to-have, not required to ship.
6. Check the browser console for errors at every step above.

Fix any issues found before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/app/router.ts
git commit -m "feat(review): wire the /review route into the router"
```
