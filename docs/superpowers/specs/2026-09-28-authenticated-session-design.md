# Authenticated session without Guest migration

**Status:** Proposed

## Goal

Add Email/password and Google Sign-In to the existing session-aware
composition. Authenticated learners use Firebase-backed learner repositories;
Guest IndexedDB data remains intact and is not migrated in this milestone.

## Scope

- Add a domain `AuthRepository` and Firebase Auth adapter for email sign-up,
  email sign-in, Google popup sign-in, sign-out, and authentication-state
  observation.
- Make the active session select Firebase UID when Firebase Auth has a user,
  otherwise retain the existing Guest session.
- Add one Course List modal for email sign-in/sign-up and Google Sign-In.
- Revalidate route data after auth-state changes; sign-out returns to the
  existing Guest session.
- Create an empty authenticated `UserProfile` on first sign-in. Use the Google
  display name when available; otherwise use `Learner`.

## Excluded

- Guest-to-account migration, aggregation, or deletion; no Guest IndexedDB
  record is copied to Firestore.
- LearningSession / exactly-once work, account linking, password reset,
  email verification, or account deletion.
- Firebase console provider enablement and authorised-domain configuration.

## Architecture

React components call application auth use cases, never Firebase directly.
`AuthRepository` is implemented in infrastructure/Firebase. A session manager
composes the Firebase auth observer with the existing Guest session repository:
Firebase user wins when present; otherwise Guest remains active. The existing
session-aware learner repositories therefore select Firebase adapters without
route-specific auth branching.

The modal owns transient fields and errors only. It submits Email/password or
Google requests through application use cases, then asks the router to
revalidate. Sign-out performs the inverse. Existing Guest state is deliberately
unmodified in every branch.

## UI

The Course List header shows `Sign in` for a Guest. It opens a modal with Email
and password fields, a sign-in / create-account toggle, and a Google button.
When authenticated, the header shows the cloud profile display name and a
Sign out control. Auth errors appear inside the modal without replacing the
route error boundary.

## Acceptance criteria

1. Email/password sign-up, email sign-in, and Google popup sign-in produce an
   authenticated session and use Firebase learner repositories.
2. A first authenticated sign-in has a cloud profile whose display name is the
   Google name when present, otherwise `Learner`.
3. Sign-out returns to the prior Guest session and its local state.
4. Guest data is never copied, deleted, or used to alter cloud data.
5. The UI has no Firebase imports and exposes provider errors in the modal.
