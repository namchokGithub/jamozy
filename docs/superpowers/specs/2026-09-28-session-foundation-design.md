# Learning session and exactly-once foundation

**Status:** Implemented (Lesson and Review scope)

## Goal

Make submitted Lesson and Review activity durable as `LearningSession` history
and apply its learner-state effects exactly once. Preserve pre-session learner
numbers as immutable baselines so current progress is not lost and later
Guest-to-account migration can be safe.

## Scope

- Add `LearningSession` and repository contracts for Lesson and Review only.
- Generate a session ID when a typing session starts; reuse it on a retry of
  the same submission.
- Add one submitted-session checkpoint boundary that atomically/idempotently
  persists history and applicable learner-state effects per adapter.
- Record new EXP and raw stats only from submitted sessions.
- Preserve existing EXP/UserStats as an immutable `legacyBaseline`.
- Update profile summaries to combine the baseline with post-foundation session
  aggregates.

## Baseline and migration policy

`legacyBaseline` holds the current pre-LearningSession EXP and UserStats
snapshot. It is never recomputed from historical sessions and never modified
by new session submissions. `sessionAggregate` holds only raw effects from new
sessions.

**Compatibility layer:** the current `UserProfile.exp` and `UserProfile.stats`
fields are legacy presentation values and must not be reinterpreted as raw
session counters. Persistence mapping captures them as `legacyBaseline`; a
profile summary combines that immutable baseline with `sessionAggregate` for
display where totals are exact. Legacy average accuracy/WPM must remain legacy
values; raw session-tracked accuracy/WPM display separately as `Since session
tracking` rather than using an approximate combined average. This prevents a
schema rollout from losing or retroactively changing existing learner numbers.

Future migration treats baselines specially: if Cloud already has a baseline,
it wins unconditionally over a Guest baseline. Guest and Cloud sessions still
union by `sessionId`; progress/review retain the merge policy in DEC-030.

## Architecture

Application code creates a `SubmittedSession` from a Lesson or Review result
and sends it to `SessionSubmissionRepository.submit`. The repository returns a
previous outcome for a known session ID; otherwise it writes history and all
effects once. IndexedDB uses one read/write transaction; Firestore uses one
transaction. React and application code never manage transaction details.

`LearningSession` stores context, start/completion times, duration, accepted
and rejected keystrokes, completed exercises, and actual EXP. Accuracy/WPM are
derived on read. No keystrokes, exercise snapshots, or mistake-event arrays are
persisted.

## Excluded

- Daily Quest, Topic, Keyboard Position, Random practice, VocabularyProgress,
  JamoStat, history UI/query, migration implementation, and analytics.
- Reconstructing or altering historical baseline values.

## Acceptance criteria

1. Lesson/Review retry with the same ID does not double-count effects or create
   duplicate history.
2. A real replay receives a new ID and is counted independently.
3. Existing profile values remain visible as baseline; new session values are
   raw and additive only through the checkpoint boundary.
4. Guest and Firebase adapters expose identical submission semantics.
5. Cloud baseline wins over Guest baseline during future migration.
