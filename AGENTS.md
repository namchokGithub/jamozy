# AGENTS.md

Instructions for AI coding agents working in the Jamozy repository. Applies to any agent/tool (Claude Code, Codex, Cursor, etc.). Claude Code additionally reads `CLAUDE.md`.

## Project Summary

Jamozy is a web-based Korean typing learning app (Hangul + Korean keyboard practice). See `README.md` for full product scope, tech stack, theme direction, and Firestore data model — do not duplicate that content here; read it first.

Status: early development, pre-MVP. No application code exists yet (`src/` has not been created).

## Tech Stack (quick reference)

React 19 + TypeScript + Vite, Tailwind CSS 4, React Router, Zustand, Firebase (Anonymous Auth + Firestore), Zod, Motion, Lucide React, Vitest + React Testing Library, ESLint + Prettier, pnpm, Cloudflare Pages.

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
Firebase Repositories
   ↓
Firestore
```

Folder layout (see `README.md` for the full tree):

```
src/
├── domain/          # models + repository interfaces, no Firebase imports
├── application/      # use cases, orchestrate domain + repositories
├── infrastructure/   # firebase/ — concrete repository implementations, mappers
└── features/          # UI: lesson, course, review
```

Hard rules:

- Keep Firebase access out of React UI components. Components call application use cases, never Firestore directly.
- Access persisted data only through repository interfaces (`domain/repositories`), never through `infrastructure/firebase` directly from `features/`.
- Keep typing-session state (current keystroke, in-progress lesson) in client state (Zustand), not Firestore.
- Never write to Firestore per keystroke. Persist lesson results only at meaningful checkpoints (lesson complete, session end).
- Keep learning content (`courses`, `units`, `lessons`) separate from user progress (`users/{userId}/...`) — do not merge them in a single document/model.
- Prefer small, focused features over speculative gamification or abstractions. No multiplayer/leaderboard/social code — out of MVP scope.

## Firestore Data Model

```
courses/{courseId}
units/{unitId}
lessons/{lessonId}

users/{userId}
users/{userId}/lessonProgress/{lessonId}
users/{userId}/reviewItems/{itemId}
```

## Environment

Firebase config lives in `.env.local` (see `README.md` for required `VITE_FIREBASE_*` keys). Never commit `.env.local` or any file containing real Firebase project credentials.

## Working Conventions

- Don't add features, refactors, or abstractions beyond what's asked. This project favors small, focused, calm implementations (see README "Development Principles").
- When adding a new domain concept, add the model to `domain/models`, the interface to `domain/repositories`, the Firebase implementation to `infrastructure/firebase/repositories`, and wire it through an `application/` use case — don't skip layers.
- Run `pnpm test` before considering a change complete once a test setup exists.
- Record non-obvious architectural choices in `docs/DECISIONS.md`, not as scattered code comments.
- Track MVP checklist status in `docs/PROGRESS.md` (mirrors the checklist in `README.md` — keep both in sync).
- Log completed units of work in `docs/COMPLETE-LOG.md`.

## Related Docs

- `README.md` — product overview, architecture, theme, Firestore model, MVP checklist
- `CLAUDE.md` — Claude Code specific workflow notes
- `docs/DECISIONS.md` — architecture decision log
- `docs/PROGRESS.md` — MVP progress tracker
- `docs/COMPLETE-LOG.md` — chronological log of completed work
- `docs/DOMAIN-MODEL.md` — field-level schema for Course/Unit/Lesson/Progress/ReviewItem/UserProfile

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
