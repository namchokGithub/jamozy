# Learning Modes Architecture

This document defines Jamozy's target learning-mode architecture. It is a
documentation design, not an implementation claim; the current application and
Firestore data have not yet migrated to it.

## Layers

| Layer | Responsibility |
| --- | --- |
| Experience | Presents Daily Quest, Learning Path, and Practice Modes to learners. |
| Content | Reusable Courses, Units, Lessons, Exercises, Vocabulary, Topics, and keyboard metadata. |
| Learner state | Records learner-specific progress, statistics, review schedules, and quest state. |

Daily Quest, Topics, and Keyboard Position are experiences, never
`Course.type` variants. `Course → Unit → Lesson → LessonExercise` is the
structured Learning Path, plus one exception: the single `home` course that
Home plays ([[DEC-043]]). `Course.type` has only `learning` and `home`.

## Experiences

### Learning Path

The Learning Path uses global `Course.order → Unit.order → Lesson.order`.
Document IDs never determine curriculum order.

Lesson access is a soft product lock: a learner may open a future lesson after
a warning and choose to practice it. Completing that Learning Path lesson still
persists its `LessonProgress`; it is not a generic Practice Mode session.

The recommended lesson is the first lesson in global order that is not
completed: the contiguous completion frontier. When a Learning Path lesson is
completed, advance the frontier past any already-completed future lessons and
ensure the first remaining lesson is unlocked. Missing or merely unlocked
lessons stop the frontier.

Example: after `L1` completes, a learner may complete `L3` early while `L2` is
still missing. The recommendation remains `L2`. Completing `L2` skips the
already-completed `L3` and unlocks `L4`.

### Home

Home plays the single `home` course from a build-time static JSON export, so
opening Home never waits on Firestore ([[DEC-043]]). Units are categories;
each lesson shows distinct completed exercises out of its total, and a
completed lesson always shows full. Any unit or lesson may be opened; the
`home` course has no lock, frontier, or place in the Learning Path order.

A session shuffles all of the lesson's exercises once and plays each exactly
once; every new session, including after a refresh, reshuffles. At session
end Home moves to the next lesson, then the next unit, with a non-blocking
notice; after the last lesson it loops back to the first. A lesson completes when its exercises have each been completed at
least once, across sessions and devices. First completion grants the sum of
the difficulty-based first-completion rewards for its exercises, including
eligible perfect-exercise bonuses ([[DEC-045]]); a full session of an
already-completed lesson awards each replayed exercise by difficulty
([[DEC-046]]); an abandoned session
grants nothing. Completion is never
reset, and Home never creates ReviewItems. All Home persistence runs in the
background through a retrying local outbox.

### Practice Modes

Topic, Keyboard Position, Random Practice, Daily Quest, and Review select
shared content. They do not write `LessonProgress` and never unlock Learning
Path progression. They may update shared statistics, vocabulary progress,
jamo statistics, and review scheduling according to their rules.

Every submitted experience creates one `LearningSession` history record through
the shared submission boundary. That record describes the activity; it does not
control EXP, review scheduling, or Learning Path progression. See
`docs/SESSION-AND-HISTORY.md`.

Initial practice experiences are:

- Topics
- Keyboard Position

Weak Vocabulary, Random Practice, TOPIK, and Favorites remain future
experiences without dedicated persisted entities yet.

### Weak Jamo practice ([[DEC-051]])

Weak Jamo practice drills the learner's weakest key-level jamo. You start it
from `/review` and play it at `/review/weak-jamo`.

- **Targets:** up to 3 jamo from `learnerStats/jamo`, each with at least 20
  attempts and a mistake rate above 0. The highest rate comes first.
- **Content:** up to 10 exercises from the Home static export. Each one scores
  the sum of its target-jamo keys, weighted by each jamo's mistake rate.
  Exercises are drawn at random from the 30 highest scores, so the session reads
  no content from Firestore.
- **Grid:** `/review` also shows per-jamo accuracy. Tapping a red or yellow
  cell drills that jamo alone (`?jamo=`). Until a jamo ranks, the entry is
  locked and shows progress.
- **Recording:** each session is a `LearningSession` with context
  `{ mode: 'weak-jamo' }` and counts as `practicesCompleted` in Player Stats.
  It records jamo stats, never touches `ReviewItem` or `LessonProgress`, and
  awards no EXP until practice EXP ([[DEC-045]]) ships for every practice mode.

### Daily Quest

Daily Quest is a generated vocabulary session, not a Course, Unit, or Lesson.
It presents 10 vocabulary items and reuses the same set when reloaded on the
same day. It contributes to shared learner state and may update ReviewItems,
but never completes or unlocks a Learning Path lesson.

Daily Quest awards the sum of its completed items' difficulty-based rewards
at most once per quest ([[DEC-045]]). Its `dateKey` timezone policy is an
explicit pre-implementation decision; no timezone-handling design is fixed
here.

## Shared Content

### Topics

A Topic is metadata. Membership is held as `VocabularyEntry.topicIds`, so a
topic never owns copies of vocabulary. Topic displays derive counts from shared
`VocabularyProgress`: use `Practiced` or `Encountered` wording until mastery
has a defined rule.

Grammar categories such as verb, adjective, and noun should derive from
`VocabularyEntry.partOfSpeech` where possible rather than duplicate Topic
membership.

### Keyboard Position

Keyboard Position groups jamo through shared keyboard metadata (physical key
and row). It is only a filter/view over shared JamoStats, not a Course or a
separate jamo-progress system.

## Shared Learner State

### VocabularyProgress

VocabularyProgress is global history for one learner and one VocabularyEntry;
it is distinct from ReviewItem scheduling. Its MVP shape is deliberately
minimal:

```text
vocabularyId
firstEncounteredAt
lastPracticedAt
exercisesAttempted
acceptedKeystrokes
rejectedKeystrokes
```

Accuracy is derived from raw keystroke counters. Do not add mastery or
familiarity fields yet.

### JamoStats

JamoStats is shared across all experiences. Counters belong to the expected
jamo: correct input increments its accepted count; a rejected input increments
the rejected count of the jamo expected at that sequence position. Accuracy is
derived from those counters. It records first and latest submitted practice for
that expected jamo; no input is persisted per keystroke.

### ReviewItem

ReviewItem answers when an item is due again. It remains a shared Leitner
schedule, not general vocabulary mastery. Vocabulary-backed items use their
VocabularyEntry identity; no mode owns a separate review queue.

### DailyQuestProgress

One learner has one DailyQuestProgress record per `dateKey`. It keeps that
day's selected VocabularyEntry IDs, first completion time, and whether its EXP
reward was granted. Completion and reward are distinct state: `completedAt`
supports quest status, while `expAwarded` prevents duplicate rewards. The
concrete timezone policy remains undecided.

## EXP Policy

| Experience | MVP EXP policy | Unlocks Learning Path? |
| --- | --- | --- |
| Learning Path | First-completed exercise: Easy 15, Medium 25, Hard 30 EXP; perfect exercise +5; replayed exercise: Easy 3, Medium 5, Hard 10 EXP | Yes, through the contiguous frontier |
| Home | Same first-completed exercise reward; replayed exercise: Easy 3, Medium 5, Hard 10 EXP | No |
| Daily Quest | Sum of item rewards once per quest: Easy 5, Medium 10, Hard 15 EXP | No |
| Topic / Keyboard Position / Random Practice | Per completed item: Easy 3, Medium 5, Hard 10 EXP | No |
| Review | Per completed item: Easy 3, Medium 5, Hard 10 EXP | No |

Apply flat bonuses before percentage bonuses, then round once:
`round((Base EXP + Flat Bonus) × (1 + Total EXP Bonus))`. Bonus sources and
values are defined in [[DEC-045]] and `docs/LEVELING.md`; bonuses the learner
has not earned or that are not available contribute zero. EXP is global player
progression; it is not curriculum progression. Level is derived with the
LEVELING.md curve ([[DEC-048]]).
