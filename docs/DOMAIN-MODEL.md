# Domain Model

Field-level target schema for the entities referenced in `README.md`'s Firestore Data Model section. Fills the gap between collection paths (README) and actual `domain/models/*.ts` code. Update this file whenever a model's shape changes — it is the source of truth for field names/types, not the code comments. Where the current implementation differs, this document records the intended model and the implementation must be brought into line in a separate change.

Conventions: document-backed cloud entities (`Course`, `Unit`, `Lesson`, `VocabularyEntry`, `Topic`, `UserProfile`, `ReviewItem`, and `LearningSession`) expose `id`, which is exactly the Firestore document ID. It is never stored again as a cloud document field; Firestore mappers derive it from the document snapshot and use it to address writes. The same domain entities may be persisted locally for a Guest using their stable IDs. `LessonExercise.id` is different: it is an embedded identifier stored inside a Lesson document, not a Firestore document ID. Per-user state records use their target key as the document ID and stored field: `Progress.lessonId`, `VocabularyProgress.vocabularyId`, `JamoStat.jamoId`, and `DailyQuestProgress.dateKey`. All relationships use string IDs, never Firestore `DocumentReference` values. Persistence adapters map their timestamp format to `Date` in the domain layer. See `docs/AUTH-AND-PERSISTENCE.md` for persistence selection.

---

## Course

**Path:** `courses/{courseId}`
**File:** `domain/models/course.ts`

| Field       | Type   | Notes                              |
| ----------- | ------ | ---------------------------------- |
| id          | string | Firestore doc ID                   |
| title       | string | e.g. "Hangul Basics"               |
| description | string | short summary shown on course list |
| order       | number | canonical display/unlock order among courses; unique globally |
| createdAt   | Date   |                                    |
| updatedAt   | Date   |                                    |

Relationships: a `Unit` belongs to a `Course` via `Unit.courseId`. No nested subcollection — flat top-level collections per README.

---

## Unit

**Path:** `units/{unitId}`
**File:** `domain/models/unit.ts`

| Field       | Type   | Notes                                  |
| ----------- | ------ | -------------------------------------- |
| id          | string | Firestore doc ID                       |
| courseId    | string | parent`Course.id`                      |
| title       | string | e.g. "Basic Vowels"                    |
| description | string |                                        |
| order       | number | canonical display/unlock order within the course; unique within `courseId` |
| createdAt   | Date   |                                        |
| updatedAt   | Date   |                                        |

Relationships: a `Lesson` belongs to a `Unit` via `Lesson.unitId`.

---

## Lesson

**Path:** `lessons/{lessonId}`
**File:** `domain/models/lesson.ts`

| Field     | Type                                                            | Notes                                      |
| --------- | --------------------------------------------------------------- | ------------------------------------------ |
| id        | string                                                          | Firestore doc ID                           |
| unitId    | string                                                          | parent`Unit.id`                            |
| title     | string                                                          |                                            |
| type      | `'character' \| 'syllable' \| 'word' \| 'phrase' \| 'sentence'` | matches README's progressive learning flow |
| order     | number                                                          | canonical display/unlock order within the unit; unique within `unitId` |
| exercises | `LessonExercise[]`                                              | ordered typing prompts for this lesson     |
| createdAt | Date                                                            |                                            |
| updatedAt | Date                                                            |                                            |

`LessonExercise` (embedded, not a separate collection):

| Field        | Type                          | Notes                                              |
| ------------ | ----------------------------- | --------------------------------------------------- |
| id           | string                        | stable ID within the lesson (for review linking)   |
| vocabularyId | string\| null                 | linked `VocabularyEntry.id` for reusable vocabulary; `null` for characters, syllables, phrases, sentences, or lesson-specific content |
| targetText   | string                        | the Korean text the learner must type              |
| romanization | string\| null                 | optional pronunciation hint                        |
| meaningTh    | string\| null                 | Thai meaning ([[DEC-025]])                         |
| meaningEn    | string\| null                 | English meaning ([[DEC-025]])                      |
| difficulty   | `'easy' \| 'medium' \| 'hard'` | used by Practice Mode filtering ([[DEC-010]])      |
| hint         | string\| null                 | optional extra hint (not meaning — see `meaningTh`/`meaningEn`) |

When `vocabularyId` is present, `targetText`, romanization, meanings, and difficulty are a denormalized lesson snapshot of that vocabulary entry. Content authoring must keep them aligned. This keeps a lesson self-contained at runtime while allowing a word to be reused and tracked across lessons.

**Meaning constraint ([[DEC-025]]):** Word exercises backed by vocabulary, and phrase/sentence exercises, require at least one of `meaningTh` or `meaningEn`. Character and syllable exercises may set both to `null`. The UI must gracefully omit a requested language when that translation is unavailable.

**Exercise-count constraint ([[DEC-024]]):** `exercises` is non-empty and its array order is the canonical typing sequence. MVP lessons normally contain 5–12 exercises and may not exceed 20. Content beyond that cap must be split into another lesson rather than making one session longer.

---

## VocabularyEntry

**Path:** `vocabulary/{vocabularyId}`
**Planned file:** `domain/models/vocabulary-entry.ts`

Vocabulary is a reusable learning target, not a replacement for every `LessonExercise`. Characters, syllables, phrases, sentences, and one-off prompts remain lesson-owned.

| Field        | Type                          | Notes                                      |
| ------------ | ----------------------------- | ------------------------------------------ |
| id           | string                        | Firestore doc ID                           |
| korean       | string                        | canonical Korean spelling                  |
| partOfSpeech | `VocabularyPartOfSpeech`\| null | grammatical category; `null` only when the source does not provide it |
| senseKey     | string                        | required stable sense identifier; use `'default'` for a primary sense |
| romanization | string\| null                 | optional pronunciation hint                |
| meaningTh    | string\| null                 | Thai meaning                               |
| meaningEn    | string\| null                 | English meaning                            |
| frequencyRank | number\| null                | positive integer rank from the imported source; not globally unique |
| difficulty   | `'easy' \| 'medium' \| 'hard'` | default content difficulty               |
| topicIds     | string[]                      | IDs of Topic metadata that groups this shared vocabulary |
| sourceId     | string                        | key into `docs/CREDITS.md`'s source registry |
| sourceUrl    | string\| null                 | source or per-entry reference URL          |
| createdAt    | Date                          |                                            |
| updatedAt    | Date                          |                                            |

`VocabularyPartOfSpeech` is `'noun' | 'verb' | 'adjective' | 'adverb' | 'determiner' | 'pronoun' | 'numeral' | 'particle' | 'interjection' | 'other'`.

**Identity and deduplication ([[DEC-025]]):** entries are unique by `(normalizedKorean, partOfSpeech, senseKey)`, where `normalizedKorean` is NFC-normalized and trimmed. A spelling may therefore have multiple entries when its part of speech or sense differs. `id` is a deterministic, collision-safe encoding of that identity, not raw Korean text. `senseKey` is required so the uniqueness rule still holds when part of speech is unavailable. Use `'default'` only when a spelling/POS pair has one imported sense; multiple senses under the same spelling/POS must use distinct, stable sense keys.

Relationships: a `VocabularyEntry` may be referenced by many `LessonExercise`s. A word reused across lessons must reference the same `VocabularyEntry` so its review and learning history are combined. Vocabulary entries need at least one of `meaningTh` or `meaningEn`; `sourceId` is required, while a source may omit a per-entry `sourceUrl`.

`topicIds` is membership metadata, not copied Topic content. Grammar filters should derive from `partOfSpeech` where possible. See `docs/LEARNING-MODES.md`.

---

## Topic

**Path:** `topics/{topicId}`
**Planned file:** `domain/models/topic.ts`

| Field | Type | Notes |
| --- | --- | --- |
| id | string | Firestore document ID |
| title | string | e.g. `Food` |
| order | number | display order among Topics |

A Topic is metadata only. Its vocabulary membership is held by
`VocabularyEntry.topicIds`; it never owns duplicate VocabularyEntry documents.
Topic counts are derived from member VocabularyEntries and the learner's global
VocabularyProgress. Label this state `Practiced` or `Encountered`, never
`Learned`, until a mastery rule exists.

---

## Progress (per-user, per-lesson)

**Path:** `users/{userId}/lessonProgress/{lessonId}`
**File:** `domain/models/progress.ts`

| Field         | Type                                    | Notes                                                        |
| ------------- | --------------------------------------- | ------------------------------------------------------------ |
| lessonId      | string                                  | same as doc ID; also stored as a field for query convenience |
| status        | `'unlocked' \| 'completed'`              | persisted state; a missing document means locked             |
| bestAccuracy  | number                                  | 0–100, best across attempts                                  |
| bestSpeedWpm  | number                                  | best words-per-minute across attempts                        |
| attempts      | number                                  | total attempt count                                          |
| lastAttemptAt | Date\| null                             |                                                              |
| completedAt   | Date\| null                             | set on first`status === 'completed'`                         |

**Cross-checked against `docs/requirement.md`:** that doc lists a 4th `Mastered` state and names `'unlocked'` as `Ready`. The target model keeps only persisted `'unlocked'/'completed'`; locked is represented by a missing document, and no `Mastered` trigger is specified.

Not persisted here: in-progress keystroke/session state. Per `AGENTS.md`, that stays in Zustand client state and is only written here at checkpoint (lesson complete / session end).

**Unlock rule ([[DEC-009]], [[DEC-025]], [[DEC-026]]):** a missing Progress document represents a locked lesson. The lock is soft: a learner may practice a future Learning Path lesson after a warning. When a Progress document is created, its initial status is `'unlocked'`; a completed Learning Path lesson persists `'completed'`, even when done early. Practice Modes, Daily Quest, and Review never write LessonProgress. This transition is written by the Learning Path completion use case, not computed on read.

**Creation strategy and global ordering ([[DEC-023]], [[DEC-025]], [[DEC-026]]):** `Progress` is created lazily; a missing document means the lesson is locked. When a user profile is first persisted, the first lesson in the global sequence receives a new document with `status: 'unlocked'`. The recommended lesson is the first lesson in global ordering that is not completed: the contiguous completion frontier. When a Learning Path lesson completes, scan forward through already-completed lessons and create or preserve `unlocked` Progress only for the first remaining lesson. Missing or merely unlocked lessons stop the frontier. No documents are created for still-locked lessons.

The global sequence is the lexicographic order of `(Course.order, Unit.order, Lesson.order)`: courses sort by `Course.order`; units by `Unit.order` within their course; lessons by `Lesson.order` within their unit. The next lesson may therefore cross a Unit and then a Course boundary. Document IDs never determine progression order.

---

## VocabularyProgress (per-user)

**Path:** `users/{userId}/vocabularyProgress/{vocabularyId}`
**Planned file:** `domain/models/vocabulary-progress.ts`

| Field | Type | Notes |
| --- | --- | --- |
| vocabularyId | string | document ID and `VocabularyEntry.id` |
| firstEncounteredAt | Date | first completed exercise using this vocabulary |
| lastPracticedAt | Date | latest completed exercise using this vocabulary |
| exercisesAttempted | number | completed exercises across all experiences |
| acceptedKeystrokes | number | accepted input for this vocabulary |
| rejectedKeystrokes | number | rejected input for this vocabulary |

This is a learner's accumulated history for shared vocabulary, not a review
queue. Accuracy is derived from the raw counters. No mastery or familiarity
field exists in MVP.

---

## JamoStat (per-user)

**Path:** `users/{userId}/jamoStats/{jamoId}`
**Planned file:** `domain/models/jamo-stat.ts`

| Field | Type | Notes |
| --- | --- | --- |
| jamoId | string | document ID; expected Korean jamo |
| acceptedKeystrokes | number | incremented for correct input of the expected jamo |
| rejectedKeystrokes | number | incremented for rejected input while this jamo was expected |
| firstPracticedAt | Date | first submitted session containing this expected jamo |
| lastPracticedAt | Date | latest submitted session containing this expected jamo |

Accuracy is derived from the raw counters. Keyboard Position is a view/filter
over shared jamo and keyboard metadata; it has no separate progress entity.
All counters and timestamps are aggregated from a submitted session result,
never persisted per keystroke.

**Jamo and keyboard metadata:** the existing Korean typing domain is the
canonical content source for jamo, physical key, Shift requirement, and keyboard
row. This metadata is shared by all experiences and does not require a new
Firestore collection in MVP.

---

## DailyQuestProgress (per-user)

**Path:** `users/{userId}/dailyQuestProgress/{dateKey}`
**Planned file:** `domain/models/daily-quest-progress.ts`

| Field | Type | Notes |
| --- | --- | --- |
| dateKey | string | document ID identifying the quest day; timezone policy is undecided |
| vocabularyIds | string[] | stable set of exactly 10 `VocabularyEntry.id` values for that quest |
| completedAt | Date\| null | set once when the learner first completes that date's quest; independent from reward persistence |
| expAwarded | boolean | true once the quest's one allowed EXP reward has been granted |

Reloading a dateKey reuses its vocabulary set. This entity records Daily Quest
identity, completion, and idempotent rewards only; it never completes or
unlocks a Lesson. `completedAt` may be non-null only once that quest is
completed; retries may still update shared learner state but cannot grant EXP
again after `expAwarded` is true.

---

## LearningSession (per-user history)

**Authenticated path:** `users/{userId}/learningSessions/{sessionId}`
**Implemented file:** `src/domain/models/learning-session.ts` (currently
supports Learning Path and Review; other contexts below remain target-model
work).

| Field | Type | Notes |
| --- | --- | --- |
| id | string | document ID, generated when the active session starts; retained when its logical submit retries |
| context | `LearningSessionContext` | discriminated source/mode context below |
| startedAt | Date | active session start time |
| completedAt | Date | submitted completion time |
| durationSeconds | number | non-negative active-session duration |
| exercisesAttempted | number | submitted exercises in this activity |
| acceptedKeystrokes | number | raw accepted input in this activity |
| rejectedKeystrokes | number | raw rejected input in this activity |
| expGained | number | EXP actually awarded by this submitted activity; `0` when none is awarded |

`LearningSessionContext` is a discriminated union, persisted as an embedded
object:

```ts
type LearningSessionContext =
  | { mode: 'learning-path'; lessonId: string }
  | { mode: 'daily-quest'; dateKey: string }
  | { mode: 'topic'; topicId: string }
  | { mode: 'keyboard-position'; positionId: string }
  | { mode: 'review' }
  | { mode: 'random' };
```

Accuracy and WPM are derived from the raw counters and duration using the same
zero guards and five-keystrokes-per-word convention as `UserStats`. This is a
historical activity record, not a source of truth for current learner state,
rewards, or curriculum progression. A retry after a failed logical submission
uses the same `id`; a real replay starts a new session and receives a new ID.
No raw keystrokes, `MistakeEvent` arrays, exercise snapshots, or per-jamo maps
are persisted in MVP. Guest records use the equivalent IndexedDB adapter and
retain the same ID for future account migration. See `docs/SESSION-AND-HISTORY.md`.

---

## ReviewItem (per-user)

**Path:** `users/{userId}/reviewItems/{itemId}`
**File:** `domain/models/review-item.ts`

| Field            | Type    | Notes                                                       |
| ---------------- | ------- | ----------------------------------------------------------- |
| id               | string  | Firestore doc ID; deterministic identity, defined below     |
| sourceLessonId   | string  | `Lesson.id` that first created this item                    |
| sourceExerciseId | string  | `LessonExercise.id` that first created this item            |
| vocabularyId     | string\| null | linked `VocabularyEntry.id`; `null` for non-vocabulary content |
| targetText       | string  | the mistyped Korean text (denormalized for quick review UI) |
| mistakeCount     | number  | incremented each time it's mistyped again                   |
| lastMistakeAt    | Date    |                                                             |
| reason           | `'mistake' \| 'slow' \| 'low-accuracy'` | why this word entered review ([[DEC-012]]) |
| box              | number  | Leitner box, 1–5 ([[DEC-008]]); starts at 1, +1 on a correct review (capped at 5), resets to 1 on a mistake |
| nextReviewAt     | Date    | when this item is next due; computed from `box` at write time |

**Identity and deduplication ([[DEC-022]]):** a vocabulary-backed item has `id === vocabularyId`, yielding one review history per learner per reusable word across all lessons. A non-vocabulary item has `id === \`${sourceLessonId}:${sourceExerciseId}\``, yielding one review history per lesson exercise. Therefore the deduplication rule is one active item per vocabulary entry, or one active item per non-vocabulary exercise.

**Spaced repetition scheduling ([[DEC-008]], [[DEC-022]]):** Leitner-style boxes. Box → interval: 1 → 1 day, 2 → 3 days, 3 → 7 days, 4 → 14 days, 5 → 30 days. A correct review advances the box and schedules the next review; a mistake resets it to box 1 and reschedules it. There is no `resolved` state: every `ReviewItem` remains active, including at box 5. A review session pulls items where `nextReviewAt <= now`. This is an MVP default, tunable without a schema change (only the interval table changes).

**Reason priority ([[DEC-024]]):** when one exercise qualifies for review for multiple reasons in a submitted session, choose exactly one: `mistake` > `low-accuracy` > `slow`. `reason` records the highest-priority reason that first created the ReviewItem and is not overwritten on later triggers. Trigger thresholds for `low-accuracy` and `slow` are application policy, not persisted schema.

All experiences may create or update the shared ReviewItem when their rules
qualify an item. No experience owns a separate review queue.

**Cross-checked against `docs/requirement.md`:** that doc says MVP doesn't need "full" spaced repetition, just a flat problem-word list. Kept Leitner-box scheduling ([[DEC-008]]) — reaffirmed 2026-09-23. Also added `reason` ([[DEC-012]]) since requirement.md wants review entries triggered by mistakes, slow typing, or low accuracy, not just mistakes.

---

## UserProfile

**Authenticated path:** `users/{userId}` (the parent doc of `lessonProgress`/`reviewItems` subcollections)
**File:** `domain/models/user-profile.ts`

Not in README's original domain file list, but required to home EXP/Level and Settings ([[DEC-006]], [[DEC-007]]).

| Field     | Type           | Notes                        |
| --------- | -------------- | ----------------------------- |
| id        | string         | Firebase Auth UID for an authenticated user; locally generated `guestId` for a Guest |
| displayName | string       | required player-facing name; never auth identity |
| exp       | number         | total accumulated EXP, only stored value — `level` is never persisted |
| settings  | `UserSettings` | see below                    |
| stats     | `UserStats`    | see below ([[DEC-011]])      |
| createdAt | Date           |                               |
| updatedAt | Date           | set with `createdAt` on creation; changed on every persisted profile mutation ([[DEC-023]]) |

**Level formula ([[DEC-006]], [[DEC-024]]):** `level` is derived, not stored: `level = 1 + floor(exp / 100)`. Lives as a pure function (`levelFromExp(exp)`) next to `UserProfile` in `domain/models/user-profile.ts`. This flat curve remains the MVP placeholder and is deferred for later game-balance work; changing it needs no data migration, since `exp` is the only persisted value.

**Cross-checked against `docs/requirement.md`:** that doc's own example ("Level 7, 430/600 EXP") implies an increasing per-level curve (~`level × 100` to reach the next level), not this flat formula, and separately lists "Level" as something to save (implying a stored field). Both reaffirmed against the flat, derived-only formula — 2026-09-23. Revisit the curve shape later if game-design balance needs it; the derived approach means no migration either way.

For authenticated users the profile is stored in Firestore; for Guests it is
stored in IndexedDB with the same domain shape. Authentication/session details
are separate from `UserProfile`; do not store `email`, provider details, or
`isGuest` here. See `docs/AUTH-AND-PERSISTENCE.md`.

`UserSettings` (embedded in the profile, [[DEC-007]]):

| Field               | Type                     | Notes                                         |
| ------------------- | ------------------------ | ---------------------------------------------- |
| soundEnabled        | boolean                  |                                                |
| showKeyboard         | boolean                  | show/hide the virtual keyboard widget         |
| keyboardOpacity      | number                   | 0–1                                           |
| romanizationEnabled  | boolean                  |                                                |
| meaningLanguage      | `'th' \| 'en' \| 'both'` |                                                |
| theme                | `'light' \| 'dark'`      |                                                |

Replaces the earlier single `keyboardLayoutHint` field with the current settings list. English physical-key labels are always shown alongside Hangul labels, so `showEnglishKeys` is not a user setting ([[DEC-027]]). "Reset Progress" (requirement.md #13) is an action, not a setting — it's a future `application/` use case, not a `UserSettings` field.

`UserStats` (embedded on `UserProfile`, [[DEC-011]]):

| Field                  | Type   | Notes                                    |
| ---------------------- | ------ | ------------------------------------------ |
| lessonsCompleted       | number | unique lessons completed; retries do not increment it |
| exercisesAttempted     | number | total exercises completed in submitted lesson, practice, or review sessions; retries count |
| totalAcceptedKeystrokes | number | accepted Korean keyboard input events across all submitted sessions |
| totalRejectedKeystrokes | number | rejected/wrong Korean keyboard input events across all submitted sessions |
| bestAccuracy           | number | 0–100, best single submitted session across all modes (distinct from `Progress.bestAccuracy`, which is per-lesson) |
| totalTypingTimeSeconds | number | total active typing duration across all submitted sessions |

`averageAccuracy` and `averageSpeedWpm` are derived, never stored ([[DEC-022]]):

```text
averageAccuracy = totalAcceptedKeystrokes / (totalAcceptedKeystrokes + totalRejectedKeystrokes) × 100
averageSpeedWpm = (totalAcceptedKeystrokes / 5) / (totalTypingTimeSeconds / 60)
```

Return `0` for either value when its denominator is zero. WPM uses the existing keyboard-engine convention of five accepted physical keystrokes per word; it is not a count of Korean whitespace-delimited words. All counters change only when a session is submitted, never per keystroke.

`currentLevel` (requirement.md #9) is intentionally not stored here — it's `levelFromExp(exp)`, computed on read (see [[DEC-006]]).

`updatedAt` is an audit timestamp, not an activity timestamp: it changes when settings, EXP, or stats are persisted, but not for reads or session activation alone. Guest retention uses the separate local `GuestSession.lastActiveAt` field in `docs/AUTH-AND-PERSISTENCE.md`.

**Session-foundation compatibility ([[DEC-031]]):** pre-LearningSession
`exp`/`stats` values are retained as an immutable `legacyBaseline`, not
converted into raw counters. New submitted sessions contribute only to
`sessionAggregate`; profile summaries combine the two. This layer remains until
an explicit data migration can safely retire the legacy presentation fields.
Profile's `Lessons completed` is derived from persisted `LessonProgress`
records with `status: 'completed'`, not from `UserStats` or
`sessionAggregate`; this remains correct when curriculum adds more Units or
Lessons. When the legacy baseline is all zero, the profile derives accuracy and
WPM from aggregate accepted/rejected keystrokes and typing time; when it is not,
it keeps the legacy averages because their raw denominators are unavailable.
Guest-to-account migration preserves this compatibility layer: a Cloud baseline
wins when both profiles have one, and newly submitted session effects remain
receipt-gated.

---

## Resolved Decisions

Previously open, now decided — see `docs/DECISIONS.md` for full rationale:

1. **EXP/Level** ([[DEC-006]]) — `level` derived from `exp` via `level = 1 + floor(exp / 100)`, never stored. Reaffirmed against `docs/requirement.md`.
2. **Settings location** ([[DEC-007]], [[DEC-027]]) — embedded in `UserProfile`, whether that profile is stored in Guest IndexedDB or authenticated Firestore; never a separate settings collection.
3. **Review scheduling and identity** ([[DEC-008]], [[DEC-022]]) — Leitner-style spaced repetition, `box` + `nextReviewAt`, no `resolved` state; vocabulary-backed items are deduplicated by `vocabularyId`, other items by lesson/exercise identity.
4. **Unlock rule** ([[DEC-009]], [[DEC-025]]) — next lesson unlocks when the previous lesson's Progress becomes `'completed'`; a missing document represents locked, while persisted states are `'unlocked'/'completed'`.
5. **Vocabulary reuse** ([[DEC-022]]) — reusable words live in `VocabularyEntry`; a `LessonExercise` may link one via `vocabularyId` while remaining self-contained.
6. **`UserStats`** ([[DEC-011]], [[DEC-022]]) — embedded aggregate counters; accuracy and WPM are derived from raw counters, and `exercisesAttempted` replaces the ambiguous `wordsPracticed`.
7. **`ReviewItem.reason`** ([[DEC-012]]) — mistake/slow/low-accuracy trigger, per `docs/requirement.md`.
8. **`UserSettings` expansion** ([[DEC-013]], [[DEC-027]]) — profile settings; English physical-key labels are always shown, so no `showEnglishKeys` field remains.
9. **Progress creation, ordering, and profile auditing** ([[DEC-023]]) — missing Progress means locked; unlocks are lazy along the global course/unit/lesson ordering; `UserProfile.updatedAt` tracks persisted mutations.
10. **Identity, exercise count, review reason, and level curve** ([[DEC-024]]) — Firestore/document and domain ID semantics are explicit; lessons cap at 20 exercises; review reasons use a deterministic priority; EXP-to-level balance remains deferred.
11. **Vocabulary import and Progress-state refinement** ([[DEC-025]]) — vocabulary identity includes spelling, part of speech, and sense; translations are nullable according to content type; Progress has only persisted unlocked/completed states.
12. **Learning Modes** ([[DEC-026]]) — Learning Path progression, Daily Quest, and Practice Modes are distinct experiences over shared content and learner state.
13. **Authentication and persistence** ([[DEC-027]], [[DEC-030]], [[DEC-031]]) — Guest and authenticated sessions use the same learner model with IndexedDB or Firestore persistence; automatic migration merges the currently persisted entities with receipt-gated session effects and preserves the legacy-baseline compatibility layer.
14. **Shared learner-state checkpoint semantics** ([[DEC-028]]) — VocabularyProgress and JamoStat aggregate submitted results across modes; DailyQuestProgress distinguishes completion from its idempotent EXP reward.
15. **Session history** ([[DEC-029]]) — LearningSession records submitted activity once per logical session, independently of current learner state and lifetime aggregates.

Guest-to-account field-level rules are decided in [[DEC-030]] and implemented
for the entities currently persisted on this branch. Future-mode records remain
out of scope until their models and adapters exist.

**Note on `docs/requirement.md`:** that file is the original product spec and is left as-is (not edited to match resolutions above) — this file and `docs/DECISIONS.md` are the authoritative, up-to-date sources when they disagree with it.
