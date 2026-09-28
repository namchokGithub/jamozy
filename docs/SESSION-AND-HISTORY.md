# Session and History Architecture

Target architecture for historical learning activity. This document separates
what happened in one submitted practice activity from current learner state and
lifetime aggregates. It is a documentation design, not an implementation
claim.

## Boundaries

| Concept | Question answered | Role |
| --- | --- | --- |
| `LearningSession` | What happened in this practice activity? | immutable historical record |
| learner state | Where is the learner now? | current `LessonProgress`, `VocabularyProgress`, `JamoStat`, `ReviewItem`, and `DailyQuestProgress` |
| `UserStats` | What are the lifetime aggregates? | cheap aggregate snapshot |

`LearningSession` is not live typing state, a source of truth for current
learner state, a reward decision, or a progression mechanism. Live typing data
remains client-side until submission.

## Lifecycle and shared aggregation

```text
Active typing session
        |
        v
Submitted Session Result
        |
        +--> shared learner-state aggregation
        |      ├─ UserStats
        |      ├─ VocabularyProgress / JamoStat
        |      └─ ReviewItem where applicable
        |
        +--> mode-specific current state
        |      ├─ LessonProgress for Learning Path
        |      └─ DailyQuestProgress for Daily Quest
        |
        +--> LearningSession history record
```

All effects above belong to one logical submission. A submitted session must
have logical exactly-once effects across its `LearningSession` record and
aggregate learner-state updates. The concrete idempotency/atomicity mechanism
(for example a transaction, receipt, or another persistence-specific design)
is intentionally deferred to implementation.

No record is written per keystroke. MVP history contains submitted/completed
sessions only; abandoned or incomplete sessions are not persisted unless a
future product decision requires them.

## Identity and retry behavior

Create `sessionId` when the active session starts. Reuse that ID if the same
logical submission is retried after a failure, so it cannot create duplicate
history or aggregate effects. Starting a real replay or a new practice session
creates a new ID, even when it uses the same lesson or vocabulary.

For authenticated users, the ID is the `learningSessions` document ID. For a
Guest, the equivalent IndexedDB record uses the same ID. Guest-to-account
migration preserves that logical ID and must not recreate records.

## LearningSession model

One shared `LearningSession` model serves every applicable learning mode. It
uses a discriminated `LearningSessionContext`, rather than unrelated nullable
source fields:

```ts
type LearningSessionContext =
  | { mode: 'learning-path'; lessonId: string }
  | { mode: 'daily-quest'; dateKey: string }
  | { mode: 'topic'; topicId: string }
  | { mode: 'keyboard-position'; positionId: string }
  | { mode: 'review' }
  | { mode: 'random' };

type LearningSession = {
  id: string;
  context: LearningSessionContext;
  startedAt: Date;
  completedAt: Date;
  durationSeconds: number;
  exercisesAttempted: number;
  acceptedKeystrokes: number;
  rejectedKeystrokes: number;
  expGained: number;
};
```

`accuracy` and `speedWpm` are derived from the raw counters and duration:

```text
accuracy = acceptedKeystrokes / (acceptedKeystrokes + rejectedKeystrokes) × 100
speedWpm = (acceptedKeystrokes / 5) / (durationSeconds / 60)
```

Either derived value is `0` when its denominator is zero. The five-keystrokes
per-word convention matches `UserStats`. Do not persist derived values, full
exercise snapshots, raw `MistakeEvent` arrays, individual keystrokes, or a
full JamoStat map in MVP.

## Persistence and retention

| Learner mode | Persistence | Retention |
| --- | --- | --- |
| Guest | IndexedDB equivalent of `learningSessions` | part of the existing 90-day guest inactivity retention policy |
| Authenticated | `users/{userId}/learningSessions/{sessionId}` in Firestore | no history retention/deletion policy is decided yet |

Guest and authenticated learners share exactly the same session-history
semantics. Authentication changes only the adapter and retention policy.

## History, Summary, and Analytics

History is a future read/query over `LearningSession` records. It may show a
session's context, duration, derived accuracy/WPM, and EXP without rebuilding
activity from `UserStats`.

Future Summary may initially aggregate sessions by day, week, or month for
counts, typing time, and trends. Do not add persisted DailySummary or
WeeklySummary documents, caching, analytics schemas, or event pipelines until
real query/cost requirements justify them.

Retries are separate historical activities and may create their own
LearningSession. Their EXP and curriculum effects remain governed by the
existing mode-specific rules; history only records what happened.
