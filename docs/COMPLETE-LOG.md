# Completion Log

Chronological log of completed units of work. One entry per meaningful change (not every commit). Newest at the bottom.

---

### 2026-09-23 — Repository initialized

- Initial commit (`877bb19`).
- README written: product overview, core features, learning flow, tech stack, architecture, folder structure, theme direction, Firestore data model, MVP checklist, development principles (`dae2c7e`).
- `.gitignore` updated for standard Node/Vite project (`6e001de`).

### 2026-09-23 — Agent/project docs added

- Added `AGENTS.md` (shared agent instructions: architecture rules, commands, folder layout, working conventions).
- Added `CLAUDE.md` (Claude Code specific workflow notes, docs-upkeep rules).
- Added `docs/DECISIONS.md` (decision log, seeded with DEC-001..DEC-004 from README's stated design choices).
- Added `docs/PROGRESS.md` (MVP + Later + foundational-setup progress tracker).
- Added `docs/COMPLETE-LOG.md` (this file).

### 2026-09-23 — Domain model spec added

- Added `docs/DOMAIN-MODEL.md`: field-level schema for Course/Unit/Lesson/Progress/ReviewItem, plus a tentative UserProfile shape and 4 open questions (EXP/Level storage, settings location, review scheduling, unlock rule) flagged for later decision.

### 2026-09-23 — Project scaffold

- Initialized `package.json`, installed React 19.3, Vite 7.3.6, TypeScript 5.9.3 (pinned to match README's documented majors), Tailwind CSS 4 (`@tailwindcss/vite`), React Router, Zustand, Firebase SDK, Zod, Motion, Lucide React.
- Added ESLint flat config (`eslint.config.js`) + Prettier (`.prettierrc.json`); `pnpm lint` passes.
- Added Vitest + React Testing Library (`src/test/setup.ts`); `pnpm exec vitest run` passes with a smoke test (`src/App.test.tsx`).
- Built `src/domain/models/{course,unit,lesson,progress,review-item}.ts` and `src/domain/repositories/{course,lesson,progress,review}-repository.ts` per `docs/DOMAIN-MODEL.md`.
- Created empty `src/application/`, `src/infrastructure/firebase/{repositories,mappers}/`, `src/features/{lesson,course,review}/` directories, left unfilled pending Firebase wiring and the open decisions in `docs/DOMAIN-MODEL.md`.
- Verified `pnpm build`, `pnpm lint`, `pnpm exec vitest run` all pass.
- Recorded `docs/DECISIONS.md` DEC-005: pinned `@vitejs/plugin-react` to `5.2.0` (latest `6.x` requires Vite 8, breaking the README-pinned Vite 7).
- Not yet committed to git.

### 2026-09-23 — Firebase SDK wired

- User created the `jamozy` Firebase project and provided `.env.local`. Fixed: values used `NEXT_PUBLIC_*` prefix (Next.js convention) — Vite only exposes `VITE_*` to client code, renamed all keys.
- Added `src/vite-env.d.ts` with a typed `ImportMetaEnv` for the `VITE_FIREBASE_*` vars.
- Added `src/infrastructure/firebase/firebase.ts`: `initializeApp`, exported `auth`/`db`, `signInAnonymouslyIfNeeded()`, optional emulator connection gated on `VITE_FIREBASE_USE_EMULATOR`.
- Added `.env.example` (committed) mirroring the required `VITE_FIREBASE_*` keys; updated `README.md` env block to include `VITE_FIREBASE_USE_EMULATOR`.
- Added smoke test `src/infrastructure/firebase/firebase.test.ts`; `pnpm build`, `pnpm lint`, `pnpm exec vitest run` all pass.
- `.env.local` is still missing `VITE_FIREBASE_MESSAGING_SENDER_ID`/`VITE_FIREBASE_APP_ID` — needs a Web App registered under the Firebase project.

### 2026-09-23 — Firebase console setup + repository implementations

- User enabled Anonymous Auth provider and created the Firestore database in the `jamozy` Firebase project console.
- Implemented `src/infrastructure/firebase/repositories/{firebase-course,firebase-lesson,firebase-progress,firebase-review}-repository.ts` against the four `domain/repositories` interfaces.
- Added `src/infrastructure/firebase/mappers/{lesson,progress}-mapper.ts` (Firestore Timestamp ↔ Date conversion, per README's folder structure).
- `pnpm build`, `pnpm lint`, `pnpm exec vitest run` all pass.
- Not yet exercised against real data — no seed course/unit/lesson content, and no `application/` use cases call these repositories yet.

### 2026-09-23 — Resolved DOMAIN-MODEL.md open questions

- User answered all 4 open questions: EXP/Level derived from `exp` (not stored), Settings as a field on `users/{userId}`, spaced repetition (Leitner boxes) for review scheduling, sequential unlock (previous lesson completed → next unlocked).
- Recorded `docs/DECISIONS.md` DEC-006 (derived level), DEC-007 (settings location), DEC-008 (Leitner scheduling), DEC-009 (sequential unlock rule). Updated `docs/DOMAIN-MODEL.md` to close out the Open Questions section.
- Added `src/domain/models/user-profile.ts` (`UserProfile`, `UserSettings`, `levelFromExp`).
- Extended `src/domain/models/review-item.ts` with `box`/`nextReviewAt` fields and `nextBox`/`nextReviewDate` pure functions.
- Changed `ReviewRepository.markResolved(userId, itemId)` → `updateReviewItem(userId, item)` (generic persist, since spaced repetition needs to write `box`/`nextReviewAt`/`resolved` together); updated `FirebaseReviewRepository` to match.
- Added unit tests for `nextBox`, `nextReviewDate`, `levelFromExp`. `pnpm build`, `pnpm lint`, `pnpm exec vitest run` all pass (9 tests).
