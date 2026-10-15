# Rebirth on Profile — Design

## Goal and scope

Let a learner at Level 100 or higher choose Rebirth from `/profile`. A
successful Rebirth starts a new leveling cycle at Level 1 and 0 cycle EXP,
records the event once, adds one Rebirth Count and one earned Perk Point, and
keeps the learner's history, statistics, and learning progress. The Profile
shows Rebirth Count and earned Perk Points after the operation. Guest and
authenticated learners have the same behavior.

This spec implements the Rebirth slice of
`2026-10-06-player-progression-models-design.md`. It does not implement rank
presentation, a Perk catalog or spending, Perk effects, achievements, new EXP
reward amounts, or a general lifetime-stat redesign. The current
`expRequiredForNextLevel(level, rebirthCount)` curve remains unchanged.

## Progression data and compatibility

Embed canonical progression data in `UserProfile`:

```ts
type ProgressionState = {
  currentExp: number
  totalExpEarned: number
  highestLevel: number
  rebirthCount: number
  perkPointsEarned: number
}
```

All five values are non-negative integers. `currentExp` is the cumulative EXP
earned in the current Rebirth cycle; it is the only input to
`levelProgress(currentExp, rebirthCount)`. `totalExpEarned` never resets.
`highestLevel` retains the highest derived Level reached before or after
Rebirth. `perkPointsEarned` is persisted and shown as the lifetime total of
points awarded, not a spendable balance. In this slice it equals
`rebirthCount`, because each successful Rebirth awards exactly one point and
there are no other point sources. Keeping the explicit field follows the
user's request to store the earned total; it supersedes the derived-only
`perkPointsEarned` choice in the broader progression design for this slice.
Future Perk spending must introduce a separate spent/unspent calculation and
must not decrement `perkPointsEarned`.

On reading a profile without `progression`, normalize in memory to
`currentExp = totalExpEarned = max(0, profile.exp +
profile.sessionAggregate.exp)`, `highestLevel = levelFromExp(currentExp, 0)`,
`rebirthCount = 0`, and `perkPointsEarned = 0`. Reads do not write. The first
successful profile mutation persists the canonical shape. When `progression`
exists, it is authoritative: profile reads and Level outcomes must not add
legacy `exp` or `sessionAggregate.exp` a second time. Every profile writer,
including Settings and display-name updates, must preserve the canonical
progression fields; a stale whole-document save must not roll back a Rebirth
or accepted session award. Keep the top-level
`exp`, legacy baseline, and session aggregate for existing history and stats;
Rebirth does not erase them.

All EXP-awarding paths, including legacy lesson completion and receipt-gated
Home/Learning Path submissions, update `currentExp` and `totalExpEarned`
exactly once when an award is accepted. Receipt-gated paths keep their
existing `sessionAggregate.exp` for lifetime compatibility. Review and Weak
Jamo currently award zero EXP and do not alter progression. Level shown in
session outcomes and Profile uses the canonical state and the active
`rebirthCount`. New profiles start with all progression fields at zero except
`highestLevel = 1`.

## Rebirth command

Use a dedicated application use case through a repository interface; the UI
never writes IndexedDB or Firestore directly. The command receives a stable,
client-generated operation ID. It must atomically read the current profile,
check the operation ID, verify `levelFromExp(currentExp, rebirthCount) >= 100`,
and commit the transition with an immutable `RebirthRecord`:

```ts
type RebirthRecord = {
  id: string
  rebirthNumber: number
  levelAtRebirth: number
  expAtRebirth: number
  createdAt: Date
}
```

The record's `id` is the idempotency key. A retry with the same ID returns
the committed result, including its original Rebirth number, without another
reset or point. Two different requests racing against the same eligible
cycle cannot both succeed: the second sees Level 1 after the first commits
and returns an ineligible result. The operation sets `currentExp = 0`,
increments `rebirthCount` and `perkPointsEarned` by one, and retains
`totalExpEarned` and `highestLevel` (updating the peak from the pre-Rebirth
Level if needed). Level and Rank are derived; Rank becomes Normal once its
separate model exists. The operation preserves settings, lifetime/daily/item
stats, Lesson/Course Progress, ReviewItems, LearningSession history, and
achievements. It does not rewrite historical EXP or timestamps.

There is no upper Level cutoff. A learner may keep earning EXP beyond Level
100 and Rebirth later; `expAtRebirth` records the full cycle EXP at that time.
No Rebirth happens on reaching Level 100 automatically.

## Persistence and ordering

Guest: update the profile and insert the record in one IndexedDB transaction;
store records by `${userId}:${operationId}`. Account: use one Firestore
transaction for `users/{userId}` and
`users/{userId}/rebirths/{operationId}`. Rules permit the owner to create and
read Rebirth records, but deny updates and deletes. The transactional read and write are required because a
read-then-save through the existing profile repository can lose a concurrent
session award or allow two Rebirths. The operation's ID is retained by the
client until the outcome is known, including after a network retry.

Session submissions and Rebirth serialize through the same canonical profile
state. A session receipt accepted before Rebirth contributes to the old
cycle; one accepted after Rebirth contributes to the new cycle, even if
typing started earlier. A duplicate receipt never awards EXP again. A Home
outbox job remains queued until its submission is accepted, and a retry may
arrive after Rebirth; it follows this acceptance-order rule. Profile Level
must never be recomputed from the lifetime `sessionAggregate.exp` after a
Rebirth. The Profile confirmation explains that pending results may arrive
later and add EXP to the new cycle.

## Guest-to-account migration

Include Guest Rebirth records in the migration snapshot and union them by
operation ID with Cloud records. Preserve the existing receipt-gated merge
for LearningSessions and lifetime totals; do not add Guest and Cloud profile
totals blindly. An empty Cloud learner means one with no accepted activity
and no Rebirth records, even if sign-in already created a default profile;
take the Guest cycle state in that case. For an
existing Cloud learner, keep Cloud `currentExp` if either side has rebirthed;
otherwise unmatched Guest session awards may increase Cloud cycle EXP as
they do today. Set merged `rebirthCount` and `perkPointsEarned` to the number
of unique Rebirth records, and `highestLevel` to the larger historical peak.
The terminal migration marker is written only after records and session
receipts have migrated. Retrying migration cannot duplicate Rebirths or
Perk Points.

## Profile interaction

The Profile loader returns Level, progress within the Level, Rebirth Count,
and earned Perk Points from the canonical progression state. Show the two
new totals at every Level. Show an enabled `Rebirth` button only at Level
100+. The confirmation dialog states the current Level and cycle EXP that
will reset, the one point that will be earned, and the progress/statistics
that remain. Cancel makes no write. Confirm submits the operation ID through
a route action, disables repeated submission while pending, and revalidates
the Profile on success. If another tab or device already rebirthed, show the
ineligible result and refresh the displayed state. For a transient error,
retain the operation ID for retry and show a recoverable error message.

## Verification and documentation

Focused automated coverage is required for the normalization boundary,
Level 99/100 eligibility, Level above 100, unchanged lifetime data,
one-point award, same-ID retry, concurrent distinct IDs, session submission
on either side of Rebirth, delayed Home outbox submission, Guest and Firestore
transactions, and Guest-to-account migration with and without a Cloud
Rebirth. Firestore Rules tests cover access to the new subcollection. Do not
add UI-only visual tests; the user checks the dialog and layout manually at
mobile and desktop widths. Run focused tests for changed logic and adapters;
the full test suite remains a user-local follow-up under `AGENTS.md`.

Implementation updates `docs/DOMAIN-MODEL.md`, `docs/DECISIONS.md`,
`docs/AUTH-AND-PERSISTENCE.md`, and `docs/PROGRESS.md` with the adopted
schema and actual shipped status. This design document alone does not mark
Rebirth as implemented.

## Security boundary

The current Firestore rules permit an authenticated owner to write their
profile directly. The transaction protects ordinary clients from duplicate
or racing Rebirths, but owner-only rules cannot make the client-calculated
Level tamper-proof. Server-authoritative progression would require a separate
trusted write boundary and is outside this slice; the implementation must not
describe this flow as resistant to a modified client.
