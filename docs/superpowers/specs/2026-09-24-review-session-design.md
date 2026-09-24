# Review System UI — Design Spec

## Goal

Build the last unbuilt piece of README's stated Learning Flow (Learn → Type → Review → Improve → Unlock): a real UI on top of the already-built, already-tested `application/get-review-items.ts` and `application/submit-review-result.ts` use cases. A learner can see which mistyped/slow/low-accuracy words are due for spaced-repetition review (Leitner boxes, [[DEC-008]]), practice them by typing — reusing the exact same Korean typing engine and virtual keyboard built for lessons, not a separate flashcard/multiple-choice mechanic — and have each item's box/`nextReviewAt` advance or reset based on whether it was typed with zero mistakes.

## Scope

**In scope:** a `/review` route, its loader/action, a `ReviewPage.tsx` (empty state → due-items preview → "Start Review" → session → short summary), a `ReviewTypingSession.tsx` sibling component to `LessonTypingSession.tsx`, one new application-layer use case (`submit-review-session.ts`), a `limit` parameter added to `get-review-items.ts`, and a link to `/review` from `CourseListPage`.

**Out of scope, deliberately:** any persistent nav bar (this app has none today; adding one is a separate, unrelated concern) — the entry point is a single link on `CourseListPage`. Anki-style same-session requeue of wrong answers (single pass only; a wrong item just comes back due later per its reset box). A shared hook extracting common logic between `LessonTypingSession.tsx` and `ReviewTypingSession.tsx` (kept as two separate components — the duplication is small: a keydown listener and a render loop; forcing a shared abstraction for exactly two callers with different completion payloads isn't worth it yet). Any change to Firestore rules (the existing `users/{userId}/**` rules already cover `reviewItems` correctly, per [[DEC-015]]).

## Architecture

```
CourseListPage ("N words due for review" link, only shown when N > 0)
   ↓
GET /review route loader → getDueReviewItems(reviewRepo, uid, now, limit=20)
   ↓
ReviewPage.tsx
   ├── 0 due items → empty state ("Nothing due right now.")
   ├── N due items, not started → preview list + "Start Review" button
   ├── started → <ReviewTypingSession items={dueItems} onComplete={setSummary} />
   └── summary set → "Review complete! N correct, M need more practice" + link back to Course List
   ↓ (on Start Review)
ReviewTypingSession.tsx
   ├── useLessonSessionStore (reused as-is — the store's generation counter, added for the
   │    lesson-typing-session cross-mount fix, already makes it safe for a second, unrelated
   │    consumer to mount/unmount against the same module-level singleton)
   ├── lesson-session.ts (reused as-is — startLessonSession/pressKey only need
   │    Array<{ id, targetText }>, which ReviewItem maps to directly: { id: item.id,
   │    targetText: item.targetText })
   └── VirtualKeyboard.tsx (reused as-is)
   ↓ (on lesson-session status === 'completed')
POST /review action, body: { results: [{ itemId, wasCorrect }] }  (Zod-validated)
   ↓
application/submit-review-session.ts (new)
   for each { itemId, wasCorrect }:
     item = await reviewRepo.getReviewItem(userId, itemId)   ← userId always from ensureUser(),
                                                                 never client-supplied; an
                                                                 unknown/foreign itemId under
                                                                 this uid resolves to null and
                                                                 is skipped, never thrown
     if item: await submitReviewResult(reviewRepo, userId, item, wasCorrect, now)
   returns SubmitReviewSessionOutcome { correctCount, needsPracticeCount }
```

## Key decisions

1. **Session composition:** all due items in one session (not an artificial multi-page flow), but `getDueReviewItems` gains a `limit` parameter so a learner who has fallen behind never faces an unbounded review queue in one sitting — items beyond the cap simply stay due and appear in a later session. **`limit` defaults to `Infinity` (unbounded), not 20** — `CourseListPage`'s "N words due" link needs the *true* total due count (calling with no `limit` argument), while the `/review` route's own loader is the one that explicitly passes `limit: 20` to cap the actual session. Defaulting to 20 instead would silently under-report the badge count once a learner has more than 20 items due. Ordering is whatever `getReviewItems` already returns (insertion order in the fake/Firestore doc order) — no explicit sort requirement surfaced.

2. **`wasCorrect` semantics — stated explicitly because it's easy to misread:** the typing engine blocks wrong keys (a learner cannot *finish* an item with an incorrect keystroke sequence baked into the composed text — [[DEC-017]]'s jamo-level blocking). "Correct" for review purposes is **stricter** than "eventually finished": `wasCorrect = completedResult.mistakes.length === 0`. A single rejected keystroke anywhere while typing an item — even if the learner immediately corrects it and finishes the item — makes that whole item `wasCorrect: false`, resetting its box to 1. This is the same rule already used for the reverse case (creating a `ReviewItem` from a lesson mistake, [[DEC-018]]) — any mistake at all is a mistake, full stop.

3. **No same-session requeue on a wrong item.** A single linear pass through the session's items (exactly like `lesson-session.ts` already sequences a lesson's exercises — no new domain logic). An item typed with a mistake still has its box reset to 1 and a new (soon) `nextReviewAt` computed by `submitReviewResult`; it does not reappear later in *this* session, only in a future one.

4. **Ownership is structural, not an extra check.** The route action's payload is exactly `{ results: [{ itemId: string, wasCorrect: boolean }] }` — never a full `ReviewItem`, and never a `userId` (the client can't influence which user's data is touched). `submitReviewSession` looks up every item via `reviewRepo.getReviewItem(userId, itemId)`, where `userId` is always the value `ensureUser()` returns for the authenticated request, matching the Firestore path (`users/{userId}/reviewItems/{itemId}`) that already scopes every read/write to that same uid. An `itemId` that doesn't exist under this uid (whether it's a typo, stale client state, or a deliberately forged id from another user's item) resolves to `null` from `getReviewItem` and is silently skipped — never thrown, and never able to touch another user's document, because the lookup path itself is uid-scoped before the id is ever consulted.

5. **Summary is item-level counts, not an aggregate accuracy/WPM figure** (unlike the lesson-completion inline block, which does show accuracy/EXP): "N correct, M need more practice" — `correctCount`/`needsPracticeCount` from `submitReviewSession`'s return value, one line, no separate per-item breakdown screen.

6. **`ReviewTypingSession.tsx` is a new component, not a variant of `LessonTypingSession.tsx` and not a shared hook.** Both mount the same `useLessonSessionStore`/`lesson-session.ts`/`VirtualKeyboard.tsx`, but diverge completely on completion: `LessonTypingSession` posts a `LessonResult` (accuracy/speedWpm/durationSeconds/mistakes) to a route action that calls `complete-lesson-session` (Progress/EXP/unlock/create-review-items); `ReviewTypingSession` posts per-item `{ itemId, wasCorrect }` pairs to a different route action that calls `submit-review-session` (box/nextReviewAt/resolved only — no Progress, no EXP, no `create-review-items` cascade, since a review item going wrong again is already fully handled by `submitReviewResult`'s own box-reset).

## Data flow: computing `wasCorrect` per item

`ReviewTypingSession` waits for the shared `lesson-session.ts` state's `status === 'completed'` (exactly the same signal `LessonTypingSession` waits for), then — instead of calling `getLessonResult` — reads `state.completedResults` directly:

```ts
interface ExerciseResult {
  exerciseId: string       // === the ReviewItem's own id, since it was seeded from item.id
  targetText: string
  correctKeyCount: number
  mistakes: MistakeEvent[] // already tracked per item by typing-session.ts, unchanged
}
```

and maps it to the action payload:

```ts
const results = state.completedResults.map((r) => ({
  itemId: r.exerciseId,
  wasCorrect: r.mistakes.length === 0,
}))
```

No new domain logic — this is a pure reshaping of data `lesson-session.ts` already produces.

## New files

- `src/application/submit-review-session.ts` (+ test) — `submitReviewSession(reviewRepo, userId, results, now?)`, returns `{ correctCount: number; needsPracticeCount: number }`.
- `src/features/review/ReviewPage.tsx` (+ test) — the 4-state page (empty / preview+start / in-session / summary).
- `src/features/review/ReviewPage.loader.ts` (+ test) — `createReviewLoader({ reviewRepo, ensureUser })`, calls `getDueReviewItems(reviewRepo, uid, new Date(), 20)` (the session-cap `limit`, not the badge's unbounded count).
- `src/features/review/ReviewPage.action.ts` (+ test) — `createSubmitReviewSessionAction({ reviewRepo, ensureUser })`, Zod-validates the body, calls `submitReviewSession`.
- `src/features/review/ReviewTypingSession.tsx` (+ test) — mirrors `LessonTypingSession.tsx`'s structure (mount → keydown effect → completion effect → submit via `useFetcher`), but for `ReviewItem[]` and the review-specific payload/outcome shape above.

## Modified files

- `src/application/get-review-items.ts` — `getDueReviewItems` gains a `limit: number = Infinity` parameter; slices the filtered, due, unresolved items to at most `limit`.
- `src/features/course/CourseListPage.tsx` + `.loader.ts` — loader also calls `getDueReviewItems(reviewRepo, uid)` (no `limit` — the true unbounded due count) to conditionally render a "N words due for review" link to `/review`; hidden entirely when N is 0.
- `src/app/router.ts` — new `/review` route (loader + action), matching the existing route-construction pattern (injected `ensureUser`, singleton repos from `infrastructure/firebase/repositories`).

## Testing

- `submit-review-session.ts`: correct-item advances box and doesn't touch `mistakeCount`/`lastMistakeAt`; incorrect-item resets box to 1 and increments `mistakeCount`; an unknown `itemId` under this uid is skipped without throwing (pins decision 4); a fully-mastered item (`box` reaches `MAX_BOX` and `wasCorrect`) is marked `resolved`; `correctCount`/`needsPracticeCount` add up correctly across a mixed batch.
- `get-review-items.ts`: existing due/unresolved filter behavior unchanged; new test that calling with no `limit` argument returns every due item uncapped (the `CourseListPage` badge path); new test that an explicit `limit` caps the returned array while leaving the rest untouched in the repository (the `/review` session path).
- `ReviewPage.loader.ts`/`ReviewPage.action.ts`: same shape of tests as `LessonDetailPage.loader.ts`/`.action.ts` — `ensureUser` called first, malformed body rejected by Zod, missing/foreign item ids don't crash the whole action.
- `ReviewTypingSession.tsx`: rendered through `<StrictMode>` (same reasoning as `LessonTypingSession.test.tsx` — the store is shared, so the same class of cross-mount staleness bug is possible here too and must be pinned the same way); a mixed correct/incorrect batch produces the right per-item `wasCorrect` payload; zero-items edge case (defensive — `ReviewPage` shouldn't reach this, but the component itself must not crash).
- `CourseListPage`: link appears only when due items exist; link's href is `/review`.

## Review Focus (carried into the implementation plan)

1. **`wasCorrect` computed from `mistakes.length === 0`, not from whether the item was eventually finished** — a learner who fixes a mistake mid-item and finishes cleanly must still see that item's box reset to 1.
2. **The `limit` cap on `getDueReviewItems` must not lose items, and must default to unbounded** — items beyond an explicit `limit` stay `resolved: false` with their existing `nextReviewAt`, appearing in a future session, never silently dropped; and `CourseListPage`'s due-count badge (which calls with no `limit`) must never under-report because it accidentally inherited a capped default meant for the session view.
3. **An `itemId` the client sends that doesn't resolve to a `ReviewItem` under the authenticated uid must be skipped silently, not thrown** — covers both a stale/removed item and a client attempting to reference another user's item id (which structurally cannot resolve, since the lookup path is uid-scoped).
4. **`ReviewTypingSession` must be immune to the same cross-mount stale-session bug fixed in `LessonTypingSession`** (the `generation`-counter mechanism in `lesson-session-store.ts` already covers this for any consumer, but the component must actually use it the same way, and its test must render through `StrictMode` to prove it).
5. **The empty-state and the summary screen must both correctly show zero (not crash, not show a stale prior summary)** — a learner with nothing due, and a learner who reviews the same single item twice in two different sessions, are both realistic first-time states.
