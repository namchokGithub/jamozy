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
pnpm build      # tsc -b && vite build
pnpm test
pnpm lint
pnpm format
```

Check `package.json` before assuming any other script name.

### Jamo SVG tooling (development only)

The Jamo SVG Tagger (`/dev/jamo-svg-tagger`, served by `pnpm dev`) reviews
Pretendard 600 outlines into per-typed-key SVG paths. Review data lives in
`tools/jamo-svg/reviews/pretendard-600/`; the queue in
`tools/jamo-svg/queue/pretendard-600/queue.json`; the extraction cache in
`tools/jamo-svg/cache/` (gitignored, rebuilt by `jamo-svg:enqueue`).

```bash
pnpm jamo-svg:enqueue --top 2000      # add word-list syllables to the queue
pnpm jamo-svg:enqueue --words docs/informations/korean-inflection-sample.md --reason inflection-sample
pnpm jamo-svg:propose --dry-run       # propose reviews from approved templates
pnpm jamo-svg:propose --rank          # which unreviewed syllables unlock others
pnpm jamo-svg:audit                   # read-only audit of approved reviews
pnpm jamo-svg:compile-runtime         # approved reviews → public/jamo-svg runtime shards
```

- Commit review data before running a script that writes it
  (`enqueue`, `propose`, migrations). Use `--dry-run` first.
- `propose` never changes approved reviews; `--replace-reviewing` also
  overwrites unapproved `reviewing` drafts.
- Do not run `pnpm jamo-svg:seed` on existing data: it re-initializes the
  review manifest.
- After changing review logic, `tools/jamo-svg/approved-reviews.test.ts` and
  `pnpm jamo-svg:audit` must stay clean.
- After approving reviews, run `pnpm jamo-svg:compile-runtime` and commit the
  shards with the reviews; `runtime-dataset-committed.test.ts` fails otherwise.
  `VITE_JAMO_SVG_RENDERER=1` turns on the SVG target renderer (DEC-039).
  Before changing the runtime shard format, read "Maintaining the runtime
  dataset" in `docs/research/JAMO_SVG_TAGGER_DESIGN.md`.

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
- Never write persisted learner state per keystroke. Persist submitted results only at meaningful checkpoints (lesson complete, session end, or a completed Home exercise per DEC-043).
- Keep learning content separate from learner state — do not merge them in a single document/model. The target collection paths and field schemas live in `docs/DOMAIN-MODEL.md`.
- Prefer small, focused features over speculative gamification or abstractions. No multiplayer/leaderboard/social code — out of MVP scope.

## Environment

Firebase config lives in `.env.local` (see `README.md` for required `VITE_FIREBASE_*` keys). Never commit `.env.local` or any file containing real Firebase project credentials.

## Working Conventions

- **Agent collaboration and approval:** Think independently to understand the task, identify risks, and prepare a recommendation, but present that recommendation and wait for explicit approval before making changes, executing a plan, or taking an external action. Do not decide and act beyond the user's explicit scope.
- If work cannot be completed safely or clearly—because requirements, authority, access, consequences, or a technical constraint are unclear—ask first. Do not force a workaround that changes scope or assumptions.
- Ask for help, request clarification, or use available collaboration when it would improve confidence; do not carry uncertainty alone.
- State the relevant fact and ask the next useful question rather than repeatedly apologizing. Confirmation is more useful than an apology.
- Don't add features, refactors, or abstractions beyond what's asked. This project favors small, focused, calm implementations (see README "Development Principles").
- When adding a new domain concept, add the model to `domain/models`, the interface to `domain/repositories`, the required persistence adapter(s), and an `application/` use case — don't skip layers. Target learner-state behavior must work through either Guest-local or authenticated-Firebase adapters.
- **Testing policy:** Do not create or update automated tests for UI-only work (visual styling, layout, presentation components, or page appearance); the user performs that verification manually. Add automated tests for domain, application, repository, persistence, security-rule, migration, and other non-visual logic. Only change a UI test when the user explicitly asks for it or a UI change also changes non-visual behavior.
- Run `pnpm test` before considering a logic/persistence/security change complete once a test setup exists. For UI-only changes, run the relevant static checks/build and hand off manual verification to the user.
- Record non-obvious architectural choices in `docs/DECISIONS.md`, not as scattered code comments. Update the authoritative topic document when a decision changes its model or policy.
- Track detailed implementation status in `docs/PROGRESS.md`. `README.md`
  carries the high-level MVP/post-MVP overview; keep its summary and roadmap
  aligned with material status changes.
- Log completed non-UI units of work by appending a short entry to the current month's file, `docs/log/YYYY-MM.md` (rules in `docs/COMPLETE-LOG.md`). Do not update the completion log for UI-only visual, layout, or presentation changes. Do not read earlier months to add an entry.

## Document Map

- `README.md` — product overview, scope, theme, architecture overview, and MVP checklist.
- `docs/PROGRESS.md` — current implementation status, blockers, and next work; mirrors README's checklist.
- `docs/DOMAIN-MODEL.md` — authoritative target field-level schemas, identities, collection paths, and model constraints.
- `docs/LEARNING-MODES.md` — boundaries and shared-state rules for Learning Path, Review, Practice, and Daily Quest.
- `docs/AUTH-AND-PERSISTENCE.md` — Guest/authenticated session model, adapter selection, retention, and Guest-to-account merge policy.
- `docs/SESSION-AND-HISTORY.md` — `LearningSession` semantics, history versus learner state, retry identity, and aggregation boundary.
- `docs/DECISIONS.md` — accepted, superseded, and rejected architectural/product decisions; check this before reopening a settled choice. Read its index first and open only the entries you need.
- `docs/REQUIREMENT-V1.md` — source requirements for the original MVP; a later accepted decision takes precedence if they conflict.
- `docs/CREDITS.md` — content-source registry and attribution requirements.
- `docs/COMPLETE-LOG.md` — index of the monthly completion logs in `docs/log/`.
- `docs/research/JAMO_SVG_TAGGER_DESIGN.md` — Jamo SVG Tagger design: review records, split recipes, blockers, runtime-data boundary.
- `docs/research/HANGUL_SVG_ANALYSIS.md` — glyph-outline measurements behind the Tagger.
- `docs/informations/korean_words.txt` — Korean 5800 frequency list that feeds the Tagger queue.
- `docs/informations/korean-inflection-sample.md` — inflection/particle syllables the dictionary-form list lacks.
- `docs/superpowers/plans/` — implementation plans for completed and in-flight work.
- `CLAUDE.md` — Claude Code-specific workflow additions.

## Data Fetching

- Use React Router loaders for route-owned persisted data.
- Route loaders must call application/use-case functions, not Firebase directly.
- Do not mirror loader data into Zustand.
- Use Zustand only for transient interactive session state such as typing input,
  current exercise, mistakes, timers, and in-progress accuracy.

Git Releases

- git add package.json {{file_name}}
- git commit -m "chore(release): v{{version_no}}"
- git tag -a v{{version_no}}-m "v{{version_no}}"
- git push origin <branch></branch> && git push origin v{{version_no}}
- gh release create v{{version_no}} --prerelease --title "Jamozy v{{version_no}}" --{{file_name}}

## Git Commit Message

- Before making any change, present the proposed scope and wait for explicit user approval. This applies even to clear, small, low-risk, or cosmetic changes.
- Ask before proceeding whenever scope is ambiguous, an action is destructive or irreversible, adds dependencies, changes external services, affects data outside the workspace, or cannot be completed as requested.
- After completing code changes:
  - Summarize what changed.
  - List important files changed.
  - Mention any remaining concerns or follow-up work.
  - Suggest a concise Git commit message based on the actual changes.
  - Use Conventional Commits format when appropriate.
  - Never run `git commit` unless explicitly requested.
- Never add AI/agent attribution to commits, tags, pull requests, or release notes (for example `Co-Authored-By: Claude …` or "Generated with …"). GitHub counts co-author trailers as repository contributors, and a pushed trailer cannot be removed without rewriting history.
- Never run `git push` (branches, tags, or `--force`) or create a GitHub Release. Prepare the commit or tag locally, then hand the user the exact push/release command to run.

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
