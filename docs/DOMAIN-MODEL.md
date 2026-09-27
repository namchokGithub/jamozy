# Domain Model

Field-level target schema for the entities referenced in `README.md`'s Firestore Data Model section. Fills the gap between collection paths (README) and actual `domain/models/*.ts` code. Update this file whenever a model's shape changes — it is the source of truth for field names/types, not the code comments. Where the current implementation differs, this document records the intended model and the implementation must be brought into line in a separate change.

Conventions: all Firestore documents use `id` as the document ID (not stored as a field unless noted). Timestamps are Firestore `Timestamp`, mapped to `Date` in the domain layer via `infrastructure/firebase/mappers`.

---

## Course

**Path:** `courses/{courseId}`
**File:** `domain/models/course.ts`

| Field       | Type   | Notes                              |
| ----------- | ------ | ---------------------------------- |
| id          | string | Firestore doc ID                   |
| title       | string | e.g. "Hangul Basics"               |
| description | string | short summary shown on course list |
| order       | number | display/unlock order among courses |
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
| order       | number | display/unlock order within the course |
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
| order     | number                                                          | display/unlock order within the unit       |
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
| meaningTh    | string                        | Thai meaning ([[DEC-010]])                         |
| meaningEn    | string                        | English meaning ([[DEC-010]])                      |
| difficulty   | `'easy' \| 'medium' \| 'hard'` | used by Practice Mode filtering ([[DEC-010]])      |
| hint         | string\| null                 | optional extra hint (not meaning — see `meaningTh`/`meaningEn`) |

When `vocabularyId` is present, `targetText`, romanization, meanings, and difficulty are a denormalized lesson snapshot of that vocabulary entry. Content authoring must keep them aligned. This keeps a lesson self-contained at runtime while allowing a word to be reused and tracked across lessons.

---

## VocabularyEntry

**Path:** `vocabulary/{vocabularyId}`
**Planned file:** `domain/models/vocabulary-entry.ts`

Vocabulary is a reusable learning target, not a replacement for every `LessonExercise`. Characters, syllables, phrases, sentences, and one-off prompts remain lesson-owned.

| Field        | Type                          | Notes                                      |
| ------------ | ----------------------------- | ------------------------------------------ |
| id           | string                        | Firestore doc ID                           |
| korean       | string                        | canonical Korean word                      |
| romanization | string\| null                 | optional pronunciation hint                |
| meaningTh    | string                        | Thai meaning                               |
| meaningEn    | string                        | English meaning                            |
| difficulty   | `'easy' \| 'medium' \| 'hard'` | default content difficulty               |
| createdAt    | Date                          |                                            |
| updatedAt    | Date                          |                                            |

Relationships: a `VocabularyEntry` may be referenced by many `LessonExercise`s. A word reused across lessons must reference the same `VocabularyEntry` so its review and learning history are combined.

---

## Progress (per-user, per-lesson)

**Path:** `users/{userId}/lessonProgress/{lessonId}`
**File:** `domain/models/progress.ts`

| Field         | Type                                    | Notes                                                        |
| ------------- | --------------------------------------- | ------------------------------------------------------------ |
| lessonId      | string                                  | same as doc ID; also stored as a field for query convenience |
| status        | `'locked' \| 'unlocked' \| 'completed'` | drives the Learn → Unlock flow                               |
| bestAccuracy  | number                                  | 0–100, best across attempts                                  |
| bestSpeedWpm  | number                                  | best words-per-minute across attempts                        |
| attempts      | number                                  | total attempt count                                          |
| lastAttemptAt | Date\| null                             |                                                              |
| completedAt   | Date\| null                             | set on first`status === 'completed'`                         |

**Cross-checked against `docs/requirement.md`:** that doc lists a 4th `Mastered` state and names `'unlocked'` as `Ready`. Kept the existing 3-state `locked/unlocked/completed` — no `Mastered` trigger was specified, and renaming is cosmetic. Reaffirmed 2026-09-23.

Not persisted here: in-progress keystroke/session state. Per `AGENTS.md`, that stays in Zustand client state and is only written here at checkpoint (lesson complete / session end).

**Unlock rule ([[DEC-009]]):** a lesson's `Progress.status` starts `'locked'`. It becomes `'unlocked'` when the previous lesson (by `Lesson.order` within the same `Unit`; first lesson of the next `Unit`/`Course` unlocks when the last lesson of the previous one completes) reaches `status === 'completed'`. The very first lesson overall is unlocked by default (seeded, not derived). This transition is written by the `complete-lesson` application use case, not computed on read.

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

**Cross-checked against `docs/requirement.md`:** that doc says MVP doesn't need "full" spaced repetition, just a flat problem-word list. Kept Leitner-box scheduling ([[DEC-008]]) — reaffirmed 2026-09-23. Also added `reason` ([[DEC-012]]) since requirement.md wants review entries triggered by mistakes, slow typing, or low accuracy, not just mistakes.

---

## UserProfile

**Path:** `users/{userId}` (the parent doc of `lessonProgress`/`reviewItems` subcollections)
**File:** `domain/models/user-profile.ts`

Not in README's original domain file list, but required to home EXP/Level and Settings ([[DEC-006]], [[DEC-007]]).

| Field     | Type           | Notes                        |
| --------- | -------------- | ----------------------------- |
| id        | string         | Firebase Anonymous Auth UID  |
| exp       | number         | total accumulated EXP, only stored value — `level` is never persisted |
| settings  | `UserSettings` | see below                    |
| stats     | `UserStats`    | see below ([[DEC-011]])      |
| createdAt | Date           |                               |

**Level formula ([[DEC-006]]):** `level` is derived, not stored: `level = 1 + floor(exp / 100)`. Lives as a pure function (`levelFromExp(exp)`) next to `UserProfile` in `domain/models/user-profile.ts`. MVP placeholder — changing the curve later needs no data migration, since `exp` is the only persisted value.

**Cross-checked against `docs/requirement.md`:** that doc's own example ("Level 7, 430/600 EXP") implies an increasing per-level curve (~`level × 100` to reach the next level), not this flat formula, and separately lists "Level" as something to save (implying a stored field). Both reaffirmed against the flat, derived-only formula — 2026-09-23. Revisit the curve shape later if game-design balance needs it; the derived approach means no migration either way.

`UserSettings` (embedded on the user doc, [[DEC-007]]):

| Field               | Type                     | Notes                                         |
| ------------------- | ------------------------ | ---------------------------------------------- |
| soundEnabled        | boolean                  |                                                |
| showKeyboard         | boolean                  | show/hide the virtual keyboard widget         |
| showEnglishKeys      | boolean                  | show English-key hints, e.g. `ㅎ → g`          |
| keyboardOpacity      | number                   | 0–1                                           |
| romanizationEnabled  | boolean                  |                                                |
| meaningLanguage      | `'th' \| 'en' \| 'both'` |                                                |
| theme                | `'light' \| 'dark'`      |                                                |

Replaces the earlier single `keyboardLayoutHint` field with the full requirement.md settings list ([[DEC-013]]) — `showKeyboard` and `showEnglishKeys` are two distinct settings, not one. "Reset Progress" (requirement.md #13) is an action, not a setting — it's a future `application/` use case, not a `UserSettings` field.

`UserStats` (embedded on the user doc, [[DEC-011]]):

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

---

## Resolved Decisions

Previously open, now decided — see `docs/DECISIONS.md` for full rationale:

1. **EXP/Level** ([[DEC-006]]) — `level` derived from `exp` via `level = 1 + floor(exp / 100)`, never stored. Reaffirmed against `docs/requirement.md`.
2. **Settings location** ([[DEC-007]]) — field on the `users/{userId}` doc, not a separate subcollection.
3. **Review scheduling and identity** ([[DEC-008]], [[DEC-022]]) — Leitner-style spaced repetition, `box` + `nextReviewAt`, no `resolved` state; vocabulary-backed items are deduplicated by `vocabularyId`, other items by lesson/exercise identity.
4. **Unlock rule** ([[DEC-009]]) — next lesson unlocks when the previous lesson's `Progress.status` becomes `'completed'`; 3-state status (`locked/unlocked/completed`) reaffirmed against `docs/requirement.md`'s 4-state suggestion.
5. **Vocabulary reuse** ([[DEC-022]]) — reusable words live in `VocabularyEntry`; a `LessonExercise` may link one via `vocabularyId` while remaining self-contained.
6. **`UserStats`** ([[DEC-011]], [[DEC-022]]) — embedded aggregate counters; accuracy and WPM are derived from raw counters, and `exercisesAttempted` replaces the ambiguous `wordsPracticed`.
7. **`ReviewItem.reason`** ([[DEC-012]]) — mistake/slow/low-accuracy trigger, per `docs/requirement.md`.
8. **`UserSettings` expansion** ([[DEC-013]]) — full 7-field settings list, per `docs/requirement.md`.

No open questions remain in this document. Add new ones here as they come up, and resolve the same way.

**Note on `docs/requirement.md`:** that file is the original product spec and is left as-is (not edited to match resolutions above) — this file and `docs/DECISIONS.md` are the authoritative, up-to-date sources when they disagree with it.
