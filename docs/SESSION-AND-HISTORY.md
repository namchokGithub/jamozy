# Session and History Architecture

Historical activity architecture. Lesson and Review now implement the
checkpoint/receipt boundary described here; other modes and history read/UI
remain target work.

## Boundaries

| Concept | Question answered | Role |
| --- | --- | --- |
| `LearningSession` | What happened in this practice activity? | immutable historical record |
| learner state | Where is the learner now? | current `LessonProgress`, `VocabularyProgress`, `JamoStat`, `ReviewItem`, and `DailyQuestProgress` |
| `UserStats` | What are the lifetime aggregates? | cheap aggregate snapshot |
| Player Stats | What did the learner do per day/month, and what are the streaks and records? | `playerStats` on the profile plus `dailyStats`/`monthlyStats` docs ([[DEC-049]]) |

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
        |      ├─ Player Stats (playerStats, dailyStats, monthlyStats)
        |      ├─ VocabularyProgress / JamoStat
        |      └─ ReviewItem where applicable
        |
        +--> mode-specific current state
        |      ├─ LessonProgress for Learning Path
        |      └─ DailyQuestProgress for Daily Quest
        |
        +--> LearningSession history record
```

All effects above belong to one logical submission. Lesson and Review use a
receipt keyed by `sessionId`: Guest storage uses one IndexedDB transaction and
authenticated storage uses one Firestore transaction. Other modes must adopt
the same checkpoint boundary when implemented.

No record is written per keystroke. MVP history contains submitted/completed
sessions only; abandoned or incomplete sessions are not persisted unless a
future product decision requires them.

## Home sessions

A completed Home exercise is a persistence checkpoint: it updates the lesson's
`Progress.completedExerciseIds` and `homePartialResult`, never a
`LearningSession` ([[DEC-043]]). When the IDs first cover every exercise,
one `{ mode: 'home' }` session is submitted whose `id` is the partial
result's `submissionId`, so a retried submission cannot grant EXP twice. A
full shuffled session of an already-completed lesson submits a replay session
with a new ID; an abandoned session submits nothing. Every Home write goes
through a durable local outbox and is retried in the background. The local
resume pointer `{ unitId, lessonId }` is UI state, not history.

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

Day and month totals are persisted as `dailyStats/{YYYY-MM-DD}` and
`monthlyStats/{YYYY-MM}` ([[DEC-049]]).

- They are written in the same receipt-gated transaction as the session, from
  the session's fixed `localDate`.
- A Week view reads 7 day docs, and a Year view reads 12 month docs.
- They are derived counters, not history: `LearningSession` stays the record of
  what happened.
- Sessions submitted before DEC-049 are not backfilled.

Do not add weekly or yearly docs, analytics schemas, or event pipelines until
real query or cost requirements justify them.

Retries are separate historical activities and may create their own
LearningSession. Their EXP and curriculum effects remain governed by the
existing mode-specific rules; history only records what happened.
