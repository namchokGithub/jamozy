# Admin content management

**Status:** Proposed

## Goal

Provide a single owner with an internal `/admin` back office for creating and
maintaining Jamozy Course, Unit, Lesson, and text Exercise content. Learners
must only be able to read published content; the owner must be able to prepare
drafts safely, publish Lessons one at a time, and archive content without
breaking existing learner progress, review items, or session history.

## Confirmed scope

- One administrator in v1, authenticated with the owner's Google account.
- `/admin` lives in the existing React application and deployment.
- Firebase Auth custom claim `admin: true` is the authorization boundary.
- Content consists only of the existing text schema: Course, Unit, Lesson, and
  embedded `LessonExercise` records. No image, audio, Storage, or import/export
  workflow is included.
- Exercises may be added, edited, and reordered, but are not individually
  deleted or archived in v1; Archive the containing Lesson to stop using them.
- Course, Unit, and Lesson support `draft`, `published`, and `archived` states.
- Lessons publish individually inside a published Course and Unit.
- Editing a published Lesson goes live as soon as it is saved; v1 has no
  revision/versioning model.
- Archive replaces destructive deletion for all v1 content management.

## Excluded

- Multiple admins, editor/reviewer roles, approval workflows, or audit logs.
- Cloud Functions, a separate admin host, or a custom API server.
- Media upload, content import/export, bulk editing, translations beyond the
  existing Exercise fields, and content version history.
- Any learner-state mutation, reset, or migration. Admin content work never
  writes `users/{uid}` data.
- Hard delete, including for Draft content, in v1.
- Sound and dark-theme work.

## Content state and lifecycle

Add `status: 'draft' | 'published' | 'archived'` to Course, Unit, and Lesson.
New content starts as `draft`. Archiving records
`archivedFromStatus: 'draft' | 'published'`, which Restore uses to recover the
prior state. IDs are generated once and never edited, because `LessonProgress`,
`ReviewItem`, and `LearningSession` records rely on stable lesson/exercise
identity.

| Action | Result |
| --- | --- |
| Save draft | Stores the current content without exposing it to learners. |
| Publish Course/Unit | Makes a valid container available; it may initially have no published children. |
| Publish Lesson | Requires its Course and Unit to be published and at least one valid Exercise. |
| Edit published content | Saves directly to the published document and is immediately visible to learners. |
| Archive Lesson | Hides that Lesson from learners while retaining all learner-state references. |
| Archive Unit/Course | Hides its descendants without overwriting child statuses, so restore preserves their prior state. |
| Restore | Changes the selected node back to its prior operational status; a restored Lesson is visible only when all parents are published. |

There is no hard-delete action in v1. This avoids orphaning learner references
and removes parent/child cascade semantics from the first release.

## Learner visibility

Learners can read a Course, Unit, or Lesson only if the document itself is
`published` and every ancestor is also `published`. A published Course may
therefore contain a draft Unit, and a published Unit may contain draft Lessons,
without exposing them in the learner UI.

Learner content repositories add `status == 'published'` to list queries and
handle an unpublished direct document lookup as not found. Course Map and
Lesson loaders continue to use their existing application/repository boundaries;
they must not import Firebase or special-case admin state in React components.

## Authorization and Firestore Rules

The owner signs in with Google. A one-off local Admin SDK script sets
`{ admin: true }` on that account's Firebase Auth UID. The service-account
credential is supplied through local environment configuration and is never
committed. The owner signs out/in (or refreshes the ID token) after provisioning
the claim.

The client checks the token claim before loading `/admin` routes and returns an
Unauthorized route state for everyone else. This is UX only; Firestore Rules
are authoritative:

- `isAdmin()` grants full read/write access to `courses`, `units`, and
  `lessons`.
- Non-admin reads are limited to published content with published ancestors.
- Non-admin writes to content are always denied.
- Claim setting is performed only through the Admin SDK, never from browser
  code.

The existing per-user rules remain unchanged.

## Application architecture

Add an `AdminContentRepository` interface in `domain/repositories` and its
Firebase implementation in `infrastructure/firebase`. It exposes the admin
read/write operations for all content states. Admin pages call application use
cases through React Router loaders/actions; they never call the Firebase SDK
directly.

```text
/admin page + React Router action
  → Admin content use case
  → AdminContentRepository
  → Firebase admin-content repository
```

Existing learner `CourseRepository` and `LessonRepository` remain read-only and
published-only. The admin repository is deliberately separate, so authoring
permissions and draft visibility cannot leak into learner flows.

## Admin UI

- `/admin`: Course list across all statuses, status filters, and Create Course.
- `/admin/courses/:courseId`: Course fields, status controls, ordered Unit list,
  Create Unit, and Archive/Restore controls.
- `/admin/units/:unitId`: Unit fields, status controls, ordered Lesson list,
  Create Lesson, and Archive/Restore controls.
- `/admin/lessons/:lessonId`: Lesson fields, status controls, editable ordered
  Exercise list, add/reorder Exercise, and Archive/Restore controls.

All lists use the existing `order` field. New siblings are appended at the end;
Move Up/Move Down swaps adjacent sibling order values transactionally. This
avoids a drag-and-drop dependency. Publish and Archive use the shared Modal for
confirmation and the shared Snackbar for success/failure feedback.

## Validation

Save validation enforces required text fields, valid parent IDs, supported
Lesson type/difficulty values, and non-empty Exercise target text. Publish a
Lesson also requires at least one valid Exercise plus published parent Course
and Unit. Publish actions fail with a structured error while preserving the
admin's form state.

## Migration and deployment

Existing seed/Firestore content has no status field. Before restrictive learner
Rules are deployed, a local Admin SDK migration script sets existing Course,
Unit, and Lesson documents to `published`. It does not touch any learner data.

Deployment order:

1. Deploy required Firestore composite indexes for status-filtered, ordered
   Course/Unit/Lesson queries.
2. Run the one-off content-status migration and verify document counts.
3. Deploy Firestore Rules.
4. Provision the owner's Google UID with the `admin` custom claim.
5. Deploy the application and verify the claim after token refresh.

## Testing and acceptance criteria

Automated coverage includes:

- Domain/application validation, publish prerequisites, archive/restore, and
  sibling reordering.
- Admin route guard, loader/action outcomes, and snackbar feedback.
- Firebase Rules Emulator cases for admin access, learner access to published
  content, learner denial for Draft/Archived content, and denial of all
  non-admin writes.

Manual acceptance flow:

1. Sign in with the provisioned Google account and open `/admin`.
2. Create a Course, Unit, and Draft Lesson with Exercises.
3. Publish its parents, then the Lesson; confirm it appears for a learner.
4. Archive the Lesson; confirm it disappears for the learner while existing
   learner Progress/Review/Session records remain accessible.
5. Restore and reorder content; confirm learner ordering and visibility update.

The milestone is complete only when the owner can author, order, publish, edit,
archive, and restore content through `/admin`, while Firestore Rules prevent
all other clients from reading unpublished content or writing any content.
