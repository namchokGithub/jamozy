# One-page Learning Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Home the resumable, one-page Learning Path player while retaining the existing Hero, Course Map, and direct Lesson flow.

**Architecture:** A new application query builds an ordered, at-most-ten-exercise queue from one selected incomplete course. A local-only IndexedDB checkpoint records completed exercise boundaries and per-lesson partial aggregates; a lesson submits through the existing receipt boundary only after its final exercise. Progress writes and reads are brought to the target missing/unlocked/completed model, with a shared global curriculum-order helper.

**Tech Stack:** React 19, TypeScript, React Router 8 loaders/actions, Zustand, IndexedDB, Firebase/Firestore repositories, Vitest, React Testing Library, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-09-29-one-page-learning-path-design.md`

## Global Constraints

- Keep persistence access out of React components; loaders/actions call application use cases and repository interfaces only.
- The one-page checkpoint is IndexedDB-only for both guest and authenticated users; do not add Firebase storage or guest-to-account migration support.
- Checkpoint only at completed-exercise boundaries; never persist individual keystrokes or abandoned history sessions.
- A queue draws at most ten exercises from its selected course and never fills from another course.
- Persist only `Progress.status: 'unlocked' | 'completed'`; treat legacy `locked` records as absent without deleting user data.
- Preserve existing Hero below the player, Course Map links, direct Lesson flow, and virtual keyboard styling.
- Do not add automated tests for presentation-only layout or finger-guide visuals; add tests for domain, application, and persistence behavior.
- Do not run `git commit` unless the user explicitly requests it.

## Review Focus

1. **All-completed course:** exclude it from the three selectable courses and render no queue for it — Task 3 query test.
2. **Course boundary with fewer than ten items:** stop at the selected course’s final exercise rather than borrowing another course’s content — Task 3 queue test.
3. **Reload during a partially completed lesson:** resume the first not-yet-completed exercise and retain its raw aggregate plus original submission ID — Task 2 persistence test and Task 3 reconciliation test.
4. **Legacy `locked` data:** no reader exposes it as a valid `Progress`, and no writer creates it — Task 1 adapter/use-case tests.
5. **Duplicate/retried last-exercise submission:** reuse the checkpointed submission ID so the receipt returns the original outcome without duplicate EXP/progress/review effects — Task 4 player-action integration test.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/application/learning-path-order.ts` | Flatten published Course → Unit → Lesson content in canonical global order and locate the contiguous completion frontier. |
| `src/application/get-one-page-learning-path.ts` | Select three incomplete courses, reconcile a local checkpoint, and construct the selected course’s player view model and ten-item queue. |
| `src/application/save-one-page-checkpoint.ts` | Merge one completed exercise result into local checkpoint state and produce a lesson result once its final exercise completes. |
| `src/domain/models/one-page-learning-checkpoint.ts` | Types for local resume state and per-lesson raw aggregates. |
| `src/domain/repositories/one-page-learning-checkpoint-repository.ts` | Local checkpoint persistence contract. |
| `src/infrastructure/local/local-one-page-learning-checkpoint-repository.ts` | IndexedDB implementation of the new checkpoint contract. |
| `src/infrastructure/local/guest-database.ts` | Versioned object-store creation for local checkpoints. |
| `src/features/course/CourseListPage.loader.ts` | Home loader composition for existing summary plus one-page player data. |
| `src/features/course/CourseListPage.action.ts` | Home action dispatches checkpoint and lesson-completion intents through application use cases. |
| `src/features/home/OnePageLearningPlayer.tsx` | Route-owned interactive player; invokes Home action and contains no repository access. |
| `src/features/home/FingerPlacementGuide.tsx` | Presentational left/right hand mapping displayed beside the unchanged keyboard. |
| `src/features/typing/lesson-session-store.ts` | Emits each completed exercise result without changing the existing direct-lesson semantics. |
| `src/domain/models/progress.ts`, adapters, and completion use cases | Target progress-state type, legacy compatibility, and global contiguous-frontier advancement. |

### Task 1: Target Learning Path Progress Foundation

**Files:**
- Create: `src/application/learning-path-order.ts`
- Create: `src/application/learning-path-order.test.ts`
- Modify: `src/domain/models/progress.ts`
- Modify: `src/infrastructure/firebase/mappers/progress-mapper.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-progress-repository.ts`
- Modify: `src/infrastructure/local/local-repositories.ts`
- Modify: `src/application/complete-lesson-session.ts`
- Modify: `src/application/complete-lesson.ts`
- Modify: `src/application/*.test.ts` tests whose fixtures still construct `status: 'locked'`

**Interfaces:**
- Consumes: `CourseRepository`, `LessonRepository`, `ProgressRepository`.
- Produces: `getOrderedLearningPath(courseRepo, lessonRepo): Promise<OrderedLearningPathLesson[]>` and `findContiguousFrontier(ordered, progress): OrderedLearningPathLesson | null` for Tasks 3 and 4.
- Produces: `LessonProgressStatus = 'unlocked' | 'completed'`; all callers receive `null` for legacy locked progress.

- [ ] **Step 1: Write failing tests for global curriculum order and the contiguous frontier**

In `src/application/learning-path-order.test.ts`, construct two courses, multiple units, and lessons with deliberately non-ID ordering. Assert the flattening order follows `(Course.order, Unit.order, Lesson.order)` and that the frontier skips future completed lessons but stops at the first missing/unlocked lesson.

- [ ] **Step 2: Write failing regression tests for legacy locked progress compatibility**

Extend Firebase/local repository tests (or add focused tests) to assert a persisted `status: 'locked'` value is read as absent and excluded from `getAllProgress`; assert serializing a valid target Progress cannot emit `locked`.

- [ ] **Step 3: Run the focused tests to verify they fail**

Run: `pnpm test --run src/application/learning-path-order.test.ts src/infrastructure/firebase/repositories/firebase-progress-repository.test.ts`

Expected: FAIL because the shared order helper and target-only status behavior do not exist.

- [ ] **Step 4: Implement the target status and global order helpers**

In `src/domain/models/progress.ts`, narrow the union to `'unlocked' | 'completed'`. Implement `getOrderedLearningPath` by loading courses, then each course’s units, then each unit’s lessons, relying on repository order but sorting defensively by documented order fields. Implement `findContiguousFrontier` from a `Map<lessonId, Progress>`.

- [ ] **Step 5: Update progress adapters and completion use cases**

Make local/Firebase progress reads filter legacy `locked` records without deleting them. Replace same-unit-only next-lesson calculations with `getOrderedLearningPath`; on first completion ensure only the frontier is written as `unlocked`. Preserve direct lesson retry/receipt behavior and update all affected test fixtures to target status values.

- [ ] **Step 6: Run target-progress verification**

Run: `pnpm test --run src/application/learning-path-order.test.ts src/application/complete-lesson.test.ts src/application/complete-lesson-session.test.ts src/application/get-course.test.ts`

Expected: PASS.

### Task 2: Local-only Checkpoint Contract and IndexedDB Adapter

**Files:**
- Create: `src/domain/models/one-page-learning-checkpoint.ts`
- Create: `src/domain/repositories/one-page-learning-checkpoint-repository.ts`
- Create: `src/infrastructure/local/local-one-page-learning-checkpoint-repository.ts`
- Create: `src/infrastructure/local/local-one-page-learning-checkpoint-repository.test.ts`
- Modify: `src/infrastructure/local/guest-database.ts`
- Modify: `src/app/router.ts`

**Interfaces:**
- Consumes: `GuestDatabase`.
- Produces: `OnePageLearningCheckpointRepository` with `getCheckpoint(userId: string, courseId: string): Promise<OnePageLearningCheckpoint | null>`, `saveCheckpoint(checkpoint: OnePageLearningCheckpoint): Promise<void>`, and `clearLesson(userId: string, courseId: string, lessonId: string): Promise<void>`.
- Produces: a single local repository instance passed explicitly to Home loader/action dependencies, never to `createLearnerRepositories` or migration dependencies.

- [ ] **Step 1: Write failing adapter tests**

Test put/get by `userId + courseId`, isolation between two users, `clearLesson` removing only one lesson’s exercise IDs/partial aggregate, and a saved authenticated user ID being readable from the same browser-local store.

- [ ] **Step 2: Run the adapter test to verify it fails**

Run: `pnpm test --run src/infrastructure/local/local-one-page-learning-checkpoint-repository.test.ts`

Expected: FAIL because no checkpoint model, repository, or object store exists.

- [ ] **Step 3: Define the checkpoint model and repository interface**

Use the spec fields exactly. `PartialLessonResult` must include `submissionId`, `startedAtMs`, accepted/rejected counters, completed exercise IDs, and mistake reports. Do not include active keystrokes or a Firebase-oriented identifier.

- [ ] **Step 4: Implement the IndexedDB adapter and versioned store**

Increment `GuestDatabase.VERSION`, add a `onePageLearningCheckpoints` store, and implement keying as `${userId}:${courseId}`. `clearLesson` reads, removes the specified lesson’s entries, and deletes the whole checkpoint only if it has no remaining lesson data.

- [ ] **Step 5: Wire a standalone local repository instance in the router**

Instantiate the local-only adapter next to `guestDatabase` consumers; do not add it to Firebase repositories, active learner repository selection, or guest migration snapshot.

- [ ] **Step 6: Run checkpoint verification**

Run: `pnpm test --run src/infrastructure/local/local-one-page-learning-checkpoint-repository.test.ts`

Expected: PASS.

### Task 3: One-page Queue Query and Checkpoint Reconciliation

**Files:**
- Create: `src/application/get-one-page-learning-path.ts`
- Create: `src/application/get-one-page-learning-path.test.ts`
- Create: `src/application/save-one-page-checkpoint.ts`
- Create: `src/application/save-one-page-checkpoint.test.ts`
- Modify: `src/test/fakes.ts`

**Interfaces:**
- Consumes: `getOrderedLearningPath`, `CourseRepository`, `LessonRepository`, `ProgressRepository`, and `OnePageLearningCheckpointRepository` from Tasks 1–2.
- Produces: `getOnePageLearningPath(deps, userId, selectedCourseId?): Promise<OnePageLearningPath>` where `OnePageLearningPath` contains `courses`, `selectedCourseId`, `queue`, and `checkpoint`.
- Produces: `recordOnePageExercise(deps, input): Promise<{ checkpoint: OnePageLearningCheckpoint; completedLesson: { lessonId: string; result: LessonResult } | null }>` for Task 4.

- [ ] **Step 1: Write failing query tests for course selection and queue construction**

Use fakes to verify: the first three courses containing a not-completed lesson are selectable; default is the earliest such course; a selected course’s queue preserves Unit/Lesson/exercise order; it contains at most ten entries; it never crosses to the next course; and a fully completed course is excluded.

- [ ] **Step 2: Add failing checkpoint-reconciliation tests**

Seed a checkpoint with completed exercise IDs and a valid partial result. Assert the queue begins at the next exercise and preserves the stored submission ID/aggregate. Seed an exercise ID no longer in content and assert the returned checkpoint/view model excludes it. Cover the fewer-than-ten end-of-course case.

- [ ] **Step 3: Add failing checkpoint-write tests**

Assert `recordOnePageExercise` adds a completed exercise exactly once, sums accepted/rejected counters, records a mistake once per exercise, starts a UUID submission ID for a new partial lesson, and returns a complete `LessonResult` only when all exercises of that lesson are recorded.

- [ ] **Step 4: Run query and checkpoint-use-case tests to verify they fail**

Run: `pnpm test --run src/application/get-one-page-learning-path.test.ts src/application/save-one-page-checkpoint.test.ts`

Expected: FAIL because the query and checkpoint application use cases do not exist.

- [ ] **Step 5: Implement the query and checkpoint use cases**

Build course candidates from `getOrderedLearningPath` and target progress. Reconcile a selected course checkpoint against live lesson exercises before returning the queue. `recordOnePageExercise` must use the supplied per-exercise result to produce raw counters and retain a stable `submissionId` per unfinished lesson; it does not call lesson completion itself.

- [ ] **Step 6: Extend fakes and run application verification**

Add an in-memory `FakeOnePageLearningCheckpointRepository` to `src/test/fakes.ts`, then run the focused tests.

Run: `pnpm test --run src/application/get-one-page-learning-path.test.ts src/application/save-one-page-checkpoint.test.ts`

Expected: PASS.

### Task 4: Per-exercise Typing Boundary and Home Route Action

**Files:**
- Modify: `src/domain/korean/lesson-session.ts`
- Modify: `src/domain/korean/lesson-session.test.ts`
- Modify: `src/features/typing/lesson-session-store.ts`
- Modify: `src/features/typing/lesson-session-store.test.ts`
- Modify: `src/features/course/CourseListPage.loader.ts`
- Create: `src/features/course/CourseListPage.loader.test.ts` cases for player data
- Modify: `src/features/course/CourseListPage.action.ts`
- Modify: `src/features/course/CourseListPage.action.test.ts`
- Modify: `src/app/router.ts`

**Interfaces:**
- Consumes: `recordOnePageExercise`, `getOnePageLearningPath`, checkpoint repository, and `completeLessonSession` dependencies.
- Produces: `ExerciseResult` at each reducer transition and Home action intents `one-page-exercise-completed` and `one-page-retry-completion`.
- Produces: Home loader data property `onePageLearningPath: OnePageLearningPath` for Task 5.

- [ ] **Step 1: Write failing typing-domain/store tests for per-exercise completion**

Assert the reducer/store exposes the exact `ExerciseResult` for each completed exercise before advancing to the following prompt, including its target text, correct-key count, and mistakes. Retain existing multi-exercise direct-lesson completion behavior.

- [ ] **Step 2: Run the typing tests to verify they fail**

Run: `pnpm test --run src/domain/korean/lesson-session.test.ts src/features/typing/lesson-session-store.test.ts`

Expected: FAIL because no public per-exercise completion boundary is exposed.

- [ ] **Step 3: Implement the minimum per-exercise event boundary**

Add an immutable `lastCompletedExercise` (or an equivalent explicit return value) to `LessonSessionState` and surface it through the Zustand store. It must change only at an exercise completion, allowing the player to submit a checkpoint once without observing keystroke changes.

- [ ] **Step 4: Write failing Home loader/action tests**

For the loader, assert it combines the existing course-list data with `onePageLearningPath` through application dependencies. For the action, submit an exercise-completed payload, verify it calls `recordOnePageExercise`, and when that call returns a completed lesson, invoke `completeLessonSession` with the stored submission ID. Test a retry uses that same ID and does not create a second submission effect.

- [ ] **Step 5: Implement Home loader/action intents and router dependency wiring**

Extend `createCourseListLoader` with required application/repository dependencies and load its independent existing data in parallel with the player query. Extend `createCourseListAction` to discriminate the new JSON intents before existing display-name/auth behavior. Keep validation at the action boundary with Zod schemas. Wire local checkpoint and completion dependencies in `router.ts`.

- [ ] **Step 6: Run route and typing verification**

Run: `pnpm test --run src/domain/korean/lesson-session.test.ts src/features/typing/lesson-session-store.test.ts src/features/course/CourseListPage.loader.test.ts src/features/course/CourseListPage.action.test.ts`

Expected: PASS.

### Task 5: One-page Player and Finger Placement Presentation

**Files:**
- Create: `src/features/home/OnePageLearningPlayer.tsx`
- Create: `src/features/home/FingerPlacementGuide.tsx`
- Modify: `src/features/course/CourseListPage.tsx`
- Modify: `src/features/course/CourseListPage.test.tsx` only where loader data/type changes require it
- Reuse: `src/features/typing/VirtualKeyboard.tsx`

**Interfaces:**
- Consumes: `OnePageLearningPath`, Home action intents, and the per-exercise typing-store boundary from Task 4.
- Produces: UI that lets the learner select only one of supplied courses, types the active queue exercise, persists after exercise completion, and renders the keyboard/finger guide.

- [ ] **Step 1: Implement `FingerPlacementGuide` as presentation-only data**

Encode the approved left/right finger mappings in one component or exported constant. It must not alter keyboard key handling, layout, or persistence.

- [ ] **Step 2: Implement `OnePageLearningPlayer`**

Render course selector, current course/lesson context, Korean target text, all available translation/romanization fields, current queue count, existing `VirtualKeyboard`, and the finger guide. Drive typing through the shared store; submit one Home action after each newly observed completed exercise. Preserve selected course in component state and request/consume that course’s loader data without repository calls from React.

- [ ] **Step 3: Place the player above Hero in `CourseListPage`**

Render `OnePageLearningPlayer` immediately after the header. Keep the Hero section below it unchanged in content and retain the existing course-card section and links.

- [ ] **Step 4: Update only necessary component test fixtures and run static checks**

Do not add visual-behavior tests. Adjust existing loader data fixtures only if TypeScript requires the added property.

Run: `pnpm build && pnpm lint`

Expected: PASS.

- [ ] **Step 5: Perform manual browser verification**

Verify: player precedes Hero; course selector lists no more than three incomplete courses; a course with fewer than ten exercises does not cross course boundary; reload resumes the next prompt; keyboard highlighting still works; finger guide appears; Course Map and direct Lesson links still work.

### Task 6: Documentation and Whole-change Verification

**Files:**
- Modify: `docs/DECISIONS.md`
- Modify: `docs/DOMAIN-MODEL.md`
- Modify: `docs/SESSION-AND-HISTORY.md`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/COMPLETE-LOG.md`

**Interfaces:**
- Consumes: accepted behavior proven in Tasks 1–5.
- Produces: authoritative documentation that distinguishes local UI resume data from LearningSession history and records actual implementation status.

- [ ] **Step 1: Document the accepted local-only checkpoint decision**

Add a decision explaining its key, fields, browser-local scope for both user modes, exercise-boundary writes, no migration, and separation from progress/history.

- [ ] **Step 2: Align target model and history documents with shipped code**

Describe missing/unlocked/completed implementation, legacy-locked read compatibility, queue ordering/cap, and the local checkpoint’s no-history rule. Do not claim seed content or cross-device resume exists.

- [ ] **Step 3: Update status and completion logs with actual verification results**

Record only completed behavior and commands actually run; preserve unrelated existing entries.

- [ ] **Step 4: Run the full verification suite**

Run: `pnpm test && pnpm build && pnpm lint && git diff --check`

Expected: all commands exit 0.

## Plan Self-review

- **Spec coverage:** Tasks 1–5 cover target progress, local resume state, queue selection/cap, typing/session integration, and the player/finger guide. Task 6 covers the required documentation updates. No spec section is unassigned.
- **Step scan:** Every implementation step names the exact file boundary, interface, and verification command; no production code is embedded in the plan.
- **Type consistency:** Task 1 exports global order and target Progress; Task 2 exports the checkpoint repository; Task 3 consumes both and exports query/write use cases; Task 4 wires them through Home; Task 5 consumes Home data/action behavior.
- **Review focus:** Each listed risk is assigned to a concrete test task above.
- **Proportion:** Six independently reviewable tasks separate persistence/progress logic from player presentation without introducing unneeded subsystems.
