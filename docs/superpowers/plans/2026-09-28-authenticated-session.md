# Authenticated session without Guest migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Email/password and Google Sign-In that switch existing learner flows to Firebase persistence without migrating Guest data.

**Architecture:** Firebase Auth is hidden behind a domain `AuthRepository`; a session manager chooses Firebase Auth UID over the existing Guest session. Existing session-aware learner repositories then select their Firebase branch without feature-level persistence logic.

**Tech Stack:** React 19, TypeScript, React Router 8, Firebase Auth, Firestore, Vitest, React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-28-authenticated-session-design.md`

## Global Constraints

- Do not migrate, delete, read into Firestore, or otherwise alter Guest IndexedDB learner data.
- Use one Course List modal; no new auth route.
- Google uses popup sign-in; Firebase console provider setup remains user-owned.
- Cloud profile name is Google display name when available, otherwise `Learner`.
- Keep Firebase imports out of React features and application use cases.

## Review Focus

- A failed provider request must leave the Guest session active and show a modal error.
- Sign-out must restore the pre-existing Guest ID/local state, not create a new Guest.
- Repeated authenticated sign-in must not reset a cloud profile.
- Google users without a provider display name must receive `Learner`.
- No auth path may copy Guest progress, review items, settings, EXP, or stats.

---

### Task 1: Domain authentication and session manager

**Files:**
- Create: `src/domain/repositories/auth-repository.ts`
- Create: `src/application/authenticate.ts`
- Create: `src/application/authenticate.test.ts`
- Create: `src/infrastructure/firebase/firebase-auth-repository.ts`
- Create: `src/infrastructure/firebase/firebase-auth-repository.test.ts`
- Create: `src/application/session-manager.ts`
- Create: `src/application/session-manager.test.ts`

**Interfaces:**
- Produces `AuthRepository` methods `signUpWithEmail`, `signInWithEmail`, `signInWithGoogle`, `signOut`, `getCurrentUser`, and `onAuthStateChanged`.
- Produces `SessionManager implements UserSessionRepository`; returns authenticated UID when available, otherwise delegates to `GuestSessionRepository`.

- [ ] Write failing tests for provider delegation, Firebase-user precedence, Guest fallback, and no cloud-profile reset on a repeat sign-in.
- [ ] Implement the interfaces/use cases and Firebase adapter; seed a missing cloud profile only, with Google name or `Learner`.
- [ ] Run and inspect focused tests: `pnpm test -- src/application/authenticate.test.ts src/application/session-manager.test.ts src/infrastructure/firebase/firebase-auth-repository.test.ts`.

### Task 2: Compose authenticated adapters and route revalidation

**Files:**
- Modify: `src/app/learner-repositories.ts`
- Modify: `src/app/router.ts`
- Modify: `src/app/learner-repositories.test.ts`

**Interfaces:**
- Consumes Task 1 `SessionManager` and Firebase Auth adapter.
- Produces existing learner repository interfaces that select Firebase for authenticated sessions and local adapters otherwise.

- [ ] Write failing tests that authenticate/switch session and prove progress/profile calls select Firebase, while sign-out returns to local adapters.
- [ ] Wire `SessionManager` into app composition; subscribe to auth changes and revalidate the router without introducing Firebase imports in features.
- [ ] Run and inspect focused tests: `pnpm test -- src/app/learner-repositories.test.ts src/app`.

### Task 3: Course List authentication modal

**Files:**
- Create: `src/features/auth/AuthModal.tsx`
- Create: `src/features/auth/AuthModal.test.tsx`
- Modify: `src/features/course/CourseListPage.loader.ts`
- Modify: `src/features/course/CourseListPage.tsx`
- Modify: `src/features/course/CourseListPage.test.tsx`

**Interfaces:**
- Consumes Task 1 application use cases through injected handlers and active session/profile loader data.
- Produces a Guest `Sign in` modal and authenticated display-name / Sign out control.

- [ ] Write failing component/loader tests for email sign-in, create-account toggle, Google action, modal error, authenticated header, and sign-out returning to Guest presentation.
- [ ] Implement the modal and header state; revalidate after successful auth transitions; retain the Guest name editor only in Guest mode.
- [ ] Run and inspect focused tests: `pnpm test -- src/features/auth/AuthModal.test.tsx src/features/course/CourseListPage.test.tsx src/features/course/CourseListPage.loader.test.ts`.

### Task 4: Documentation and final verification

**Files:**
- Modify: `docs/PROGRESS.md`
- Modify: `docs/COMPLETE-LOG.md`

- [ ] Update status only after all tests pass; explicitly record that Guest migration remains deferred.
- [ ] Run and inspect: `pnpm test`, `pnpm build`, `pnpm lint`.
- [ ] Provide the user-owned Firebase console checklist: enable Email/Password and Google, configure consent screen, add authorised domains.

## Self-Review

- Tasks 1–3 cover every spec acceptance criterion; Task 4 owns status and user-owned setup.
- The existing `UserSessionRepository` contract remains the only session dependency of learner composition.
- Review focus failure modes each have an owning test task.
- Migration is excluded from every task and no plan step calls a Guest repository from an authenticated write path.
