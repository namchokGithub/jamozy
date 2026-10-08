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

| File | Responsibility |
| --- | --- |
| `src/domain/models/{course,unit,lesson}.ts` | Optional counter fields. |
| `src/infrastructure/firebase/repositories/firebase-admin-content-repository.ts` | Injectable Firestore; field-only saves; counter maintenance. |
| `src/infrastructure/firebase/repositories/firebase-admin-content-repository.emulator.test.ts` | Emulator tests for counters. |
| `src/test/fakes.ts` | Fake repository mirrors counter rules. |
| `scripts/backfill-content-counts.ts` (+ `.test.ts`) | Recompute and repair counters. |
| `src/features/admin/*Page.tsx`, `AdminContentListToolbar.tsx`, `i18n/dictionaries.ts` | Show totals. |
| `docs/DOMAIN-MODEL.md`, `docs/DECISIONS.md`, `README.md`, `docs/PROGRESS.md`, `docs/log/2026-10.md` | Docs upkeep. |

---

### Task 1: Domain counter fields

**Files:** `src/domain/models/course.ts`, `unit.ts`, `lesson.ts`; adapter mappers `toCourse`/`toUnit`/`toLesson`; `src/test/fakes.ts`.

- [x] Add optional `unitCount?`, `lessonCount?`, `exerciseCount?` to `Course`; `lessonCount?`, `exerciseCount?` to `Unit`; `exerciseCount?` to `Lesson`. Readers `courseCounts(course)` and `unitCounts(unit)` return zeros for missing fields, so UI never handles `undefined` (tests in `course.test.ts`, `unit.test.ts`). Lessons are counted with `exercises.length`.
- [x] Mappers copy only counters that are stored numbers; an absent counter stays absent (no guessed `0` written back by the current whole-document saves before Task 3). `toLesson` does not derive `exerciseCount`; Task 5 writes it.
- [x] `pnpm exec tsc -b` passes.

### Task 2: Injectable Firestore and emulator harness

**Files:** adapter constructor; new emulator test; `package.json`.

- [ ] Constructor `new FirebaseAdminContentRepository(firestore = db)`; replace module `db` uses with `this.firestore`.
- [ ] Emulator test file using `initializeTestEnvironment` with `firestore.rules`, an admin context (`{ admin: true }`), skipped without `FIRESTORE_EMULATOR_HOST` (same guard as `firestore.rules.test.ts`).
- [ ] Extend `test:rules` (or add `test:emulator`) to run both emulator files.
- [ ] First test: `getCourses()` reads a seeded Course with no counters as zeros. Run: `pnpm test:rules` — PASS.

### Task 3: Saves never overwrite counters

- [ ] **Failing emulator test:** seed a Course with `unitCount: 3`; `saveCourse({ ...course, title: 'New' })` with the domain object read before the counter changed (e.g. `unitCount: 0`); expect stored `unitCount` still `3`. Same for `saveUnit` and `saveContent`.
- [ ] Implement `saveCourse`/`saveUnit` and `saveContent` Course/Unit writes as `update()` of `title`, `description`, `type` (Course), `courseId` (Unit, unchanged), `status`, `archivedFromStatus` (`deleteField()` when absent), `updatedAt`.
- [ ] Run `pnpm test:rules` — PASS; existing `pnpm test` stays green.

### Task 4: Create counters

- [ ] **Failing emulator tests:** `createUnit` adds 1 to `course.unitCount`; `createLesson` adds 1 to `unit.lessonCount` and `course.lessonCount`; new documents start at `0`.
- [ ] Implement with `writeBatch`: `set` the new document (counters `0`) plus `update(parent, { …: increment(1) })`. `createLesson` reads the Unit for `courseId` first.
- [ ] Fake repository: same increments. Add a use-case test (`createDraftUnit`, `createDraftLesson`) asserting parent counts.

### Task 5: Lesson writes apply the Exercise delta

- [ ] **Failing emulator tests:** saving a Lesson from 1 to 3 Exercises sets `lesson.exerciseCount = 3` and adds 2 to its Unit and Course; publish/archive of the same Lesson leaves counts unchanged; `saveContent` with a Lesson behaves the same.
- [ ] Implement `saveLesson` as `runTransaction`: read saved Lesson (and its Unit for `courseId`), write the Lesson with `exerciseCount: exercises.length`, then `increment(delta)` on Unit and Course when `delta !== 0`.
- [ ] Switch `saveContent` from `writeBatch` to `runTransaction` so Lesson entries apply the same delta; keep all reads before writes.
- [ ] Fake repository mirrors the delta. Use-case test: `saveLesson` adding Exercises raises Unit/Course `exerciseCount`.

### Task 6: Backfill and repair script

**Files:** `scripts/backfill-content-counts.ts`, `.test.ts`; `package.json` `content:backfill-counts`.

- [ ] **Failing unit test** with a fake Admin Firestore: computes counts from `courses`/`units`/`lessons`; dry-run reports `{ scanned, changed }` without writing; write mode updates only documents whose stored counters differ; arguments follow `parseMigrationArgs` (`--dry-run`, then `--write --after-dry-run`).
- [ ] Implement; run `pnpm test scripts/backfill-content-counts.test.ts` — PASS.
- [ ] Do not run it against Firebase in this task.

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
