# One-page Learning Path Design

**Date:** 2026-09-29  
**Status:** Proposed — approved for specification; pending user review before implementation

## Goal

Make the home route the primary place to practise Korean typing with minimal
navigation. A learner can choose one of the first three unfinished courses,
resume exactly where they stopped after a refresh, and type a bounded queue of
up to ten exercises from that one course.

The existing Hero ("Learn Hangul, at your pace.") stays on the home page below
the player. The existing "Your learning path" course cards and the Course Map
and Lesson routes remain available for deliberate lesson selection.

## Scope

### Included

- A route-owned one-page player at `/` above the existing Hero.
- A course selector containing the first three incomplete published courses in
  canonical `Course.order` order.
- A ten-exercise queue from the selected course only, ordered by
  `Unit.order`, `Lesson.order`, then embedded exercise array order.
- A local IndexedDB checkpoint that resumes the next uncompleted exercise
  after a reload.
- Per-exercise display of Korean text, Thai and English meanings, and
  romanization.
- Reuse of the existing virtual Korean keyboard, plus a presentational finger
  placement guide based on the supplied left/right-hand mappings.
- Learning Path progress behavior that conforms to the target model: missing
  progress is locked; persisted progress is only `unlocked` or `completed`;
  advancement uses the global course/unit/lesson order and contiguous frontier.

### Excluded

- New seed content, content imports, or changes to the Admin content UI.
- Firebase persistence, cross-device sync, or guest-to-account migration for
  the one-page checkpoint.
- Persisting raw keystrokes, an abandoned session in LearningSession history,
  or per-keystroke database writes.
- Replacing the visual design of the existing keyboard.
- Changing the existing Course Map or direct Lesson flow beyond shared
  target-progress compatibility.

## User experience

At the top of Home, the player shows a compact selector for up to three
unfinished courses. The first course with at least one lesson not completed is
selected by default. Selecting a course changes only that player’s local
checkpoint and queue; it does not alter global lesson progress.

The queue contains at most ten exercises from the selected course. It begins
at the first exercise that the local checkpoint has not marked complete,
continues through subsequent lessons in that course, and stops at ten or at
the end of the course. It never fills the remaining slots from another course.
For example, when three exercises remain in the current lesson, the player
shows those three followed by the next seven exercises in the same course.

The active prompt presents the Korean target text, both translations when
available, and romanization when available. It keeps the existing keyboard
component and its existing highlighting behavior. A non-interactive finger
placement guide appears with it:

- Left: pinky (`~`, `1`, `Q`, `A`, `Z`, Tab, Caps, Shift); ring (`2`, `W`,
  `S`, `X`); middle (`3`, `E`, `D`, `C`); index (`4`, `5`, `R`, `T`, `F`,
  `G`, `V`, `B`); thumb (Space).
- Right: pinky (`=`, `-`, `0`, `)`, `P`, `;`, `:`, `/`, `?`, `'`, `\"`,
  `[`, `{`, `]`, `}`, Enter, Shift); ring (`9`, `O`, `L`, `.`, `>`); middle
  (`8`, `I`, `K`, `,`, `<`); index (`6`, `7`, `Y`, `U`, `J`, `H`, `N`, `M`);
  thumb (Space).

Completing an exercise advances immediately to the next queued exercise. The
page writes a checkpoint at that boundary only. A reload restores that next
exercise and the partial results for its containing lesson. If the selected
course has no remaining exercise, the player shows a calm completed state and
the course remains selectable only through the normal learning-path UI if the
learner wishes to replay it.

## Architecture and data flow

```text
Home loader
  -> GetOnePageLearningPath use case
     -> CourseRepository + LessonRepository + ProgressRepository
     -> local OnePageCheckpointRepository
  -> OnePageLearningPlayer
     -> Zustand typing state (while an exercise is active)
     -> checkpoint action after each completed exercise
     -> CompleteLessonSession when a lesson’s final exercise completes
```

`GetOnePageLearningPath` is an application use case. It owns ordering,
unfinished-course selection, queue construction, and checkpoint reconciliation;
React never reads IndexedDB, Firestore, or repository adapters directly.

The current `LessonSessionState` already records a result whenever an exercise
completes. Its public boundary will be extended so the player can receive that
individual result before moving to the next exercise. The player accumulates
per-lesson counters and mistake reports in the checkpoint, not in the global
Zustand store. When a lesson’s final exercise is complete, it derives that
lesson’s `LessonResult` from the accumulated raw counters and invokes the
existing session-submission boundary once for that lesson. This retains
one `LearningSession`, one receipt, and normal EXP/review/progress effects per
completed lesson.

The active prompt state remains in Zustand and disappears on refresh. The
checkpoint contains only completed-exercise boundaries and accumulated lesson
totals, so it can safely restart the current, not-yet-completed exercise after
a refresh without writing raw keystrokes.

## Local checkpoint model

Add a domain model and repository interface dedicated to this UI resume state;
it is not `LessonProgress`, `LearningSession`, or a new shared learning mode.

```ts
type OnePageLearningCheckpoint = {
  userId: string
  courseId: string
  completedExerciseIdsByLesson: Record<string, string[]>
  partialLessonResults: Record<
    string,
    {
      submissionId: string
      startedAtMs: number
      acceptedKeystrokes: number
      rejectedKeystrokes: number
      completedExerciseIds: string[]
      mistakes: Array<{ sourceExerciseId: string; targetText: string }>
    }
  >
  updatedAt: Date
}
```

The record is keyed by `${userId}:${courseId}` in a new IndexedDB store. It is
always local, including for authenticated accounts, and is intentionally not
included in the guest-to-account migration snapshot.

After a lesson is successfully submitted, its completed exercises and partial
result are removed from the checkpoint. The next loader derives its state from
persisted `LessonProgress` plus any remaining local checkpoint data. Invalid
exercise IDs (for example, content edited after checkpoint creation) are
ignored and pruned on the next local checkpoint write.

## Target Progress implementation

`Progress.status` becomes `unlocked | completed`; all writes create only those
states. The global ordering helper will enumerate published courses, then
their published units and lessons, sorting by their documented order fields.

After a first completion, the completion use case scans that global sequence
after the completed lesson, skips already-completed lessons, and ensures only
the first non-completed lesson has `unlocked` progress. It can therefore cross
Unit and Course boundaries. Course-level selection in the one-page player does
not change this global advancement rule.

For compatibility, legacy stored `locked` records are treated as absent by
read paths and excluded from aggregate progress reads. New code never writes
them. This avoids destructive deletion of learner data during this UI change;
a separate operational migration may remove obsolete records later.

## Components and files

- `application/get-one-page-learning-path.ts`: course selection, flattening,
  checkpoint reconciliation, and up-to-ten queue construction.
- `application/save-one-page-checkpoint.ts`: validates and persists a completed
  exercise boundary locally.
- `domain/models/one-page-learning-checkpoint.ts` and
  `domain/repositories/one-page-learning-checkpoint-repository.ts`: local
  resume-state contract.
- `infrastructure/local/local-one-page-learning-checkpoint-repository.ts` and
  `GuestDatabase`: a versioned IndexedDB store; it is deliberately not added
  to Firebase adapters or migration repositories.
- `features/home/OnePageLearningPlayer.tsx` and supporting presentation
  components, including `FingerPlacementGuide.tsx`.
- Home loader and router wiring: load the application view model and submit
  checkpoint/completion actions through application use cases.
- The typing-session domain/store boundary: expose per-exercise completion
  events while retaining the existing direct-Lesson behavior.
- Progress model, mappers, repositories, completion application use cases, and
  their consumers: adopt the target missing/unlocked/completed semantics.

The existing `CourseListPage` remains the Home shell and renders the player
before its existing Hero. Course cards continue linking to `/courses/:courseId`.

## Failure handling

- No published content or no incomplete course: render no player or a neutral
  empty state; retain the Hero and course cards.
- A course has fewer than ten remaining exercises: render its available
  exercises only and never pull from another course.
- A local checkpoint cannot be read or saved: show a recoverable error and do
  not claim the exercise was checkpointed; in-memory typing continues.
- Submission of a completed lesson fails: retain the local accumulated result
  and its checkpointed `submissionId`, then retry through that same session ID,
  preserving the existing exactly-once submission guarantee.
- A selected course becomes unavailable or its checkpoint no longer matches
  published content: discard invalid local entries, rebuild from available
  content, and show the next valid course.

## Verification

Automated tests cover non-visual behavior:

1. Selection of the first three incomplete courses and default course.
2. Canonical queue order and the ten-item cap without cross-course filling.
3. Queue construction from a partially completed local checkpoint.
4. Resume after reload and stale-checkpoint reconciliation.
5. Partial per-lesson result aggregation and exactly one lesson submission on
   the last exercise.
6. Global contiguous-frontier behavior, including Unit and Course boundaries,
   and legacy `locked` compatibility.
7. Local-only checkpoint routing for both guest and authenticated sessions.

No automated tests are added solely for the player layout, finger guide, or
keyboard presentation. Manual verification will cover the Home ordering,
course switching, keyboard highlighting, finger guide, refresh resume, and
the unchanged direct Course/Lesson navigation.

## Documentation updates on implementation

Implementation will add the accepted checkpoint and target-progress decisions
to `docs/DECISIONS.md`, update `docs/DOMAIN-MODEL.md` and
`docs/SESSION-AND-HISTORY.md` to distinguish local resume state from session
history, and record the completed work in `docs/PROGRESS.md` and
`docs/COMPLETE-LOG.md`.
