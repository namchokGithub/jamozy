# Admin Content Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure `/admin` back office for one Google-authenticated owner to manage Draft, Published, and Archived Course, Unit, Lesson, and text Exercise content.

**Architecture:** Learner repositories remain published-only reads. A separate `AdminContentRepository` plus application use cases provide all-state reads and writes for `/admin` React Router loaders/actions. Firebase custom claims and Firestore Rules are the authorization boundary; route guards provide only the user experience boundary.

**Tech Stack:** React 19, TypeScript, React Router 8, Firebase Auth/Firestore, Firebase Admin SDK one-off scripts, Firestore Rules Emulator, Zod, Vitest, React Testing Library, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-09-29-admin-content-management-design.md`

## Global Constraints

- Admin BO lives at `/admin` in the existing application; do not create a separate host, API server, or Cloud Function.
- Only the owner Google account with Firebase custom claim `admin: true` may access/write admin content.
- Content status is exactly `draft`, `published`, or `archived`; all new content begins `draft`.
- Course, Unit, and Lesson IDs are immutable; Exercise IDs remain stable inside their parent Lesson.
- Exercises may be added, edited, and reordered, but not individually deleted or archived in v1; archive their containing Lesson instead.
- Learners may read only published nodes whose ancestors are published; non-admin content writes are always denied by Firestore Rules.
- Published Lesson edits go live immediately; no revision/version system or hard deletion in v1.
- Archive never writes learner data and must preserve the state required for restore.
- Exercise content is text only; do not add Firebase Storage, media fields, import/export, sound, or dark-theme work.
- UI components do not import Firebase directly. Follow UI → application → repository interface → infrastructure direction.
- Use existing `Modal`, `SnackbarProvider`, `PageSurface`, `Card`, `Button`, and `Dropdown`; no animation.

## Review Focus

- A non-admin uses the browser SDK directly to read a Draft/Archived document or write a Published document; Rules must deny both. Covered in Task 2 Rules Emulator tests.
- A published Lesson's parent is archived; the learner query/direct lookup must not expose the child. Covered in Task 1 learner repository and Task 2 Rules tests.
- An admin archives then restores a Draft node; it must restore as Draft, not Published. Covered in Task 3 lifecycle tests.
- An admin tries to publish a Lesson with no Exercises or unpublished parents; the action must retain form data and return a structured error. Covered in Task 3 use-case and Task 6 action tests.
- Existing content lacks status when Rules change; migration must publish every existing Course/Unit/Lesson before restrictive Rules deploy. Covered in Task 7 migration dry-run/fixture test and deployment checklist.

---

## File Structure

| Area | Files | Responsibility |
| --- | --- | --- |
| Content state | `src/domain/models/content-status.ts`, Course/Unit/Lesson models and Firebase mappers | Shared status types, archive restore source, document mapping. |
| Learner reads | Existing course/lesson repository interfaces, Firebase adapters, application tests | Filter learner content to published visibility only. |
| Admin authorization | `AdminAuthRepository`, Firebase adapter, `/admin` guard, Rules, provisioning script | Resolve token claim for route UX and enforce it in Firestore. |
| Admin data path | `AdminContentRepository`, Firebase adapter, use cases, fakes, tests | CRUD, lifecycle, validation, and ordering through clean layers. |
| Admin feature | `src/features/admin/*`, router | List/editor routes, actions, and shared UI feedback. |
| Operations | status migration/provisioning scripts, indexes, README/PROGRESS/DECISIONS | Safely introduce status fields and document operator steps. |

### Task 1: Add content status and protect learner reads

**Files:**
- Create: `src/domain/models/content-status.ts`, `src/domain/models/content-status.test.ts`
- Modify: `src/domain/models/course.ts`, `src/domain/models/unit.ts`, `src/domain/models/lesson.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-course-repository.ts`, `src/infrastructure/firebase/repositories/firebase-lesson-repository.ts`, `src/infrastructure/firebase/mappers/lesson-mapper.ts`
- Modify: relevant Firebase repository tests, `src/application/get-course.test.ts`, `src/application/get-lesson.test.ts`, `firestore.indexes.json`

**Interfaces:**
- Produces `ContentStatus`, `ContentStatusFields`, `isPublishedContent()` and model fields `status`, `archivedFromStatus`.
- Learner repository methods retain their current signatures and return only content allowed to learners.

- [ ] **Step 1: Write the failing domain tests**

Assert new content starts as `draft`; archiving Draft records `archivedFromStatus: 'draft'`; archiving Published records `'published'`; restore uses that value.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/domain/models/content-status.test.ts`

Expected: FAIL because the status model/helpers do not exist.

- [ ] **Step 3: Implement content status and add fields to Course, Unit, and Lesson**

Use `type ContentStatus = 'draft' | 'published' | 'archived'`; preserve optional mapper fallback only during the migration window, never as a permanent learner-visible default.

- [ ] **Step 4: Write failing Firebase repository tests for published-only learner reads**

Assert list queries constrain `status == 'published'` and retain sibling `order`; assert unpublished direct Course/Lesson lookup is not found.

- [ ] **Step 5: Implement published-only mapper/repository behavior and indexes**

Add status-aware mapper fields and query predicates. Add required status-plus-order composite indexes without removing index entries needed by unchanged queries.

- [ ] **Step 6: Run focused verification**

Run: `pnpm exec vitest run src/domain/models/content-status.test.ts src/application/get-course.test.ts src/application/get-lesson.test.ts && pnpm exec tsc -b`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/models src/infrastructure/firebase firestore.indexes.json src/application
git commit -m "feat(content): add publication status to learner content"
```

### Task 2: Enforce owner-only admin access with claims and Firestore Rules

**Files:**
- Create: `src/domain/repositories/admin-auth-repository.ts`, `src/infrastructure/firebase/firebase-admin-auth-repository.ts`, and tests
- Create: `scripts/set-admin-claim.ts`, `scripts/set-admin-claim.test.ts`, `firestore.rules.test.ts`
- Modify: `firestore.rules`, `package.json`, `.env.example`, `README.md`

**Interfaces:**
- Produces `AdminAuthRepository.isCurrentUserAdmin(): Promise<boolean>`.
- Provisioning accepts one Firebase Auth UID and sets `{ admin: true }`.
- Later `/admin` loaders consume the repository; Rules use the equivalent token claim.

- [ ] **Step 1: Write failing claim-resolution adapter tests**

Assert false without Firebase user, false without `admin: true`, and true only for a token with `admin: true`.

- [ ] **Step 2: Run the adapter test to verify it fails**

Run: `pnpm exec vitest run src/infrastructure/firebase/firebase-admin-auth-repository.test.ts`

Expected: FAIL because the repository does not exist.

- [ ] **Step 3: Implement `AdminAuthRepository` and Firebase token-claim adapter**

Use the Firebase client token-result API in infrastructure only. Route code receives the interface, never Firebase Auth objects.

- [ ] **Step 4: Add failing Firestore Rules Emulator tests**

Cover admin reads/writes all states; learner reads published; learner cannot read Draft/Archived or a published child below archived parent; non-admin cannot write content.

- [ ] **Step 5: Implement Rules and Emulator configuration**

Add an admin claim helper and published-ancestor checks. Add only testing dependencies/configuration needed for local/CI Rules Emulator tests.

- [ ] **Step 6: Write a failing claim-script test, then implement the script**

With a mocked Admin Auth dependency, assert `setCustomUserClaims(uid, { admin: true })` and reject a missing UID. Document the local credential variable.

- [ ] **Step 7: Run focused verification**

Run: `pnpm exec vitest run src/infrastructure/firebase/firebase-admin-auth-repository.test.ts scripts/set-admin-claim.test.ts firestore.rules.test.ts`

Expected: PASS with the documented Emulator command.

- [ ] **Step 8: Commit**

```bash
git add firestore.rules firestore.rules.test.ts src/domain/repositories/admin-auth-repository.ts src/infrastructure/firebase scripts/set-admin-claim.ts package.json .env.example README.md
git commit -m "feat(admin): enforce content access with Firebase claims"
```

### Task 3: Build the admin content repository and lifecycle use cases

**Files:**
- Create: `src/domain/repositories/admin-content-repository.ts`, `src/application/admin-content.ts`, tests
- Create: `src/infrastructure/firebase/repositories/firebase-admin-content-repository.ts`, tests
- Modify: `src/test/fakes.ts`

**Interfaces:**
- Produces all-state reads and commands: create/update Course/Unit/Lesson, save Exercise arrays, publish, archive, restore, and move sibling up/down.
- Consumes `AdminContentRepository`; UI actions in Tasks 4–6 consume application functions only.

- [ ] **Step 1: Write failing application tests for publish validation**

Cover: zero Exercises cannot publish; Draft/Archived parent cannot publish; valid Lesson with published parents can publish.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/application/admin-content.test.ts`

Expected: FAIL because use cases and repository interface do not exist.

- [ ] **Step 3: Define repository and implement validation/lifecycle use cases**

Use Zod for form validation. Archive writes `archivedFromStatus`; restore clears it and restores that exact status. Never write user collections.

- [ ] **Step 4: Add failing tests for ordering and archive behavior**

Assert swapping a middle Unit/Lesson changes only adjacent orders; archiving parent does not mutate child statuses; restoring Draft remains Draft.

- [ ] **Step 5: Implement Firebase admin-content repository transactions**

Create IDs through Firestore document references, append siblings at highest order plus one, and swap adjacent sibling orders transactionally. Preserve `createdAt`, update `updatedAt`, map status fields.

- [ ] **Step 6: Run focused verification**

Run: `pnpm exec vitest run src/application/admin-content.test.ts src/infrastructure/firebase/repositories/firebase-admin-content-repository.test.ts && pnpm exec tsc -b`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/domain/repositories/admin-content-repository.ts src/application/admin-content.ts src/infrastructure/firebase/repositories/firebase-admin-content-repository.ts src/test/fakes.ts
git commit -m "feat(admin): add content lifecycle use cases"
```

### Task 4: Add admin guard, dashboard, and Course management

**Files:**
- Create: `src/features/admin/AdminGuard.loader.ts`, `AdminDashboardPage.tsx`, `AdminDashboardPage.loader.ts`, `AdminDashboardPage.action.ts`, `CourseEditorPage.tsx`, loaders/actions/tests
- Modify: `src/app/router.ts`, `src/app/RouteError.tsx` if an Unauthorized state needs explicit rendering

**Interfaces:**
- Consumes Task 2 `AdminAuthRepository` and Task 3 application functions.
- Produces protected `/admin` and `/admin/courses/:courseId` routes for Tasks 5–6.

- [ ] **Step 1: Write failing guard loader tests**

Assert unauthenticated/non-admin callers receive Unauthorized without calling admin content reads; an admin can load dashboard.

- [ ] **Step 2: Run guard tests to verify they fail**

Run: `pnpm exec vitest run src/features/admin/AdminGuard.loader.test.ts`

Expected: FAIL because admin routes do not exist.

- [ ] **Step 3: Implement guard and router wiring**

Use a parent `/admin` loader or composable guard dependency; navigation visibility is never authorization.

- [ ] **Step 4: Write failing dashboard/Course action tests**

Assert admin list includes all statuses, Create Course starts Draft, and Publish/Archive return structured snackbar outcomes rather than replacing pages with RouteError.

- [ ] **Step 5: Implement dashboard and Course editor**

Use existing UI primitives. Include course form, status filter, create control, Move Up/Down, Publish/Archive/Restore confirmation, and snackbar feedback; add no new primitive.

- [ ] **Step 6: Run focused verification**

Run: `pnpm exec vitest run src/features/admin/AdminGuard.loader.test.ts src/features/admin/AdminDashboardPage.test.tsx src/features/admin/CourseEditorPage.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin src/app/router.ts src/app/RouteError.tsx
git commit -m "feat(admin): add protected course management"
```

### Task 5: Add Unit and Lesson listing management

**Files:**
- Create: `src/features/admin/UnitEditorPage.tsx`, loader/action/tests
- Modify: `src/features/admin/CourseEditorPage.tsx`, `src/app/router.ts`

**Interfaces:**
- Consumes Task 3 Unit/Lesson commands and Task 4 route guard.
- Produces `/admin/units/:unitId` and Draft Lesson creation/navigation for Task 6.

- [ ] **Step 1: Write failing Unit editor tests**

Assert admin creates Draft Unit under Course, sees all Lesson statuses, and moving a Lesson changes sibling order only.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/features/admin/UnitEditorPage.test.tsx`

Expected: FAIL because Unit editor route does not exist.

- [ ] **Step 3: Implement Unit editor loader/action/page and route**

Reuse Course editor status controls. Unit archive/restore affects learner visibility through parent status only and does not rewrite Lesson documents.

- [ ] **Step 4: Add and run failed parent/status action coverage**

Assert failed save/publish returns structured error and preserves editable fields.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/UnitEditorPage* src/features/admin/CourseEditorPage.tsx src/app/router.ts
git commit -m "feat(admin): manage units and lesson ordering"
```

### Task 6: Add Lesson and embedded Exercise authoring

**Files:**
- Create: `src/features/admin/LessonEditorPage.tsx`, loader/action/tests
- Modify: `src/app/router.ts`

**Interfaces:**
- Consumes Task 3 Lesson save/publish lifecycle commands and Task 5 Lesson navigation.
- Produces complete text Exercise authoring at `/admin/lessons/:lessonId`.

- [ ] **Step 1: Write failing Lesson editor tests**

Assert adding/reordering Exercises preserves IDs, validates blank `targetText`, and blocks Publish until a valid Exercise exists with published parents.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/features/admin/LessonEditorPage.test.tsx`

Expected: FAIL because the Lesson editor route does not exist.

- [ ] **Step 3: Implement Lesson editor loader/action/page and route**

Render existing Exercise fields: target text, romanization, Thai/English meaning, difficulty, and hint. Keep Exercise order in the Lesson document. Published saves go live; Archive/Restore/Publish use Modal and Snackbar.

- [ ] **Step 4: Run focused verification**

Run: `pnpm exec vitest run src/features/admin/LessonEditorPage.test.tsx src/features/admin/UnitEditorPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/LessonEditorPage* src/app/router.ts
git commit -m "feat(admin): author published lesson exercises"
```

### Task 7: Migrate existing content and finish operator documentation

**Files:**
- Create: `scripts/migrate-content-status.ts`, `scripts/migrate-content-status.test.ts`
- Modify: `package.json`, `.env.example`, `README.md`, `docs/DOMAIN-MODEL.md`, `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/COMPLETE-LOG.md`

**Interfaces:**
- Produces an idempotent migration that sets statusless Course/Unit/Lesson documents to `published` and never accesses `users/*`.

- [ ] **Step 1: Write failing migration tests with an in-memory Admin Firestore double**

Assert statusless Course/Unit/Lesson documents receive `published`; existing statuses remain; user documents are never queried/written; second run makes no extra changes.

- [ ] **Step 2: Run the migration test to verify it fails**

Run: `pnpm exec vitest run scripts/migrate-content-status.test.ts`

Expected: FAIL because migration does not exist.

- [ ] **Step 3: Implement idempotent migration and package script**

Require explicit dry-run before real writes. Share Admin SDK bootstrap with claim provisioning only if credentials never reach application code.

- [ ] **Step 4: Update operator and architecture documents**

Document claim provision, migration dry-run/write, index/rules deploy order, status model, and accepted policy. Update PROGRESS/COMPLETE-LOG only after verification.

- [ ] **Step 5: Run final verification**

Run: `pnpm test -- --run && pnpm lint && pnpm build && git diff --check`

Expected: all pass. Manually run the Emulator and the browser acceptance flow before production Rules deployment.

- [ ] **Step 6: Commit**

```bash
git add scripts package.json .env.example README.md docs firestore.indexes.json firestore.rules
git commit -m "chore(admin): document and migrate content publication"
```
