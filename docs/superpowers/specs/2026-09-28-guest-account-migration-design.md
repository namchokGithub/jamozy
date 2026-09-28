# Guest-to-account migration

**Status:** Implemented — user-reported focused/full tests, build, and lint passed on 2026-09-28.

## Goal

Automatically, safely, and repeatably merge a signed-in user's current Guest
data into their Firebase account after Email/password or Google authentication.
The operation must preserve Guest data locally until it has completed and must
never duplicate a submitted session's aggregate or learner-state effects.

## Scope

- Start migration automatically after a successful sign-in or sign-up.
- Migrate the persisted entities that exist on this branch: `UserProfile`,
  `Progress`, `ReviewItem`, `LearningSession`, and session submission receipts.
- Store a Cloud migration marker at `users/{uid}/migrations/{guestId}` and a
  local checkpoint for retry/recovery.
- Add the Firestore access rules needed for learner history, receipts, and
  migration markers.
- Revalidate routes after a successful automatic migration.

## Excluded

- Guest-data deletion or automatic cleanup.
- UI consent, onboarding, or a migration modal.
- DailyQuestProgress, VocabularyProgress, JamoStat, and other modes that do
  not yet have persisted adapters in this branch.
- History query/UI and account linking.

## Trigger and recovery

The authentication action reads the active Guest session before authenticating.
After Firebase Auth succeeds, it invokes `MigrateGuestDataToAccount` with that
`guestId` and the new authenticated UID. If authentication fails, migration is
not started.

The migration key is the pair `(guestId, uid)`. A Cloud marker records the
terminal success state; a local checkpoint records that the pair has started
and completed. A retry may resume after a tab close, network error, or action
response failure. Local Guest records are never deleted or marked unavailable
until a later, separately-approved cleanup feature.

An automatic migration failure must not turn a successful sign-in into a sign-in
failure. The user is authenticated and continues on Cloud storage; the failure
is surfaced to the caller for logging/retry without overwriting any data.

## Snapshot and merge rules

The local adapter exports a read-only snapshot for one `guestId`, including the
Guest profile, all progress records, review items, learning sessions, and
session-outcome receipts. The Cloud adapter reads the corresponding account
records only as needed inside the migration operations.

Rules from DEC-030 and DEC-031 are applied as follows:

| Data | Result |
| --- | --- |
| Legacy baseline | A Cloud `legacyBaseline` wins whenever present. Otherwise a Guest legacy baseline (or the Guest profile's pre-session values) becomes the account baseline. |
| Settings | Use the most recent trustworthy `updatedAt`; otherwise retain Cloud settings. |
| displayName | Retain a non-empty Cloud name; otherwise use the Guest name. |
| Progress | Keep `completed > unlocked > missing`; preserve max accuracy/WPM and max attempts, and retain the latest non-null attempt/completion timestamps. |
| ReviewItem | Union by ID; retain the earlier `nextReviewAt`, minimum `box`, maximum `mistakeCount`, latest `lastMistakeAt`, and `resolved=true` only when both sides are resolved. |
| LearningSession | Union by original `sessionId`; a pre-existing Cloud session is never recreated. |
| Session aggregate/effects | Only a Guest session whose Cloud receipt does not exist contributes its aggregate. Its persisted receipt effects are merged under the Progress/Review rules in the same transaction. |

No migration adds two `exp`/`stats` snapshots. Current session-tracked totals
come only from receipts/session aggregates that have not previously reached the
Cloud destination.

## Persistence protocol

First, profile/progress/review legacy state is merged with Cloud state. Then
each Guest session receipt is processed in a Firestore transaction:

1. Read `sessionOutcomes/{sessionId}`.
2. If it exists, return without applying session effects.
3. Merge the receipt's progress/review effects with the current Cloud documents.
4. Create `learningSessions/{sessionId}`, `sessionOutcomes/{sessionId}`, and
   the updated profile session aggregate atomically.

The migration writes a final Cloud marker only after every session receipt has
completed. Firestore transaction/batch limits are respected by processing
bounded groups; each session is independently idempotent, so repeating a group
is safe.

## Rules

The owner of `users/{uid}` may read/write:

- `learningSessions/{sessionId}`
- `sessionOutcomes/{sessionId}`
- `migrations/{guestId}`

No other user may access these documents.

## Acceptance criteria

1. Sign-in automatically starts migration with the Guest identity that existed
   before Firebase Auth changed the active session.
2. Retrying the same `(guestId, uid)` never duplicates history, aggregate EXP,
   progress, or review effects.
3. Cloud/Guest merge results obey every applicable DEC-030/031 rule.
4. A failure leaves both the Cloud account and all Guest records recoverable.
5. A user can access only their own history, receipts, and migration marker.
6. Full tests, build, and lint pass before completion.
