# Authentication and Persistence

Target architecture for learner identity, persistence selection, and the future
Guest-to-account migration. This document supersedes Firebase Anonymous Auth as
the target model. The current Anonymous Auth / Firestore implementation is a
legacy implementation until the planned migration is built.

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
and profile. `localStorage` may hold only small UI/session hints where
appropriate.

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

After Email/password or Google authentication succeeds, the future application
use case `MigrateGuestDataToAccount` moves data across the repository boundary:

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
idempotent, retry-safe, and non-destructive. A failed or interrupted attempt
must retain the local Guest data. Local data may be marked migrated and later
cleaned up only after migration succeeds; it must never be deleted first.

An existing cloud account is a merge scenario, not an empty target. A migration
must not replace cloud learner state wholesale with a Guest snapshot. A future
implementation must preserve the deterministic identities already defined for
Progress, VocabularyProgress, JamoStats, DailyQuestProgress, ReviewItems, and
LearningSessions.

### Minimum merge principles

- Preserve completed Learning Path work from either persistence target.
- Combine statistics from raw counters rather than stored averages.
- Never award EXP twice because data was migrated.
- Never create duplicate Daily Quest rewards.
- Never create duplicate vocabulary-backed ReviewItems.
- Preserve a Guest LearningSession ID when it is migrated.
- Retain local Guest data until the migration has succeeded.

## Unresolved migration policy

Exact field-level merge formulas are deliberately not decided. Implementation
must request a separate product decision before choosing how to combine or
prefer conflicting values for EXP, lesson/stat counters, ReviewItem scheduling,
DailyQuestProgress, settings, or best-result fields. It must not silently pick
sum, max, latest, or overwrite behavior.

## Implementation status

This is a documentation-only target design. It does not implement IndexedDB
repositories, Email/password authentication, Google Sign-In, migration, a
cleanup worker, Firebase configuration changes, or Firestore rule changes.
Those tasks are tracked in `docs/PROGRESS.md`.

## Historical implementation

Firebase Anonymous Auth and its Firestore-only persistence path remain
historical/current implementation records in DEC-001, DEC-015, DEC-016, and
older implementation plans. They are not the target architecture. DEC-027
supersedes DEC-001 for learner identity and persistence; a later implementation
will replace or retire the related legacy wiring safely.
