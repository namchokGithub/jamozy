# Player Progression and Statistics Models — Design

## Goal

Add a coherent domain and persistence foundation for the progression and
statistics concepts in `docs/LEVELING.md`: lifetime and daily statistics,
learning/item statistics, personalized review candidates, rebirth state, rank
and badge definitions, perks, owned user perks, and the learner's current rank.
All persisted learner state must work for both Guest IndexedDB and authenticated
Firestore users. This spec defines models and their data boundaries; it does
not authorize UI work or implementation of every perk effect.

## Current state

- `UserProfile` stores `exp` and a small legacy `UserStats` snapshot.
- `SessionAggregate` tracks a subset of raw lifetime counters.
- `LearningSession` is the submitted-activity history and supports exactly-once
  aggregation for Lesson and Review.
- `VocabularyProgress`, `JamoStat`, and `DailyQuestProgress` have target schemas
  in `DOMAIN-MODEL.md`, but their application persistence is not implemented.
- Guest persistence uses versioned IndexedDB object stores; Firebase learner
  state uses per-user subcollections and the shared `users/{userId}` profile.
- The current application still uses the former flat level formula. This
  design adopts the curve in `LEVELING.md`; implementation updates DEC-006,
  DEC-024, DEC-045, `DOMAIN-MODEL.md`, and the profile read model together.

## Scope

In scope:

- Define schema boundaries and derived-versus-persisted fields for the concepts
  above.
- Add domain models, repository interfaces, use cases, and local/Firebase
  adapters for persisted learner state, including Guest-to-account migration
  and exactly-once session aggregation.
- Define static rank, badge, and perk catalogs as domain configuration rather
  than per-user persisted copies.
- Define Personalized Review as a derived recommendation from `VocabularyProgress`
  and `JamoStat`; recommendations themselves are not persisted.
- Preserve existing legacy profile values without fabricating unavailable
  historical detail.

Out of scope:

- UI, Profile presentation, rewards UI, achievements, or animation assets.
- Changing the accepted EXP award rules from DEC-045.
- Implementing all Perk gameplay effects, streak protection, or achievement
  logic. The owned-perk model and effect metadata are included so these can be
  implemented later through explicit use cases.
- Backfilling detailed daily/item statistics that cannot be recovered from
  existing aggregates or session records.

## Model design

### Progression state and rebirth

Add an embedded `ProgressionState` to `UserProfile`. Its `currentExp` is the
current rebirth cycle's EXP and is the input to `levelFromExp`. The existing
top-level `UserProfile.exp` remains a legacy baseline field for compatibility
with the session-foundation transition; it is not reset on Rebirth:

```ts
type ProgressionState = {
  currentExp: number;
  totalExpEarned: number;
  highestLevel: number;
  rebirthCount: number;
};
```

### Level curve

Use the `LEVELING.md` curve for the EXP required to advance from `level` to
`level + 1` within the current rebirth cycle:

```ts
function expRequiredForNextLevel(level: number, rebirthCount: number): number {
  const baseExp = 50 * level ** 1.2
  const rebirthMultiplier = 1 + 0.15 * rebirthCount
  const softCapMultiplier = level < 100
    ? 1
    : 3 ** (Math.floor((level - 100) / 10) + 1)

  return Math.round(baseExp * rebirthMultiplier * softCapMultiplier)
}
```

`currentExp` is total EXP earned in the current cycle, never “EXP remaining”.
`levelFromExp(currentExp, rebirthCount)` finds the highest level whose
cumulative required EXP is no greater than `currentExp`, beginning at Level 1.
`expIntoLevel` and `expToNextLevel` are derived for the profile progress bar;
neither is persisted. Level 100 remains playable and Rebirth remains optional.
At Level 100 and every ten levels after it, the soft-cap multiplier steps up
by a factor of three exactly as shown above. Rebirth resets `currentExp` and
the derived Level/Rank, then raises the next-cycle requirement through
`rebirthMultiplier`.

The existing flat `exp` total is normalized once into `currentExp` for users
who have not rebirthed. Existing historical totals are retained in
`totalExpEarned`; changing the curve recalculates their displayed Level from
the canonical progression state without rewriting session history.

### EXP reward configuration

Keep base rewards in static domain configuration. `ExpRewardDefinition` has
one definition for every supported activity/difficulty combination:

```ts
type ExpActivity = 'lesson' | 'lesson-replay' | 'review' | 'daily-quest'
type ExpDifficulty = 'easy' | 'medium' | 'hard'

type ExpRewardDefinition = {
  activity: ExpActivity
  difficulty: ExpDifficulty
  baseExp: number
}

const EXP_REWARD_DEFINITIONS: readonly ExpRewardDefinition[] = [
  { activity: 'lesson', difficulty: 'easy', baseExp: 15 },
  { activity: 'lesson', difficulty: 'medium', baseExp: 25 },
  { activity: 'lesson', difficulty: 'hard', baseExp: 30 },
  { activity: 'lesson-replay', difficulty: 'easy', baseExp: 3 },
  { activity: 'lesson-replay', difficulty: 'medium', baseExp: 5 },
  { activity: 'lesson-replay', difficulty: 'hard', baseExp: 10 },
  { activity: 'review', difficulty: 'easy', baseExp: 3 },
  { activity: 'review', difficulty: 'medium', baseExp: 5 },
  { activity: 'review', difficulty: 'hard', baseExp: 10 },
  { activity: 'daily-quest', difficulty: 'easy', baseExp: 5 },
  { activity: 'daily-quest', difficulty: 'medium', baseExp: 10 },
  { activity: 'daily-quest', difficulty: 'hard', baseExp: 15 },
]
```

The reward context maps first-completed Home exercises to `lesson`, a full
replay of Learning Path or Home exercises to `lesson-replay`, and Topic,
Keyboard Position, Random Practice, and Review items to `review`. A Daily
Quest item uses `daily-quest` even when it reuses vocabulary from another mode.

The existing +5 EXP for a perfect LessonExercise is a separate static reward
definition because it is not difficulty-specific. The reward engine resolves
a base definition for every eligible exercise, gathers eligible flat and
percentage perk effects, then applies
`round((baseExp + flatBonus) * (1 + percentageBonus))`. It writes the final
exercise rewards and their summed session total in the receipt so a retry
cannot recalculate them from changed perk levels or definitions. A replay
only awards these per-exercise rewards after the full shuffled lesson session
completes.

`perkPointsEarned` is derived from `rebirthCount` (one point per rebirth),
and unspent points are `rebirthCount - sum(owned perk levels)`. Do not persist
these duplicate values. On profile decode, a legacy profile without
`progression` starts with `currentExp = totalExpEarned = exp +
sessionAggregate.exp`, `highestLevel = levelFromExp(currentExp)`,
`rebirthCount = 0`. When canonical
`progression` exists, profile reads use it and do not add the legacy `exp` or
`sessionAggregate.exp` again. The next successful profile write persists the
normalized shape; reads do not write. New rewards update `currentExp` and
`totalExpEarned`; `sessionAggregate.exp` becomes a legacy fallback only.

Persist an immutable `RebirthRecord` per rebirth:

```ts
type RebirthRecord = {
  id: string;
  rebirthNumber: number;
  levelAtRebirth: number;
  expAtRebirth: number;
  createdAt: Date;
};
```

`id` is a client-generated
operation ID reused on retry; `rebirthNumber` is the sequence number in that
learner profile. Rebirth is a use case available at Level 100+: it sets
`currentExp` to zero,
increments `rebirthCount`, retains `totalExpEarned`, lifetime/daily/item stats,
Learning Path progress, and owned perk levels, and returns the learner to
Normal rank through the derived rank rule. The record is an audit/history
entry and its operation ID is the idempotency key, so a retry returns the
original outcome without another reset or perk point. `highestLevel` retains
the historical peak; `highestRank` is derived from it.

### Lifetime statistics

Expand `UserStats` as the persisted lifetime aggregate embedded in
`UserProfile.stats`; keep the name to avoid an unnecessary second overlapping
aggregate. Persist raw counters and records needed for maxima:

```ts
type UserStats = {
  exercisesAttempted: number;
  lessonsCompleted: number;       // aggregate only; profile display still derives from Progress
  lessonsReplayed: number;
  reviewsCompleted: number;
  perfectLessons: number;
  perfectExercises: number;
  totalAcceptedKeystrokes: number;
  totalRejectedKeystrokes: number;
  charactersTyped: number;
  wordsPracticed: number;
  sentencesPracticed: number;
  bestAccuracy: number;
  bestWpm: number;
  totalTypingTimeSeconds: number;
  totalLearningTimeSeconds: number;
  longestSessionSeconds: number;
  currentPerfectStreak: number;
  longestPerfectStreak: number;
};
```

The existing six-field `UserStats` shape becomes `LegacyUserStats` inside
`legacyBaseline`; canonical `UserStats` uses raw counters and derives
`averageAccuracy = accepted / (accepted + rejected) × 100` and
`averageWpm = (accepted / 5) / (typingSeconds / 60)` whenever their
denominators are known. Profile display continues deriving completed lessons
from `LessonProgress`, even though the aggregate also supports lifetime
statistics.
`totalExpEarned`, `highestLevel`, derived highest rank, and perk points belong to
`ProgressionState`, not `UserStats`. Active days and current/longest streak,
most EXP in a day/month, and most lessons in a day are derived from `DailyStats`.
Total keystrokes derive from accepted plus rejected keystrokes; unique lessons
derive from completed `LessonProgress` records. A perfect-exercise streak
advances on each submitted 100%-accurate exercise and resets on a submitted
imperfect exercise, across session boundaries. A Perfect Lesson means every
exercise in its submitted lesson completion was perfect. `reviewsCompleted`
counts reviewed items; total lesson completions are unique completions plus
replays.

`LifetimeStats` is a read model that composes `ProgressionState`, `UserStats`,
completed `LessonProgress`, and `DailyStats`. It exposes the derived values
listed above plus `highestRank` (from `highestLevel`), without persisting a
second lifetime document. This gives Profile/analytics one stable domain
result while keeping each input's source of truth explicit.

Existing `legacyBaseline` and `sessionAggregate` remain read-compatible during
normalization. Move the current six-field `stats` value into the immutable
legacy baseline when needed, map safely recoverable `sessionAggregate` raw
counters into canonical `UserStats` once, and stop adding that aggregate after
canonical stats exist. Legacy averages stay presentation-only where raw
denominators are unavailable. Newly captured stats begin at implementation
time; no historical values are guessed. The session receipt's stored
aggregate/effects are extended so each accepted submission carries the exact
raw stat deltas needed for one-time updates; do not reconstruct them from
LearningSession history that lacks those details.

### Daily statistics

Persist one `DailyStats` record per learner and local `dateKey`:

```ts
type DailyStats = {
  dateKey: string;
  expEarned: number;
  lessonsCompleted: number;
  lessonsReplayed: number;
  reviewsCompleted: number;
  perfectLessons: number;
  correctKeystrokes: number;
  incorrectKeystrokes: number;
  charactersTyped: number;
  wordsPracticed: number;
  sentencesPracticed: number;
  typingSeconds: number;
  learningSeconds: number;
  isActiveDay: boolean;
};
```

Path: `users/{userId}/dailyStats/{dateKey}` in Firestore; equivalent
`dailyStats` IndexedDB store keyed by `${userId}:${dateKey}`. `dateKey` uses
the learner's local calendar day at activity start, in `YYYY-MM-DD` form.
Apply the same day boundary to `DailyQuestProgress.dateKey`.
Daily `correctKeystrokes` and `incorrectKeystrokes` are the submitted
accepted and rejected keyboard counts respectively.
The date is captured in active session/checkpoint state and reused on retry so
a timezone change cannot split one logical submission across two days. A
later decision may replace local-day semantics with an explicit profile
timezone.

DailyStats records submitted activities. For a Home lesson completed across
multiple visits, `homePartialResult.startedAtMs` defines the activity's
`dateKey`; its first-completion counters and EXP are credited once when the
lesson finally completes. Incomplete Home exercise checkpoints do not create
DailyStats rows.

### Learning and item statistics

Implement the existing target models from `DOMAIN-MODEL.md`:

- `VocabularyProgress`, keyed by `vocabularyId`, stores encounter/practice
  timestamps, completed exercise count, and accepted/rejected keystrokes.
- `JamoStat`, keyed by expected Korean jamo, stores first/latest practice
  timestamps and accepted/rejected keystrokes.
- `LessonProgress` already stores per-lesson attempts, best accuracy, and best
  WPM. A derived `LessonItemStats` read model uses it for Best Accuracy Lesson
  and Most Replayed Lesson. It does not create another lesson-stat collection.

`LessonItemStats` exposes `{ lessonId, attempts, replays, bestAccuracy,
bestWpm }`, where `replays` comes from submitted lesson history and does not
assume every recorded attempt completed the lesson.

Accuracy and mistake rate are derived; do not persist mastery, strength, or
weakness labels. Most Practiced/Mistyped Jamo and Word are rankings over the
raw item counters. `LearningSession` submission is the aggregation boundary.

### Personalized Review

Use an in-memory `PersonalizedReviewSuggestion` model, not a persisted entity:

```ts
type PersonalizedReviewSuggestion = {
  targetType: 'vocabulary' | 'jamo';
  targetId: string;
  acceptedKeystrokes: number;
  rejectedKeystrokes: number;
  mistakeRate: number;
};
```

The initial selector returns the 10 highest mistake-rate targets with at least
5 total attempts, ordered by mistake rate descending and then stable target ID.
It is a recommendation list only: it does not create or mutate `ReviewItem`s.
Starting a targeted practice session from suggestions is future UI/behavior;
this scope supplies the recommendation read model and use case.

### Rank, badge, and user rank

`RankDefinition` and `BadgeDefinition` are static domain catalogs; do not
create Firestore collections for them. Rank boundaries and display names,
colors, and effects come from `LEVELING.md`. `RankDefinition` contains a stable
ID, name, minimum Level, and optional maximum Level. `BadgeDefinition` contains
its rank ID, Slime color palette, and visual effect (`none`, `glow`, `glow-plus`,
`sparkle`, or `twinkle`). Current rank derives from current Level; historical
highest rank derives from `highestLevel`.

Interpret `Range` in the LEVELING.md heading and the requested “User Range” as
the Rank band. `UserRank` is a derived value:

```ts
type UserRank = {
  rankId: RankId;
  level: number;
  rebirthCount: number;
  label: string; // e.g. "Epic R3"
};
```

It is computed from `levelFromExp(currentExp)`, `rebirthCount`, and the static
rank catalog; no separate user-rank record is persisted. `BadgeDefinition` maps a
rank to its slime presentation metadata; equipped/collected badges are not in
the current requirements and remain out of scope.

### Perk and UserPerk

`PerkDefinition` is static domain configuration. Every effect carries its
trigger, scope, and condition so reward and typing use cases can determine
whether it applies without name-based special cases:

```ts
type PerkTrigger =
  | 'exercise-started'
  | 'exercise-mistake'
  | 'exercise-completed'
  | 'activity-completed'
  | 'lesson-completed'
  | 'review-completed'
  | 'daily-activity-completed'
  | 'daily-streak-evaluated'

type PerkScope =
  | 'any'
  | 'first-exercise-in-lesson'
  | 'first-lesson-completion'
  | 'lesson-replay'
  | 'perfect-lesson'
  | 'perfect-review'
  | 'daily-quest'
  | 'first-lesson-after-absence'
  | 'perfect-exercise-streak'

type PerkCondition =
  | { type: 'always' }
  | { type: 'first-mistake-in-exercise' }
  | { type: 'first-mistake-in-lesson' }
  | { type: 'first-exercise-in-lesson' }
  | { type: 'first-lesson-completion' }
  | { type: 'lesson-replay' }
  | { type: 'perfect-lesson' }
  | { type: 'perfect-review' }
  | { type: 'daily-quest' }
  | { type: 'inactive-days-at-least'; days: number }
  | { type: 'perfect-exercise-streak-at-least'; count: number }
  | { type: 'daily-streak-would-break' }

type PerkEffect =
  | { type: 'percentage-exp'; valuePerLevel: number }
  | { type: 'flat-exp'; valuePerLevel: number }
  | { type: 'mistake-protection'; protectedMistakesPerLevel: number }
  | { type: 'perfect-combo-protection'; protectedMistakesPerLevel: number }
  | { type: 'daily-streak-protection'; protectedDays: number }
  | { type: 'accuracy-mistake-ignore'; ignoredMistakesPerLevel: number }

type PerkDefinition = {
  id: PerkId
  name: string
  maxLevel: number
  trigger: PerkTrigger
  scope: PerkScope
  condition: PerkCondition
  effect: PerkEffect
}
```

The static catalog maps all 15 LEVELING.md perks as follows:

| Perk | Trigger / scope / condition | Effect per level |
| --- | --- | --- |
| Second Chance | `exercise-mistake` / `any` / first mistake in exercise | Ignore 1 mistake |
| EXP Boost | `activity-completed` / `any` / always | +2% EXP |
| Review Bonus | `review-completed` / `any` / always | +5% EXP |
| Perfect Bonus | `lesson-completed` / `perfect-lesson` / perfect lesson | +2 flat EXP |
| Daily Boost | `daily-activity-completed` / `daily-quest` / daily quest | +5% EXP |
| Combo Keeper | exercise mistake / `any` / first mistake in lesson | Protect perfect combo from 1 mistake |
| Warm Up | `exercise-started` / first exercise in lesson / first exercise | Protect 1 mistake |
| Quick Learner | `lesson-completed` / first lesson completion / first completion | +5% EXP |
| Practice Pays | `lesson-completed` / lesson replay / replay | +1 flat EXP per replayed exercise |
| Focused Review | `review-completed` / perfect review / perfect review | +3 flat EXP |
| Streak Guard | `daily-streak-evaluated` / `any` / streak would break | Protect 1 missed day |
| Comeback | `lesson-completed` / first lesson after absence / inactive ≥3 days | +10% EXP |
| Precision | `exercise-completed` / perfect exercise streak / streak ≥5 | +2 flat EXP |
| Steady Hand | `lesson-completed` / `any` / always | Ignore 1 mistake in accuracy |
| Explorer | `lesson-completed` / first lesson completion / first completion | +3 flat EXP |

`Quick Learner` and `Explorer` share the same first-completion condition but
have separate effects. `Second Chance`, `Warm Up`, `Combo Keeper`, and
`Steady Hand` affect distinct evaluation stages, so the future implementation
must preserve their ordering in the submitted result before it calculates
Perfect status, accuracy, review creation, or EXP.

Persist only perks
the learner owns:

```ts
type UserPerk = {
  perkId: PerkId;
  level: number;
  acquiredAt: Date;
  updatedAt: Date;
};
```

Authenticated paths: `users/{userId}/perks/{perkId}` and
`users/{userId}/rebirths/{rebirthId}`. Guest stores: `userPerks` keyed by
`${userId}:${perkId}` and `rebirths` keyed by `${userId}:${rebirthId}`.
Each perk level costs one available perk point; levels are capped by the
catalog max. Perk levels and unspent points survive rebirth. The write use case
validates ownership, max-level, and available-point constraints in one atomic
profile/perk update, so concurrent purchases cannot spend one point twice.
This model does not itself turn on gameplay effects; reward and typing use
cases consume only effects explicitly implemented later.

## Submission, transaction, and migration boundaries

Extend the existing exactly-once submission boundary so one accepted
`sessionId` applies one receipt-gated set of deltas to session history,
`UserProfile` progression and lifetime stats, affected `DailyStats`,
`VocabularyProgress`, `JamoStat`, `ReviewItem`, and mode-specific progress.
Guest writes use one IndexedDB transaction. Firebase uses a receipt-authority
transaction plus bounded, idempotent effects keyed by the same session ID if
the number of affected documents exceeds a safe transaction size. Retries
with the same session ID produce no duplicate counters, EXP, or daily entries.

Guest-to-account migration unions `RebirthRecord`s by operation ID and derives
`rebirthCount` from the unique records. `UserPerk` keeps the higher owned level
per perk ID. Additive lifetime and daily counters come only from Guest session
effects that do not already have a Cloud receipt; profile and daily snapshots
are never simply added. The existing Cloud legacy baseline wins where both
sides have one ([[DEC-031]]). `totalExpEarned` grows by the EXP from unmatched
Guest sessions; `highestLevel` keeps the maximum. When neither side has
rebirthed, unmatched Guest session EXP also increases current-cycle EXP as in
the existing merge. If either side has rebirthed, an existing Cloud account
keeps its current-cycle EXP; a newly created account takes the Guest value.
This preserves the Cloud cycle rather than rolling it back through a Guest
merge. Missing legacy fields normalize to safe zero/default values.

## Components

- `domain/models`: expanded `user-profile.ts`; add progression and curve
  functions, EXP reward configuration/calculation, rebirth, daily stats,
  vocabulary progress, jamo stat, personalized review suggestion, rank/badge,
  perk, user perk, and derived user rank models.
- `domain/repositories`: interfaces for daily stats, vocabulary progress,
  jamo stats, rebirth records, and user perks; profile repository remains owner of embedded
  progression and lifetime stats.
- `application`: reward calculation from an immutable submission context,
  exactly-once shared submitted-session aggregation, daily stats reads,
  personalized-review generation, rebirth, and perk-level-up use cases.
- `infrastructure/local`: stores/adapters and atomic effects for Guest.
- `infrastructure/firebase`: subcollection adapters and atomic effects for
  authenticated users.
- Guest-to-account migration: include all new persisted records and merge
  semantics above.
- `docs/DOMAIN-MODEL.md`, `docs/AUTH-AND-PERSISTENCE.md`, `docs/SESSION-AND-HISTORY.md`,
  `docs/PROGRESS.md`, and `docs/DECISIONS.md`: update target schemas, status,
  transaction semantics, and accepted boundaries as implementation lands.

## Risks and decisions to verify in this spec review

- Daily boundaries use the device-local day at first submission. This is
  simple and deterministic per receipt, but cross-device timezone differences
  can place activity on different days.
- A Home lesson can span days; this design credits its first-completion
  activity to the first visit's day when the lesson finally completes.
- Personalized Review uses at least five attempts and returns the top ten
  highest mistake rates; these are new product defaults not present in the
  source document.
- Personalized Review returns suggestions; it does not automatically create
  `ReviewItem`s. The `Generate Review` sketch in LEVELING.md could also mean
  automatic queue insertion, so that behavior needs confirmation.
- The 1-point-per-perk-level price is inferred from one Perk Point per Rebirth;
  there is no separate cost table in LEVELING.md.
- The Level Curve is now adopted from LEVELING.md. It supersedes the flat
  100-EXP curve recorded in DEC-006/DEC-024; implementation must update those
  decisions and migrate the profile presentation in the same change.
- Character, word, sentence, and learning-time counting need stable source
  semantics; the first implementation should derive counts from typed content
  metadata and submitted durations, and record them only when the source can
  classify them reliably.
- The perfect-exercise streak uses submitted raw accuracy until a future
  decision defines how accuracy-changing perks affect Perfect status.
- `UserRank` is derived and `Range` is treated as a typo for Rank; no separate
  persisted `UserRange` is proposed.
- Existing Cloud current-cycle EXP wins when Guest and Cloud rebirth histories
  both exist. Unique Guest rewards still count toward lifetime EXP; this
  prevents a migration from undoing the active Cloud cycle.
- Detailed historical daily and item stats cannot be reconstructed from the
  current partial aggregate. Existing legacy baselines must remain intact.
- Firestore atomicity across a session record plus many item-stat documents
  may exceed a transaction's practical write limit; the plan must keep the
  session receipt authoritative and define safe bounded chunking if needed.

## Verification strategy

The implementation plan should add domain tests for schema validation,
rank/level derivation, rebirth boundaries, perk point accounting, daily date
keys, item aggregation, personalized-review ordering, merge idempotency, and
legacy normalization. Repository tests must cover both Guest IndexedDB and
Firebase adapters, including retrying a submitted session and migrating the
same source twice without duplicate rewards or counters. UI-only tests are
out of scope unless the UI is explicitly requested later.
