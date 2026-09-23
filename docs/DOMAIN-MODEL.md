# Domain Model

Field-level schema for the entities referenced in `README.md`'s Firestore Data Model section. Fills the gap between collection paths (README) and actual `domain/models/*.ts` code. Update this file whenever a model's shape changes — it is the source of truth for field names/types, not the code comments.

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

| Field        | Type          | Notes                                            |
| ------------ | ------------- | ------------------------------------------------ |
| id           | string        | stable ID within the lesson (for review linking) |
| targetText   | string        | the Korean text the learner must type            |
| romanization | string\| null | optional pronunciation hint                      |
| hint         | string\| null | optional extra hint (meaning, keyboard tip)      |

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

Not persisted here: in-progress keystroke/session state. Per `AGENTS.md`, that stays in Zustand client state and is only written here at checkpoint (lesson complete / session end).

---

## ReviewItem (per-user)

**Path:** `users/{userId}/reviewItems/{itemId}`
**File:** `domain/models/review-item.ts`

| Field            | Type    | Notes                                                       |
| ---------------- | ------- | ----------------------------------------------------------- |
| id               | string  | Firestore doc ID                                            |
| sourceLessonId   | string  | `Lesson.id` this item came from                             |
| sourceExerciseId | string  | `LessonExercise.id` this item came from                     |
| targetText       | string  | the mistyped Korean text (denormalized for quick review UI) |
| mistakeCount     | number  | incremented each time it's mistyped again                   |
| lastMistakeAt    | Date    |                                                             |
| resolved         | boolean | true once learner types it correctly in a review session    |

---

## UserProfile (implied by README, not in its explicit domain file list)

**Path:** `users/{userId}` (the parent doc of `lessonProgress`/`reviewItems` subcollections)
**File:** not yet listed in README's folder structure — add `domain/models/user-profile.ts` when built

README calls for a "Simple EXP and Level system" and "Configurable learning settings," but doesn't specify where they live. Proposed shape, pending confirmation (see Open Questions):

| Field     | Type           | Notes                                  |
| --------- | -------------- | -------------------------------------- |
| id        | string         | Firebase Anonymous Auth UID            |
| exp       | number         | total accumulated EXP                  |
| level     | number         | derived or stored — see Open Questions |
| settings  | `UserSettings` | see below                              |
| createdAt | Date           |                                        |

`UserSettings` (embedded, tentative):

| Field              | Type    | Notes                              |
| ------------------ | ------- | ---------------------------------- |
| soundEnabled       | boolean |                                    |
| keyboardLayoutHint | boolean | show/hide virtual keyboard overlay |

---

## Open Questions

Not decided yet — resolve before building the affected model, and record the resolution in `docs/DECISIONS.md`:

1. **EXP/Level storage** — is `level` stored directly or derived from `exp` via a formula? Where does the EXP-per-lesson formula live (domain service vs. static config)?
2. **Settings location** — top-level field on the user doc (as proposed above) or a separate `users/{userId}/settings/{settingsId}` doc? Affects read cost on every screen that needs a setting.
3. **Review scheduling** — is Review "Practice mode" just a flat list of unresolved `ReviewItem`s, or spaced-repetition scheduled (would need a `nextReviewAt` field)? README doesn't specify an algorithm.
4. **Unlock rule** — what marks a `Lesson`/`Unit`/`Course` as `unlocked`? (e.g., previous lesson `completed`, or a minimum accuracy threshold). Not specified in README.
