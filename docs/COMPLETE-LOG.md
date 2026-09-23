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
