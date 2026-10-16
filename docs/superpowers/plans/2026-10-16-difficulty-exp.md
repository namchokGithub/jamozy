# Difficulty-based EXP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace accuracy-based and flat EXP with per-exercise difficulty-based EXP for Learning Path, Home, Review, and Weak Jamo practice ([[DEC-045]], [[DEC-046]]).

**Architecture:** One pure domain module computes each exercise's reward and a session total. Each submit use case collects `{ difficulty, kind, perfect }` per eligible exercise and passes the total as `LearningSession.expGained`; the existing receipt-gated submit already applies `expGained` to `ProgressionState` exactly once, so no repository, Rules, or schema change is needed.

**Tech Stack:** TypeScript, Zod, Vitest, React Router actions.

**Spec:** `docs/DECISIONS.md` → DEC-045, DEC-046; `docs/LEVELING.md` → EXP Calculation. User decisions on 2026-10-16 (below).

## Global Constraints

- Rewards (DEC-045/046): first completion Easy 15 / Medium 25 / Hard 30; replay, Review, and Practice Easy 3 / Medium 5 / Hard 10.
- Perfect bonus: +5 flat, first completion only; "perfect" means the exercise's `mistakeCount === 0`.
- Formula per exercise: `round((base + flatBonus) × (1 + percentBonus))`; session EXP is the sum of the rounded exercise rewards. No Perk/Achievement bonuses exist yet: `percentBonus = 0`, `flatBonus` = perfect bonus only.
- A missing difficulty (old outbox job, unknown exercise ID, missing source lesson/exercise) counts as `easy`.
- Review and Weak Jamo: only items with `wasCorrect === true` earn EXP.
- The receipt stores only the total `expGained`; per-exercise reward inputs are **not** persisted (DEC-046 amendment in Task 7).
- No Firestore Rules, IndexedDB schema version, or `LearningSession` field changes. Historical `expGained` stays as recorded.
- Never `git commit` without the user's request; never add `Co-Authored-By: Claude`. "Commit" steps below mean: suggest the message to the user.
- Files not Prettier-clean at `HEAD` (check `git show HEAD:<f> | npx prettier --check --stdin-filepath <f>`) are edited by hand without reformatting.

## Review Focus

- A retried submission (same `submissionId`/`sessionId`) after this change returns the receipt's original EXP and awards nothing new — existing receipt tests cover it; no new test.
- An outbox job enqueued before this change (no `difficulty` on exercise-job lessons, no `difficulties` on replay jobs) still runs and awards Easy rates — tests in Tasks 3 and 4.
- A Home `homePartialResult` whose `exercises` length differs from `completedExerciseIds` (partials saved before `exercises` existed) awards base EXP with no perfect bonus — test in Task 3.
- A Review item whose source lesson or exercise no longer exists earns Easy EXP when correct — test in Task 5.
- A Learning Path result whose `exerciseId` is missing or not in the lesson (content edited mid-session) earns Easy for that exercise — test in Task 2.

---

### Task 1: Domain reward calculation

**Files:**

- Create: `src/domain/models/exp-reward.ts`
- Test: `src/domain/models/exp-reward.test.ts`

**Interfaces:**

- Consumes: `ExerciseDifficulty` from `src/domain/models/lesson.ts`.
- Produces:
  - `export type ExpRewardKind = 'first-completion' | 'practice'` (`practice` covers replay, Review, and Practice rows).
  - `export interface ExpRewardItem { difficulty?: ExerciseDifficulty; kind: ExpRewardKind; perfect?: boolean }`
  - `export function exerciseRewardExp(item: ExpRewardItem, bonus?: { flat?: number; percent?: number }): number`
  - `export function sessionRewardExp(items: ExpRewardItem[]): number`

- [ ] **Step 1: Write the failing tests** in `exp-reward.test.ts`:
  - `first completion rewards by difficulty`: easy 15, medium 25, hard 30.
  - `practice rewards by difficulty`: easy 3, medium 5, hard 10.
  - `missing difficulty counts as easy`: `{ kind: 'first-completion' }` → 15; `{ kind: 'practice' }` → 3.
  - `perfect adds 5 only on first completion`: hard first-completion perfect → 35; hard practice perfect → 10.
  - `applies flat before percent and rounds once`: `exerciseRewardExp({ difficulty: 'hard', kind: 'first-completion' }, { flat: 13, percent: 0.2 })` → 52 (LEVELING.md example).
  - `sums rounded rewards`: `[easy first perfect, medium first, hard practice]` → 20 + 25 + 10 = 55; `[]` → 0.
- [ ] **Step 2: Run** `npx vitest run src/domain/models/exp-reward.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement** `exp-reward.ts` with `FIRST_COMPLETION_EXP`, `PRACTICE_EXP` (records keyed by difficulty) and `PERFECT_FLAT_BONUS = 5`; perfect bonus is added to `flat` inside `exerciseRewardExp`.
- [ ] **Step 4: Run** the test file — expect PASS.
- [ ] **Step 5: Suggest commit** `feat(progression): add difficulty-based EXP reward calculation`

### Task 2: Learning Path lesson EXP

**Files:**

- Modify: `src/domain/korean/lesson-session.ts` (`LessonResult.exercises`, `getLessonResult`, `lessonResultSchema`)
- Modify: `src/application/complete-lesson-session.ts:~134` (EXP calculation)
- Test: `src/application/complete-lesson-session.test.ts`, `src/domain/korean/lesson-session.test.ts`

**Interfaces:**

- Consumes: `sessionRewardExp`, `ExpRewardItem` (Task 1).
- Produces: `LessonResult.exercises` entries gain optional `exerciseId?: string` (type `ExerciseStat & { exerciseId?: string }`); `lessonResultSchema` accepts it as optional. Transient action payload only — not persisted.

- [ ] **Step 1: Write failing tests**
  - `lesson-session.test.ts` › `getLessonResult includes each exercise id`: result `exercises[i].exerciseId` equals the played exercise IDs in order.
  - `complete-lesson-session.test.ts` › `first completion awards difficulty EXP with perfect bonus`: lesson exercises `e1 easy`, `e2 hard`; result exercises `e1` 0 mistakes, `e2` 1 mistake → `expGained` 20 + 30 = 50.
  - › `replay awards practice EXP per exercise`: same lesson already `completed` → 3 + 10 = 13 (no perfect bonus).
  - › `unknown or missing exercise id counts as easy`: result entries with `exerciseId: 'gone'` and no `exerciseId`, both 1 mistake → 15 + 15 = 30.
  - Update existing assertions that expect `expForAccuracy` values (100/120/170) or replay `15` to the new amounts.
- [ ] **Step 2: Run** `npx vitest run src/application/complete-lesson-session.test.ts src/domain/korean/lesson-session.test.ts` — expect FAIL.
- [ ] **Step 3: Implement**: `getLessonResult` adds `exerciseId: result.exerciseId`; `completeLessonSession` maps `lesson.exercises` to a `Map<id, difficulty>` and builds one `ExpRewardItem` per `result.exercises` entry (`kind` = `'practice'` when `wasAlreadyCompleted`, else `'first-completion'`; `perfect = mistakeCount === 0`). A result without `exercises` awards 0. Keep `expForAccuracy` exported until Task 3 removes its last caller.
- [ ] **Step 4: Run** the same tests plus `src/features/lesson/LessonDetailPage.test.tsx src/features/lesson/LessonTypingSession.test.tsx` — expect PASS.
- [ ] **Step 5: Suggest commit** `feat(lesson): award difficulty-based EXP for lesson completions and replays`

### Task 3: Home first-completion EXP

**Files:**

- Modify: `src/application/record-home-exercise.ts` (input type, EXP at completion)
- Modify: `src/domain/models/home-sync-job.ts` (exercise job `lesson.exercises` type)
- Modify: `src/application/home-outbox.ts` (`enqueueExercise` input type)
- Modify: `src/app/home-services.ts:~27` (map `{ id, difficulty }`)
- Modify: `src/application/complete-lesson-session.ts` (delete `expForAccuracy`)
- Test: `src/application/record-home-exercise.test.ts`

**Interfaces:**

- Consumes: Task 1.
- Produces: lesson exercise shape `Array<{ id: string; difficulty?: ExerciseDifficulty }>` in `RecordHomeExerciseInput.lesson`, the exercise `HomeSyncJob`, and `HomeOutbox.enqueueExercise`. `difficulty` stays optional so jobs already in IndexedDB still type-check and run.

- [ ] **Step 1: Write failing tests** in `record-home-exercise.test.ts`:
  - `completion awards difficulty EXP with perfect bonus`: lesson `a medium`, `b hard`; record `a` with 0 mistakes, then `b` with 2 mistakes → `completed.expGained` 30 + 30 = 60.
  - `exercises without difficulty count as easy`: lesson exercises with only `id`, both perfect → 20 + 20 = 40.
  - `partial without per-exercise stats gets no perfect bonus`: seed Progress with `completedExerciseIds: ['a']` and a `homePartialResult` lacking `exercises`; record `b` perfect, both `easy` → 15 + 15 = 30.
  - Update existing EXP assertions that expect `expForAccuracy` values.
- [ ] **Step 2: Run** `npx vitest run src/application/record-home-exercise.test.ts` — expect FAIL.
- [ ] **Step 3: Implement**: at completion, build items by zipping `ids` with `partial.exercises` by index when their lengths are equal (`perfect = mistakeCount === 0`); otherwise items from `ids` with `perfect: false`. Difficulty comes from `lesson.exercises`. Pass `sessionRewardExp(items)` as `expGained`. Delete `expForAccuracy` and update the comment above `recordHomeExercise`.
- [ ] **Step 4: Run** `npx vitest run src/application/record-home-exercise.test.ts src/application/home-outbox.test.ts src/application/complete-lesson-session.test.ts` and `npx tsc -b` — expect PASS.
- [ ] **Step 5: Suggest commit** `feat(home): award difficulty-based EXP on first Home lesson completion`

### Task 4: Home replay EXP

**Files:**

- Modify: `src/application/submit-home-replay.ts` (remove `HOME_REPLAY_EXP`, add `difficulties`)
- Modify: `src/domain/models/home-sync-job.ts` (replay job `difficulties?: ExerciseDifficulty[]`)
- Modify: `src/application/home-outbox.ts` (`enqueueReplay` input, `run`)
- Modify: `src/features/home/home-services.ts:15`, `src/app/home-services.ts:~36`
- Modify: `src/features/home/HomePlayer.tsx:~256` (pass `played.exercises.map(({ difficulty }) => difficulty)`)
- Test: `src/application/record-home-exercise.test.ts` (existing `submitHomeReplay` cases live here), `src/application/home-outbox.test.ts`

**Interfaces:**

- Consumes: Task 1.
- Produces: `SubmitHomeReplayInput.difficulties?: ExerciseDifficulty[]`; `HomeServices.recordReplay` input gains `difficulties: ExerciseDifficulty[]`; `HomeOutbox.enqueueReplay` input gains `difficulties?: ExerciseDifficulty[]`.

- [ ] **Step 1: Write failing tests**
  - `record-home-exercise.test.ts` › `replay awards practice EXP per exercise`: `difficulties: ['easy', 'medium', 'hard']` → 18.
  - › `replay without difficulties counts each attempted exercise as easy`: no `difficulties`, `totals.exercisesAttempted: 4` → 12.
  - `home-outbox.test.ts` › `replay job carries difficulties to the submit`: enqueue with `difficulties: ['hard']` → submitted session `expGained` 10.
  - Replace assertions on `HOME_REPLAY_EXP`/`15`.
- [ ] **Step 2: Run** `npx vitest run src/application/record-home-exercise.test.ts src/application/home-outbox.test.ts` — expect FAIL.
- [ ] **Step 3: Implement**: `submitHomeReplay` uses `difficulties ?? Array(totals.exercisesAttempted).fill(undefined)` mapped to `{ kind: 'practice' }` items; the outbox stores and forwards `difficulties`; update the comment that mentions "flat 15 EXP (DEC-033)".
- [ ] **Step 4: Run** the tests above plus `src/features/home` tests and `npx tsc -b` — expect PASS. Run ESLint and Prettier on touched files.
- [ ] **Step 5: Suggest commit** `feat(home): award difficulty-based EXP for Home replays`

### Task 5: Review EXP

**Files:**

- Modify: `src/application/submit-review-session.ts` (deps gain `lessonRepo: LessonRepository`)
- Modify: `src/features/review/ReviewPage.action.ts` (deps type)
- Modify: `src/app/router.ts:~323` (pass `lessonRepo`)
- Test: `src/application/submit-review-session.test.ts`

**Interfaces:**

- Consumes: Task 1; `LessonRepository.getLessonById`.
- Produces: `submitReviewSession` deps `{ reviewRepo; lessonRepo; sessionSubmissionRepo; userProfileRepo? }`.

- [ ] **Step 1: Write failing tests**:
  - `correct items earn practice EXP by source difficulty`: items from lesson `L` exercises `x hard`, `y medium`; results `x` correct, `y` wrong → session `expGained` 10.
  - `missing source lesson or exercise counts as easy`: correct item whose `sourceLessonId` returns `null` → 3.
  - `reads each source lesson once`: two items from the same lesson → `getLessonById` called once.
- [ ] **Step 2: Run** `npx vitest run src/application/submit-review-session.test.ts` — expect FAIL.
- [ ] **Step 3: Implement**: after loading items, batch-read unique `sourceLessonId`s (same pattern as `get-review-previews.ts`), look up `sourceExerciseId` difficulty, build `{ kind: 'practice' }` items for correct results only, pass the sum as `expGained`.
- [ ] **Step 4: Run** the test plus `src/features/review` tests and `npx tsc -b` — expect PASS.
- [ ] **Step 5: Suggest commit** `feat(review): award difficulty-based EXP for correct review items`

### Task 6: Weak Jamo practice EXP

**Files:**

- Modify: `src/domain/practice/weak-jamo.ts` (`PracticeExercise.difficulty: ExerciseDifficulty`)
- Modify: `src/application/get-weak-jamo-practice.ts` (copy difficulty from Home content)
- Modify: `src/features/review/WeakJamoPage.tsx:~41-62` (send `difficulty`)
- Modify: `src/features/review/WeakJamoPage.action.ts` (schema: `difficulty: z.enum(['easy','medium','hard']).optional()`)
- Modify: `src/application/submit-weak-jamo-session.ts` (`WeakJamoResult.difficulty?`, EXP, comment)
- Test: `src/application/submit-weak-jamo-session.test.ts`, `src/application/get-weak-jamo-practice.test.ts`

**Interfaces:**

- Consumes: Task 1.
- Produces: `WeakJamoResult.difficulty?: ExerciseDifficulty`; `PracticeExercise.difficulty`.

- [ ] **Step 1: Write failing tests**:
  - `submit-weak-jamo-session.test.ts` › `correct exercises earn practice EXP`: `hard` correct, `medium` wrong, no-difficulty correct → 10 + 3 = 13.
  - `get-weak-jamo-practice.test.ts` › `practice exercises keep their difficulty`.
- [ ] **Step 2: Run** both test files — expect FAIL.
- [ ] **Step 3: Implement** as listed in Files; keep `PracticeExercise` fixtures in other tests compiling (add `difficulty`).
- [ ] **Step 4: Run** both test files, `src/features/review` tests, `src/domain/practice` tests, and `npx tsc -b` — expect PASS.
- [ ] **Step 5: Suggest commit** `feat(practice): award difficulty-based EXP for weak jamo practice`

### Task 7: Documentation

**Files:**

- Modify: `docs/DECISIONS.md` (amendments under DEC-045 and DEC-046; index unchanged)
- Modify: `README.md` (Home section EXP paragraph)
- Modify: `docs/PROGRESS.md` (EXP and Level progression → Done; remove index row; Lesson flow note)
- Modify: `docs/LEARNING-MODES.md`, `docs/SESSION-AND-HISTORY.md`, `docs/LEVELING.md` only where they state current EXP behavior (`grep -n "EXP" …`)
- Modify: `docs/log/2026-10.md` (append entry)

- [ ] **Step 1:** DEC-045 amendment (2026-10-16): Review/Practice reward only `wasCorrect` items; perfect = zero mistakes in that exercise; missing difficulty → Easy; Daily Quest rewards and Perk/Achievement bonuses remain unimplemented (bonuses contribute 0).
- [ ] **Step 2:** DEC-046 amendment (2026-10-16): the receipt stores only the total `expGained`; the receipt keyed by session ID already prevents duplicate or recalculated rewards; replay jobs queued before the change award Easy per attempted exercise.
- [ ] **Step 3:** README Home paragraph: first completion per exercise Easy 15 / Medium 25 / Hard 30 (+5 perfect); replay Easy 3 / Medium 5 / Hard 10; link LEVELING.md, DEC-045, DEC-046.
- [ ] **Step 4:** PROGRESS + other topic docs + log entry (3–5 bullets, link this plan).
- [ ] **Step 5:** Prettier check on Prettier-clean docs; remind the user to run `pnpm test`. Suggest commit `docs(progression): record difficulty-based EXP rollout`.
