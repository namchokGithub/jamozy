# Authentication and Persistence

Target architecture for learner identity, persistence selection, and
Guest-to-account migration. This document supersedes Firebase Anonymous Auth as
the target model. The current Anonymous Auth / Firestore implementation is
historical legacy context.

Authentication selects persistence; it does not change learning behavior.
Learning Path, Practice Modes, Review, shared learner state, and their use
cases use the same domain models for every learner.

## Learner modes

| Mode | Identity | Persistence | Access |
| --- | --- | --- | --- |
| Guest | locally generated `guestId` | IndexedDB on this device | all current learning features |
| Authenticated | Firebase Auth UID | Firestore | the same learning features, plus future account-oriented history, summaries, and analytics |

A Guest must supply a player-facing `displayName` before normal play. The name
is not identity and must not be used as a document key. Guest uses no Firebase
Authentication. An authenticated account supports Email/password and Google
Sign-In; the provider does not change learner-data rules.

## Session and profile boundaries

`UserSession` represents the active persistence mode, separately from the
learner profile:

```ts
type UserSession =
  | { kind: 'guest'; userId: string }
  | { kind: 'authenticated'; userId: string };
```

Guest retention metadata is a local session record, not `UserProfile` data:

```ts
type GuestSession = {
  guestId: string;
  displayName: string;
  createdAt: Date;
  lastActiveAt: Date;
};
```

`UserProfile` is shared learner state. It contains `id`, `displayName`, EXP,
settings, stats, and audit timestamps; it does not contain `email`, provider
details, or `isGuest`. For an authenticated profile, `id` is the Firebase Auth
UID. For a Guest profile, it is the locally generated `guestId`.

See `docs/DOMAIN-MODEL.md` for the target profile and settings fields.

## Persistence boundary

Application use cases depend on repository interfaces, not on Firebase or
IndexedDB. Infrastructure provides repository implementations for the active
session:

```text
Application / Use Cases
        |
Repository Interfaces
        |
+---------------------------+---------------------------+
| Local Guest repositories  | Firebase repositories     |
| IndexedDB                 | Firestore                 |
+---------------------------+---------------------------+
```

React components must not copy IndexedDB records into Firestore. Content
repositories remain shared read access; learner-state repositories select the
local or Firebase adapter based on the session. IndexedDB, not `localStorage`,
is the primary local store for guest lesson progress, vocabulary progress,
review items, jamo stats, daily quests, learning-session history, user stats,
profile, and Player Stats day/month records (`dailyStats`, `monthlyStats`
stores, DB version 7). `localStorage` may hold only small UI/session hints
where appropriate. Each adapter stores `UserProfile.timezone` with its profile
(Guest: IndexedDB; account: Firestore); it is filled from the first submitted
session's device zone ([[DEC-049]]).

Because Guests do not authenticate with Firebase yet access the same learning
content, a future Firestore-rules implementation must permit the required
content reads without relying on Firebase Auth. This documentation pass does
not change or finalize those rules.

## Guest lifecycle and retention

A Guest session records a stable `guestId`, `displayName`, `createdAt`, and a
local-retention `lastActiveAt`. `lastActiveAt` changes on persisted guest
activity and defines expiry: guest data is eligible for cleanup after 90 days
since that activity, not 90 days after creation.

`UserProfile.updatedAt` remains an audit timestamp for profile mutations; it
must not be reused as `lastActiveAt`. Cleanup semantics are documented here,
but background cleanup machinery is not part of this design pass. A guest
record remains eligible for account migration until cleanup occurs.

## Guest-to-account migration

After Email/password or Google authentication succeeds, the application use
case `MigrateGuestDataToAccount` moves data across the repository boundary:

```text
Local Guest repositories
        |
        v
MigrateGuestDataToAccount
        |
        v
Firebase repositories
```

The use case—not a React component—owns orchestration. It is provider-neutral,
idempotent, retry-safe, and non-destructive. It stores a local IndexedDB
checkpoint keyed by `(guestId, uid)` and writes the terminal Cloud marker at
`users/{uid}/migrations/{guestId}` only after every session receipt succeeds.
A failed or interrupted attempt retains the local Guest data and is retried on
the next authenticated session. Cleanup is separately deferred: this feature
never deletes or makes Guest data unavailable.

An existing cloud account is a merge scenario, not an empty target. A migration
must not replace cloud learner state wholesale with a Guest snapshot. A future
implementation must preserve the deterministic identities already defined for
Progress, VocabularyProgress, JamoStats, DailyQuestProgress, ReviewItems, and
LearningSessions.

### Merge policy

The destination is the union of Guest and Cloud state under each record's
deterministic identity. A migration must be idempotent: repeating it produces
the same destination state and never duplicates a reward, aggregate, or
history record.

| Data | Merge rule |
| --- | --- |
| `LessonProgress` | Keep the furthest state: `completed` > `unlocked` > `missing`. |
| Home `completedExerciseIds` | Union ([[DEC-043]]). |
| Home `homePartialResult` | Drop it if either side is `completed`; otherwise keep Cloud's, or Guest's when Cloud has none. |
| EXP | Do not add Guest and Cloud totals directly. Aggregate only submitted sessions whose `sessionId` has not already contributed to the destination. |
| `UserStats` raw counters | Like EXP, aggregate only from sessions not already aggregated in the destination; derive averages from the resulting raw counters. |
| `ReviewItem` | Union by deterministic identity. Keep the state that makes review due sooner (the earlier `nextReviewAt`); preserve one item only. |
| `DailyQuestProgress` | Union by `dateKey`; `completed` and `expAwarded` are each true when either side is true. |
| Settings | Use the most recently updated values when trustworthy `updatedAt` values exist; otherwise prefer Cloud settings. |
| `displayName` | Prefer Cloud; use the Guest name only when the account has no name. |
| `bestAccuracy` / `bestWpm` | Keep the maximum value. |
| `LearningSession` | Union by the original `sessionId`; do not recreate a record during migration or retry. |
| Player Stats ([[DEC-049]]) | Never merge Guest `playerStats` or period docs directly. Re-apply each not-yet-migrated session outcome, oldest `completedAt` first, in its receipt transaction. A Guest session dated before the account's `lastActiveDate` adds to its day but leaves the streak. |
| `timezone` | Prefer Cloud; use the Guest zone only when the account has none. |

Local Guest data remains until migration succeeds; it must never be deleted
before a successful, durable Cloud write.

## Implementation status

Guest IndexedDB persistence plus Email/password and Google Sign-In now ship.
They select local or Firebase learner repositories through the active session.
Automatic Guest-to-account migration now ships for the entities present on this
branch: UserProfile, Progress, ReviewItem, LearningSession, and session
receipts. Lesson/Review LearningSession history, aggregate, and exactly-once
checkpoint persistence ship for both adapters. The `legacyBaseline` /
`sessionAggregate` profile compatibility layer remains intentionally in place;
it is not retired by a Guest migration. Cleanup, future-mode records, account
linking, and history UI remain deferred. Firebase Console provider configuration
and deployment of the checked-in Firestore rules remain user-owned. See
`docs/PROGRESS.md`.

## Historical implementation

Firebase Anonymous Auth and its Firestore-only persistence path remain
historical/current implementation records in DEC-001, DEC-015, DEC-016, and
older implementation plans. They are not the target architecture. DEC-027
supersedes DEC-001 for learner identity and persistence; a later implementation
will replace or retire the related legacy wiring safely.
