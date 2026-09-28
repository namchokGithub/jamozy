# Guest-local persistence and session-aware composition

**Status:** Proposed

## Goal

Replace the legacy Firebase Anonymous Auth dependency for the existing learner
flows with an automatically created local Guest identity. Persist the existing
learner state in IndexedDB, while retaining Firebase-backed shared learning
content. Establish one composition boundary that can select authenticated
Firebase learner repositories in a later milestone without rewriting features.

## Scope

Included:

- Create and reuse a stable Guest session with `crypto.randomUUID()`.
- Generate the initial display name as `Guest#0000` through `Guest#9999` with
  `crypto.getRandomValues()`.
- Persist Guest session metadata, `UserProfile`, `Progress`, and `ReviewItem`
  records in IndexedDB.
- Add local repository implementations for the existing learner-state
  repository interfaces.
- Replace direct route use of `signInAnonymouslyIfNeeded()` with an active
  `UserSession` provider and session-aware learner-repository composition.
- Add an editable display-name control to the Course List header. It displays
  only the name and an edit control; it does not show a flag, auth status, or
  onboarding screen.
- Update the current `UserProfile` implementation to include `displayName` and
  `updatedAt`, matching the target domain model.
- Update the checked-in Firestore rules so shared content can be read without
  Firebase Auth and cannot be written by a client.

Excluded:

- Email/password authentication, Google Sign-In, account linking, and
  Guest-to-account migration.
- LearningSession, VocabularyProgress, JamoStat, DailyQuestProgress, retention
  cleanup, or a History UI.
- Deploying Firestore rules or running build/test commands. The user performs
  those external or verification actions separately.

## Domain and persistence design

`UserSession` is a domain model with two target variants:

```ts
type UserSession =
  | { kind: 'guest'; userId: string }
  | { kind: 'authenticated'; userId: string };
```

This milestone creates only the Guest variant. A `GuestSession` local record
holds `guestId`, `displayName`, `createdAt`, and `lastActiveAt`. On first use,
the session service creates the UUID and generated name, creates a matching
local `UserProfile`, and returns the stable session thereafter.

The native IndexedDB database stores separate object stores for Guest sessions,
profiles, progress, and review items. Records use the Guest ID as their
partition key; dates are encoded at the persistence boundary and restored as
`Date` objects in the domain layer. IndexedDB is the primary Guest database;
`localStorage` is not used for learner state.

`UserProfile` gains `displayName` and `updatedAt`. Saving settings, changing a
name, and lesson completion update `updatedAt`; identity remains immutable.
Firebase mapping remains backward compatible with existing profile documents
that do not yet carry these fields.

## Composition and data flow

The router receives dependencies from one application composition module:

```text
Route loader/action
        |
        v
Active UserSession provider ──> userId
        |
        v
Session-aware learner repositories
        |
        +--> Guest: IndexedDB local repositories     (this milestone)
        +--> Authenticated: Firebase repositories    (future milestone)

Shared Course/Lesson repositories ──> Firebase content reads
```

Existing use cases retain their repository-interface dependencies and user ID
arguments. Session-aware repository wrappers resolve the active session and
delegate to the appropriate concrete learner adapter. During this milestone,
all learner-state calls therefore resolve to local IndexedDB. A later
authenticated-session provider adds the Firebase branch at the composition
boundary, not inside React features or application use cases.

`CourseRepository` and `LessonRepository` remain Firebase content adapters.
The Firebase module no longer signs in anonymously as a condition of loading a
route.

## Display-name interaction

The Course List header displays a compact control such as:

```text
Guest#1245  ✎
```

The displayed value is the Guest profile name. Activating the edit control
allows the learner to edit and save that name to local persistence. Saving
updates the visible name and profile `updatedAt`, but never replaces the
Guest ID. No onboarding page, flag, account badge, or account-management UI is
introduced.

## Firestore rule change

Guest learners need read access to shared content without Firebase Auth. The
checked-in rules will allow public reads for `courses`, `units`, and `lessons`.
Client writes to those collections will be denied. Learner-state rules remain
for authenticated user data until the authenticated persistence milestone
replaces them. This change is repository-local only; deploying it is explicitly
out of scope for this work.

## Error handling

- If IndexedDB is unavailable or a local read/write fails, propagate a route or
  action error rather than silently falling back to Firebase or `localStorage`.
- A failed name update preserves the displayed saved name; it must not create a
  new Guest session.
- Repeated session initialization returns the existing session and does not
  create a second Guest profile.

## Test strategy

- Unit-test Guest ID/name creation, reuse, and failure behavior with injected
  crypto and storage seams.
- Contract-test local profile, progress, and review repositories, including
  Date round trips and Guest-ID isolation.
- Test session-aware wrappers choose Guest-local adapters and do not invoke
  Anonymous Auth.
- Test the Course List name control saves a changed name while preserving the
  Guest ID.
- Update existing router/loader/action tests to use the active-session
  dependency and retain regression coverage for lesson, review, settings, and
  profile flows.

## Acceptance criteria

1. A fresh browser visit receives one stable UUID and generated `Guest#NNNN`
   name without an onboarding screen or Firebase Anonymous Auth call.
2. Refreshing preserves the Guest identity, display name, profile, progress,
   review items, settings, and lesson results in IndexedDB.
3. Existing routes load and submit learner state through session-aware local
   repositories while Course/Lesson content continues to load from Firebase.
4. Editing a display name changes only the name and its update timestamp.
5. The checked-in Firestore rules permit unauthenticated content reads and deny
   client content writes; deployment is left to the user.
6. No authentication, migration, session-history, or post-MVP learner models
   are introduced.
