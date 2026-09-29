# AGENTS.md

Instructions for AI coding agents working in the Jamozy repository. Applies to any agent/tool (Claude Code, Codex, Cursor, etc.). Claude Code additionally reads `CLAUDE.md`.

## Project Summary

Jamozy is a web-based Korean typing learning app (Hangul + Korean keyboard practice). Read `README.md` first for product scope, MVP checklist, and theme direction. Use the document map below for detailed rules; do not duplicate those specifications here.

Status: early development, pre-MVP. The existing app implements the core lesson, review, profile, and settings flows on a legacy Firebase Anonymous Auth / Firestore path. The target Guest IndexedDB + authenticated Firebase architecture is documented but not yet implemented.

## Tech Stack (quick reference)

React 19 + TypeScript + Vite, Tailwind CSS 4, React Router, Zustand, Firebase, Zod, Motion, Lucide React, Vitest + React Testing Library, ESLint + Prettier, pnpm, Cloudflare Pages.

Firebase Anonymous Auth is legacy implementation context. The target account model is Guest IndexedDB persistence plus Firebase Email/password and Google Sign-In; see `docs/AUTH-AND-PERSISTENCE.md`.

## Commands

```bash
pnpm install
pnpm dev
pnpm build
pnpm test
```

(Lint/format/typecheck scripts will be added once tooling is scaffolded — check `package.json` before assuming a script name.)

## Architecture Rules

Jamozy follows a layered/clean architecture. Respect the direction of dependency:

```
UI / Pages
   ↓
Application / Use Cases
   ↓
Repository Interfaces
   ↓
Local Guest Repositories (IndexedDB) | Firebase Repositories (Firestore)
```

Folder layout (see `README.md` for the full tree):

```
src/
├── domain/          # models + repository interfaces, no Firebase imports
├── application/      # use cases, orchestrate domain + repositories
├── infrastructure/   # firebase/ and local/ — concrete repository implementations, mappers
└── features/          # UI: lesson, course, review
```

Hard rules:

- Keep persistence access out of React UI components. Components call application use cases, never Firestore or IndexedDB directly.
- Access persisted data only through repository interfaces (`domain/repositories`), never through `infrastructure/firebase` or future local adapters directly from `features/`.
- Keep typing-session state (current keystroke, in-progress lesson) in client state (Zustand), not Firestore.
- Never write persisted learner state per keystroke. Persist submitted results only at meaningful checkpoints (lesson complete, session end).
- Keep learning content separate from learner state — do not merge them in a single document/model. The target collection paths and field schemas live in `docs/DOMAIN-MODEL.md`.
- Prefer small, focused features over speculative gamification or abstractions. No multiplayer/leaderboard/social code — out of MVP scope.

## Environment

Firebase config lives in `.env.local` (see `README.md` for required `VITE_FIREBASE_*` keys). Never commit `.env.local` or any file containing real Firebase project credentials.

## Working Conventions

- Don't add features, refactors, or abstractions beyond what's asked. This project favors small, focused, calm implementations (see README "Development Principles").
- When adding a new domain concept, add the model to `domain/models`, the interface to `domain/repositories`, the required persistence adapter(s), and an `application/` use case — don't skip layers. Target learner-state behavior must work through either Guest-local or authenticated-Firebase adapters.
- **Testing policy:** Do not create or update automated tests for UI-only work (visual styling, layout, presentation components, or page appearance); the user performs that verification manually. Add automated tests for domain, application, repository, persistence, security-rule, migration, and other non-visual logic. Only change a UI test when the user explicitly asks for it or a UI change also changes non-visual behavior.
- Run `pnpm test` before considering a logic/persistence/security change complete once a test setup exists. For UI-only changes, run the relevant static checks/build and hand off manual verification to the user.
- Record non-obvious architectural choices in `docs/DECISIONS.md`, not as scattered code comments. Update the authoritative topic document when a decision changes its model or policy.
- Track detailed implementation status in `docs/PROGRESS.md`. `README.md`
  carries the high-level MVP/post-MVP overview; keep its summary and roadmap
  aligned with material status changes.
- Log completed units of work in `docs/COMPLETE-LOG.md`.

## Document Map

- `README.md` — product overview, scope, theme, architecture overview, and MVP checklist.
- `docs/PROGRESS.md` — current implementation status, blockers, and next work; mirrors README's checklist.
- `docs/DOMAIN-MODEL.md` — authoritative target field-level schemas, identities, collection paths, and model constraints.
- `docs/LEARNING-MODES.md` — boundaries and shared-state rules for Learning Path, Review, Practice, and Daily Quest.
- `docs/AUTH-AND-PERSISTENCE.md` — Guest/authenticated session model, adapter selection, retention, and Guest-to-account merge policy.
- `docs/SESSION-AND-HISTORY.md` — `LearningSession` semantics, history versus learner state, retry identity, and aggregation boundary.
- `docs/DECISIONS.md` — accepted, superseded, and rejected architectural/product decisions; check this before reopening a settled choice.
- `docs/REQUIREMENT-V1.md` — source requirements for the original MVP; a later accepted decision takes precedence if they conflict.
- `docs/CREDITS.md` — content-source registry and attribution requirements.
- `docs/COMPLETE-LOG.md` — chronological record of meaningful completed work.
- `CLAUDE.md` — Claude Code-specific workflow additions.

## Data Fetching

- Use React Router loaders for route-owned persisted data.
- Route loaders must call application/use-case functions, not Firebase directly.
- Do not mirror loader data into Zustand.
- Use Zustand only for transient interactive session state such as typing input,
  current exercise, mistakes, timers, and in-progress accuracy.

## Git Commit Message

- For clear, small, low-risk changes within the current workspace, implement immediately.
- Do not ask for confirmation for cosmetic UI, copy, or styling changes when the requested scope is explicit.
- Ask first only when scope is ambiguous, an action is destructive or irreversible, adds dependencies, changes external services, or affects data outside the workspace.
- After completing code changes:
  - Summarize what changed.
  - List important files changed.
  - Mention any remaining concerns or follow-up work.
  - Suggest a concise Git commit message based on the actual changes.
  - Use Conventional Commits format when appropriate.
  - Never run `git commit` unless explicitly requested.

```
You are a senior software engineer reviewing git changes.

Your task:
Generate a high-quality commit message based ONLY on the relevant git changes.

Rules:

1. If staged changes exist (git diff --cached), use ONLY staged changes.
2. If no staged changes exist, use the regular git diff.
3. Never mix staged and unstaged changes.
4. Use Conventional Commit format.
5. Include scope if identifiable (e.g., invoice, payment, stock, auth, api).
6. If Jira keys appear in the diff, include them after the scope.
7. Keep subject line concise (<= 100 chars).
8. Focus on business impact, not syntax noise.
9. Ignore whitespace-only or formatting-only changes.

Output format:<type></type>feat(feature_name<scope></scope>): <short summary></short>

Example:
fix(payments): store payment payload as payments array only and keep backward-compatible parsing
```
