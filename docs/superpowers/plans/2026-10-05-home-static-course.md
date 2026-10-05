# Home Static Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home plays one Admin-managed `home` course from a build-time static JSON export, with lesson-scoped shuffled sessions, synced exercise progress, and all persistence in the background.

**Decision:** [[DEC-043]] (supersedes [[DEC-035]]; narrows [[DEC-042]]; extends [[DEC-034]]).

**Architecture:** `Course.type` separates the single `home` course from Learning Path content. A build script exports the published `home` course to `public/content/home.json`; Home reads only that file. Exercise progress and the first-completion partial result live on `Progress` and sync like other learner state. A durable IndexedDB outbox carries every Home write and retries it in the background; the player never waits on persistence.

**Tech Stack:** React 19, TypeScript, React Router 8 loaders/actions, Zustand, IndexedDB, Firebase/Firestore, Vitest, React Testing Library, Tailwind CSS 4.

## Global Constraints

- Keep persistence out of components; loaders, actions, and the outbox call application use cases and repository interfaces only.
- Home's first render needs only the static JSON and local cache. No Firestore read or write may block it or the typing flow.
- Persist at completed-exercise boundaries only, never per keystroke ([[DEC-003]]).
- An absent `Course.type` means `learning`; do not migrate existing course documents.
- Home lessons never create ReviewItems and never read or advance the Learning Path frontier.
- Confirm with the user before changing `firestore.rules`, Storage rules, or any script that writes Firestore data (CLAUDE.md, Firebase Caution).
- No automated tests for presentation-only UI; test domain, application, persistence, export, and migration logic.
- Do not run `git commit` unless the user asks.

## Review Focus

1. **First completion across sessions/devices:** IDs union and the partial result accumulates until every exercise is covered; exactly one first-completion session with the partial result's `submissionId` (Task 4).
2. **Replay:** only a full shuffled session of a completed lesson submits, with 15 EXP; abandoning submits nothing; completion is never reset (Task 4, Task 7).
3. **Outbox idempotency:** a retried or duplicated write produces no duplicate EXP, session, or exercise count (Task 5).
4. **Export guard:** the build fails unless exactly one published `home` course exists; drafts and archived items never reach the JSON (Task 3).
5. **Learning Path isolation:** the `home` course never appears in the course list, global order, frontier, or Daily Quest (Task 2).
6. **Guest migration:** `completedExerciseIds` union; partial-result rule per DEC-043 (Task 4).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/domain/models/course.ts` | `CourseType`, `Course.type`, `courseType()` reader defaulting to `learning`. |
| `src/domain/models/progress.ts` | Optional `completedExerciseIds` and `homePartialResult` on `Progress`. |
| `src/domain/models/learning-session.ts` | `{ mode: 'home'; lessonId }` context. |
| `src/domain/models/home-content.ts` | Static Home content schema (Zod) shared by the export script and runtime reader. |
| `src/domain/home/home-session.ts` | Pure shuffle, session progression, lesson/unit advance, and progress display rules. |
| `scripts/export-home-content.ts` | Build-time export of the published `home` course to `public/content/home.json`. |
| `src/infrastructure/static/static-home-content-repository.ts` | Fetch and validate `home.json`. |
| `src/application/record-home-exercise.ts` | Merge one completed exercise into `Progress`; submit first completion. |
| `src/application/submit-home-replay.ts` | Submit a full replay session for a completed lesson. |
| `src/infrastructure/local/home-outbox.ts` | Durable IndexedDB outbox with background retry. |
| `src/infrastructure/local/home-resume-store.ts` | Local `{ unitId, lessonId }` resume state. |
| `src/features/home/*` | Unit categories, lesson list with `n/m`, shuffled player, auto-advance notice. |

---

### Task 1: Docs and domain foundation

**Files:** `docs/DOMAIN-MODEL.md`, `docs/LEARNING-MODES.md`, `docs/SESSION-AND-HISTORY.md`, `docs/AUTH-AND-PERSISTENCE.md`, `AGENTS.md`, `src/domain/models/{course,progress,learning-session,home-content}.ts`, model tests.

- [ ] **Step 1:** Update topic docs to DEC-043: `Course.type`; `Progress.completedExerciseIds` and `homePartialResult`; `home` session context; replace "Local one-page checkpoint" sections; Home as a Course-structured exception in LEARNING-MODES; migration rule in AUTH-AND-PERSISTENCE.
- [ ] **Step 2:** Propose to the user an `AGENTS.md` hard-rule wording that names Home exercise completion as a checkpoint; apply only after approval.
- [ ] **Step 3:** Write failing tests: `courseType()` defaults to `learning`; `home-content` schema accepts a valid export and rejects missing IDs or empty exercises.
- [ ] **Step 4:** Implement the model changes; keep new `Progress` fields optional so existing records and adapters stay valid.
- [ ] **Step 5:** `pnpm test`, `pnpm tsc -b`.

### Task 2: Admin BO type field and Learning Path isolation

**Files:** `src/application/admin-content.ts`, `src/features/admin/CourseEditorPage.tsx`, `src/infrastructure/firebase/repositories/firebase-course-repository.ts`, `src/application/learning-path-order.ts`, `src/application/get-course.ts`, related tests.

- [ ] **Step 1:** Write failing tests: publishing a second `home` course is rejected by `publishCourse`; `getOrderedLearningPath` and `getCourses` omit `home` courses, including when other courses lack `type`.
- [ ] **Step 2:** Add the `type` select to the course editor and persist it through `saveCourse`.
- [ ] **Step 3:** Filter `home` in the application layer (not with a Firestore `where`, which drops untyped courses).
- [ ] **Step 4:** Check Daily Quest and course-map loaders for course enumeration and exclude `home` there too.
- [ ] **Step 5:** Ask the user whether a rules-level guard for `type` is wanted; if yes, update `firestore.rules` and `firestore.rules.test.ts`, run `pnpm test:rules`.
- [ ] **Step 6:** `pnpm test`.

### Task 3: Build-time Home export

**Files:** `scripts/export-home-content.ts`, `package.json`, `public/content/home.json` (generated), `.gitignore` decision, tests for the pure export transform.

- [ ] **Step 1:** Extract a pure `toHomeContent(courses, units, lessons)` and test it: exactly one published `home` course or throw; only published units/lessons; order by `order`; output matches the `home-content` schema.
- [ ] **Step 2:** Implement the script with the client SDK and published-only queries (like `scripts/seed-firestore.ts` config loading); write `public/content/home.json`.
- [ ] **Step 3:** Add `content:export-home` and make `build` run it before `vite build`. Ask the user whether the generated file is committed or built in CI (Cloudflare Pages needs `VITE_FIREBASE_*` at build time if built there).
- [ ] **Step 4:** Run the export against the real project only after the user confirms; it reads, never writes.

### Task 4: Home progress and completion use cases

**Files:** `src/application/record-home-exercise.ts`, `src/application/submit-home-replay.ts`, `src/application/complete-lesson-session.ts`, `src/application/migrate-guest-data-to-account.ts`, Firebase/local progress adapters, tests, `src/test/fakes.ts`.

- [ ] **Step 1:** Write failing tests for `recordHomeExercise`: unions IDs without double counting; accumulates the partial result once per new exercise; on first full coverage marks `completed`, submits one session with `mode: 'home'`, accuracy EXP, `sessionId = submissionId`, no ReviewItems, no frontier lookup; a duplicate call after completion is a no-op.
- [ ] **Step 2:** Write failing tests for `submitHomeReplay`: completed lesson plus full shuffle grants 15 EXP with a new session ID; never changes completion or exercise IDs.
- [ ] **Step 3:** Add a `home` option to `completeLessonSession` (or a sibling) that skips `reviewEffects` and `getOrderedLearningPath`.
- [ ] **Step 4:** Make Firebase and local progress adapters round-trip the new fields.
- [ ] **Step 5:** Extend Guest-to-account migration with the DEC-043 merge rule and test it with fakes only (no real Firebase data).
- [ ] **Step 6:** `pnpm test`.

### Task 5: Background outbox

**Files:** `src/infrastructure/local/home-outbox.ts`, `src/infrastructure/local/guest-database.ts` (new store), `src/app/router.ts` wiring, tests.

- [ ] **Step 1:** Write failing tests: entries persist across instances; processed in order per lesson; failures retry with backoff; a successful entry is removed; replaying an entry is safe because use cases are idempotent.
- [ ] **Step 2:** Implement the outbox over IndexedDB; drain on app start, after each enqueue, and on `online`.
- [ ] **Step 3:** Keep a local Progress cache updated optimistically on enqueue so `n/m` reflects completed exercises immediately.
- [ ] **Step 4:** `pnpm test`.

### Task 6: Home session domain

**Files:** `src/domain/home/home-session.ts`, tests.

- [ ] **Step 1:** Write failing tests: shuffle contains every exercise exactly once (injectable random); session ends after the last one; next lesson, then next unit, then course-complete; display `n/m` is full when `completed`.
- [ ] **Step 2:** Implement pure functions; reuse `lesson-session` typing reducers.
- [ ] **Step 3:** `pnpm test`.

### Task 7: Home UI and wiring

**Files:** `src/features/home/*`, `src/features/course/CourseListPage.{tsx,loader.ts,action.ts}`, `src/infrastructure/local/home-resume-store.ts`, `src/app/router.ts`.

- [ ] **Step 1:** Loader returns the static Home content promise and local cache only; the Learning Path course list stays a separately streamed section.
- [ ] **Step 2:** Build unit categories, lesson list with `n/m`, and the shuffled player; resume from `{ unitId, lessonId }`.
- [ ] **Step 3:** On each completed exercise enqueue `record-home-exercise`; at a completed lesson's full session end enqueue `submit-home-replay`; auto-advance with a non-blocking notice.
- [ ] **Step 4:** Add behavior tests for non-visual logic only: no Firestore call before first render; refresh restarts the lesson with a new shuffle and keeps progress.
- [ ] **Step 5:** `pnpm lint`, `pnpm build`; hand manual UI verification to the user.

### Task 8: Remove superseded code and close out

**Files:** `get-one-page-learning-path.ts`, `save-one-page-checkpoint.ts`, `local-one-page-learning-checkpoint-repository.ts`, `one-page-player-store.ts`, DEC-042 refill/cursor code, their tests, `README.md`, `docs/PROGRESS.md`, `docs/log/2026-10.md`.

- [ ] **Step 1:** Delete the DEC-035 checkpoint and DEC-042 refill paths once Task 7 replaces them; leave existing IndexedDB checkpoint data unread rather than deleting it.
- [ ] **Step 2:** Update README Home section and checklist, PROGRESS, and the monthly log.
- [ ] **Step 3:** `pnpm test`, `pnpm lint`, `pnpm build`.
