# Admin Content Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Course, Unit, and Lesson stores its descendant counts, kept exact on every write, so Admin pages show Units, Lessons, and Exercises totals without extra reads.

**Spec:** `docs/superpowers/specs/2026-10-08-admin-content-counts-design.md` (DEC-047 once accepted).

**Architecture:** Counter fields live on the content documents. The Firebase adapter maintains them atomically: creates use a batch with `increment(1)`; every Lesson write runs in a transaction that applies the Exercise-count delta to its Unit and Course. Course/Unit saves update only author-editable fields so they never overwrite counters. A local Admin SDK script backfills and repairs counters.

**Tech Stack:** TypeScript, Firebase/Firestore (`increment`, `runTransaction`, `writeBatch`, `deleteField`), Firestore Emulator via `@firebase/rules-unit-testing`, Vitest.

## Global Constraints

- Counts include every status; status changes never touch counters.
- Use cases never set counters; only the adapter (and the backfill script) writes them.
- Confirm with the user before running any script that writes Firestore data (CLAUDE.md, Firebase Caution). Deploy the new code before the backfill `--write` (see Rollout).
- No automated tests for presentation-only UI.
- Do not run `git commit` unless the user asks.

## Review Focus

1. No content write path can overwrite a counter with a stale value (Task 3).
2. Create and Lesson-write counter updates commit atomically with the content write (Tasks 4–5).
3. The backfill writes only differing documents and requires a dry-run first (Task 6).

## File Structure

| File                                                                                                | Responsibility                                               |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `src/domain/models/{course,unit,lesson}.ts`                                                         | Optional counter fields.                                     |
| `src/infrastructure/firebase/repositories/firebase-admin-content-repository.ts`                     | Injectable Firestore; field-only saves; counter maintenance. |
| `src/infrastructure/firebase/repositories/firebase-admin-content-repository.emulator.test.ts`       | Emulator tests for counters.                                 |
| `src/test/fakes.ts`                                                                                 | Fake repository mirrors counter rules.                       |
| `scripts/backfill-content-counts.ts` (+ `.test.ts`)                                                 | Recompute and repair counters.                               |
| `src/features/admin/*Page.tsx`, `AdminContentListToolbar.tsx`, `i18n/dictionaries.ts`               | Show totals.                                                 |
| `docs/DOMAIN-MODEL.md`, `docs/DECISIONS.md`, `README.md`, `docs/PROGRESS.md`, `docs/log/2026-10.md` | Docs upkeep.                                                 |

---

### Task 1: Domain counter fields

**Files:** `src/domain/models/course.ts`, `unit.ts`, `lesson.ts`; adapter mappers `toCourse`/`toUnit`/`toLesson`; `src/test/fakes.ts`.

- [x] Add optional `unitCount?`, `lessonCount?`, `exerciseCount?` to `Course`; `lessonCount?`, `exerciseCount?` to `Unit`; `exerciseCount?` to `Lesson`. Readers `courseCounts(course)` and `unitCounts(unit)` return zeros for missing fields, so UI never handles `undefined` (tests in `course.test.ts`, `unit.test.ts`). Lessons are counted with `exercises.length`.
- [x] Mappers copy only counters that are stored numbers; an absent counter stays absent (no guessed `0` written back by the current whole-document saves before Task 3). `toLesson` does not derive `exerciseCount`; Task 5 writes it.
- [x] `pnpm exec tsc -b` passes.

### Task 2: Injectable Firestore and emulator harness

**Files:** adapter constructor; new emulator test; `package.json`.

- [x] Constructor `new FirebaseAdminContentRepository(firestore = db)`; replace module `db` uses with `this.firestore`.
- [x] Emulator test file using `initializeTestEnvironment` with `firestore.rules` (loaded via `?raw`; `src` has no Node types), an admin context (`{ admin: true }`, cast from the compat type), skipped without `FIRESTORE_EMULATOR_HOST`. It uses its own project ID, `jamozy-repository-test`, because Vitest runs it in parallel with `firestore.rules.test.ts`, which seeds and clears `jamozy-rules-test`.
- [x] Extend `test:rules` to run both emulator files.
- [x] First test: `getCourses()` reads a Course with no counters as zeros and keeps stored counters. `pnpm test:rules` — 5 passed.

### Task 3: Saves never overwrite counters

- [x] **Failing emulator tests:** `saveCourse`, `saveUnit`, and `saveContent` with stale counters and `order` keep the stored values; a restored item loses `archivedFromStatus`.
- [x] Implement `saveCourse`/`saveUnit` and `saveContent` Course/Unit writes as `update()` of `title`, `description`, `type` (Course; `deleteField()` when absent), `status`, `archivedFromStatus` (`deleteField()` when absent), `updatedAt`. `order` and `courseId` are no longer written by saves (order commands own `order`; a Unit never changes Course).
- [x] `pnpm test:rules` — 8 passed; unit suite green.

### Task 4: Create counters

- [x] **Failing emulator tests:** `createUnit` adds 1 to `course.unitCount`; `createLesson` adds 1 to `unit.lessonCount` and `course.lessonCount`; new documents start at `0`.
- [x] Implement with `writeBatch`: `set` the new document (counters `0`) plus `update(parent, { …: increment(1) })`. `createLesson` reads the Unit for `courseId` first and throws when it is missing; a missing parent also fails the batch, so no orphan is created.
- [x] Fake repository: same increments, and saves keep stored counters and `order` (mirrors Task 3). Use-case test (`createDraftUnit`, `createDraftLesson`) asserts parent counts. `pnpm test:rules` — 11 passed.

### Task 5: Lesson writes apply the Exercise delta

- [x] **Failing emulator tests:** saving a Lesson from 1 to 3 Exercises sets `lesson.exerciseCount = 3`, adds 2 to its Unit and Course, and keeps the stored `order`; a status-only save leaves counts unchanged; `saveContent` with a Lesson applies the same delta.
- [x] Implement `saveLesson` as `runTransaction`: read the saved Lesson (delta from its stored `exercises`, not a possibly absent counter), read the Unit for `courseId` only when the delta is non-zero, update only editable Lesson fields (`title`, `type`, `exercises`, `exerciseCount`, `status`, `archivedFromStatus`, `updatedAt`; never `order`/`unitId`), then `increment(delta)` on Unit and Course.
- [x] Switch `saveContent` from `writeBatch` to `runTransaction` so Lesson entries apply the same delta; all reads before writes.
- [x] Fake repository mirrors the delta and keeps Lesson `order`. Use-case test: `saveLesson` adding Exercises raises Unit/Course `exerciseCount`. `pnpm test:rules` — 14 passed.

### Task 6: Backfill and repair script

**Files:** `scripts/backfill-content-counts.ts`, `.test.ts`; `package.json` `content:backfill-counts`.

- [x] **Failing unit test** with a fake Admin Firestore: computes counts from `courses`/`units`/`lessons`; dry-run reports `{ scanned, changes: [{ path, from, to }] }` without writing; write mode updates only documents whose stored counters differ and a second run changes nothing; arguments follow `parseMigrationArgs` (`--dry-run`, then `--write --after-dry-run`).
- [x] Implement; `pnpm vitest run scripts` — 7 passed. The CLI prints each change (`path: from -> to`) for review. Run it while nobody edits content: an increment between its read and write would be overwritten.
- [x] Not run against Firebase (the no-argument guard was checked only).

### Task 7: Show the counts (UI only)

- [ ] Dashboard: Units, Lessons, Exercises totals summed from Courses, beside the existing status cards.
- [ ] Course page: Course Lessons and Exercises totals; per-Unit-row "n Lessons · m Exercises".
- [ ] Unit page: Unit Exercises total; per-Lesson-row "m Exercises".
- [ ] EN/TH dictionary keys. Run `tsc -b`, `lint`; hand off manual check.

### Task 8: Docs

- [ ] `DOMAIN-MODEL.md`: counter fields on Course, Unit, Lesson.
- [ ] `DECISIONS.md`: DEC-047 entry and index row.
- [ ] `README.md` Admin operator checklist: backfill commands and rollout order.
- [ ] `PROGRESS.md` and `docs/log/2026-10.md` entries.

## Rollout (user-owned)

1. Deploy the application with Tasks 1–5. Old code `setDoc`s whole documents and would erase counters, so it must be gone before step 2.
2. `pnpm content:backfill-counts -- --dry-run`; review the changed-document list.
3. `pnpm content:backfill-counts -- --write --after-dry-run`.
4. Re-run the dry-run: it should report `0` changed.
