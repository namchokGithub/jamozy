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
`Course.type` variants. `Course → Unit → Lesson → LessonExercise` remains the
structured Learning Path only.

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

Weak Jamo, Weak Vocabulary, Random Practice, TOPIK, and Favorites remain
future experiences without dedicated persisted entities yet.

### Daily Quest

Daily Quest is a generated vocabulary session, not a Course, Unit, or Lesson.
It presents 10 vocabulary items and reuses the same set when reloaded on the
same day. It contributes to shared learner state and may update ReviewItems,
but never completes or unlocks a Learning Path lesson.

Daily Quest awards EXP at most once per quest. Its `dateKey` timezone policy is
an explicit pre-implementation decision; no timezone-handling design is fixed
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
| Learning Path | Existing lesson-completion rule | Yes, through the contiguous frontier |
| Daily Quest | Once per daily quest | No |
| Topic | No EXP | No |
| Keyboard Position | No EXP | No |
| Random Practice | No EXP | No |
| Review | No EXP | No |

EXP is global player progression; it is not curriculum progression.
