# Admin Content Counts — Design

**Date:** 2026-10-08
**Status:** Proposed (to be recorded as DEC-047 when accepted)
**Related:** [[DEC-034]] (status gating, no hard deletion, stable Exercise IDs), [[DEC-043]] (Home course)

## Problem

Admin BO pages count only the children they load: the Dashboard counts
Courses, the Course page counts its Units, and the Unit page counts its
Lessons. Authors want totals for every level below the current one (for
example Units, Lessons, and Exercises on the Dashboard). Computing those by
reading every Unit and Lesson does not scale as content grows.

## Decision

Store descendant counts on each content document and maintain them on every
write that can change them. Pages read totals from documents they already
load; no extra queries.

| Model    | New fields (non-negative integers)              |
| -------- | ----------------------------------------------- |
| `Course` | `unitCount`, `lessonCount`, `exerciseCount`     |
| `Unit`   | `lessonCount`, `exerciseCount`                  |
| `Lesson` | `exerciseCount` (always `exercises.length`)     |

- Counts include every status (Draft, Published, Archived). Status changes
  never touch counters. Learner-facing published-only counts are out of scope
  and would be separate fields.
- No global counter document: summing Course counters on the Dashboard avoids
  a single hot document that every create would write.
- Counters are read-only to use cases. Domain models expose them; the mappers
  read a missing field as `0`.

## Why counters can stay exact

Only three operations change a count, because content is never deleted
(Rules deny delete), never moves to another parent, and saved Exercises are
never removed (`exerciseRemoved`):

| Operation     | Counter writes (same atomic commit as the content write)                         |
| ------------- | -------------------------------------------------------------------------------- |
| Create Unit   | `course.unitCount += 1`                                                          |
| Create Lesson | `unit.lessonCount += 1`, `course.lessonCount += 1` (Course found through the Unit) |
| Write Lesson  | `delta = new exercises − saved exercises`; `lesson.exerciseCount = length`; `unit.exerciseCount += delta`; `course.exerciseCount += delta` |

"Write Lesson" covers every Lesson write (save, publish, publish-with-parents,
archive, restore). Only the editor save changes the length today, but
computing the delta inside the write keeps any future writer correct.

## Persistence rules

1. **Counter maintenance lives in the Firebase adapter.** Lesson writes run
   in a Firestore transaction that reads the saved Lesson, then writes the
   Lesson and `increment(delta)` on its Unit and Course. Creates use one
   batch with `increment(1)`.
2. **Content saves must not overwrite counters.** `saveCourse`, `saveUnit`,
   and `saveContent` currently `setDoc` the whole document, which would write
   a stale counter read earlier. They switch to updating only author-editable
   fields (`title`, `description`, `type`, `status`, `archivedFromStatus`
   — removed with `deleteField()` when absent — and `updatedAt`).
3. **Ordering writes** already update only `order` and `updatedAt`; unchanged.

## Existing data and repair

A local Admin SDK script, `pnpm content:backfill-counts`, recomputes every
counter from the collections and writes only documents whose stored values
differ. It follows `content:migrate-status`: `--dry-run` first, then
`--write --after-dry-run`. Running it again repairs any drift. Per CLAUDE.md
Firebase Caution, it writes only after the user approves the dry-run output.

## UI

- **Dashboard:** keeps the Course status cards; adds Units, Lessons, and
  Exercises totals summed from loaded Courses.
- **Course page:** shows the Course's Lessons and Exercises totals; each Unit
  row shows its Lessons and Exercises counts.
- **Unit page:** shows the Unit's Exercises total; each Lesson row shows its
  Exercises count.
- **Lesson page:** unchanged (it already counts its loaded Exercises).

## Out of scope

- Published-only or per-status descendant counts.
- Learner-facing use of counters and the Home static export.
- Firestore Rules changes: admin writes are already allowed and learners may
  read the extra fields.

## Alternatives considered

- **Aggregation queries (`count()`, `sum()`):** always exact with no
  maintenance, but Lessons would need a denormalized `courseId`, and each
  Dashboard load would run three queries per Course.
- **Per-status counters:** every publish, archive, and restore would move
  counts up to the Course; rejected for this scope.

## Testing

- Firebase adapter counter behavior runs against the Firestore Emulator
  (`pnpm test:rules` infrastructure); the adapter accepts a Firestore instance
  for that.
- The fake repository mirrors the counter rules so use-case and action tests
  can assert counts.
- The backfill script is unit-tested with a fake Admin Firestore, like
  `migrate-content-status.test.ts`.
- No automated tests for the presentation of the new counts.
