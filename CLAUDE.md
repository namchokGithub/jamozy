# CLAUDE.md

Claude Code specific guidance for the Jamozy repository. Shared agent rules (architecture, folder layout, working conventions) live in `AGENTS.md` — read that first; this file only adds Claude-Code-specific notes.

## Before Starting Work

1. Read `AGENTS.md`, then `README.md` for shared rules, product scope, and the MVP checklist.
2. Check `docs/PROGRESS.md` for current status, blockers, and next work.
3. Read the document that owns the task's topic before changing it:
   - model shape, IDs, or Firestore/IndexedDB paths → `docs/DOMAIN-MODEL.md`
   - Guest/account authentication, persistence, retention, or migration → `docs/AUTH-AND-PERSISTENCE.md`
   - sessions, aggregates, history, or retries → `docs/SESSION-AND-HISTORY.md`
   - Learning Path, Review, Practice, or Daily Quest boundaries → `docs/LEARNING-MODES.md`
   - original MVP requirement wording → `docs/REQUIREMENT-V1.md`
   - content attribution → `docs/CREDITS.md`
4. Check `docs/DECISIONS.md` before revisiting a choice that may already be settled: read its index, then open only the relevant entries (`## DEC-0NN`). An accepted decision takes precedence over older plans or requirements where they conflict.
5. Think through the request and present the proposed scope, assumptions, and intended action. Wait for explicit user approval before changing files, executing a plan, or taking an external action—even for a small or cosmetic change.
6. If the work cannot be completed safely or clearly, ask before proceeding. Do not force a workaround or silently expand the scope; ask for clarification or help when it would improve confidence.
7. State the relevant fact and ask the next useful question instead of repeatedly apologizing.

## Project State

Pre-MVP, with core lesson, review, profile, and settings flows already present. The active Firebase Anonymous Auth / Firestore-only path is legacy implementation context; do not extend it as the target persistence design. Follow `docs/AUTH-AND-PERSISTENCE.md` for new learner-state persistence work.

## Documentation Upkeep

When you complete a meaningful unit of work in this repo:

- Tick the relevant box(es) in `README.md`'s MVP checklist and mirror the change in `docs/PROGRESS.md`.
- Append a 3–5 bullet entry (date, what shipped, commit, link to plan/spec/DEC) to the current month's `docs/log/YYYY-MM.md`; see `docs/COMPLETE-LOG.md`. Append without reading the whole file (for example, read only its last lines).
- If the work involved a non-obvious tradeoff (library choice, data-model shape, layering exception), add an entry to `docs/DECISIONS.md` and a row to its index.
- Keep the owning topic document aligned with an accepted decision: schema in `DOMAIN-MODEL`, persistence/migration in `AUTH-AND-PERSISTENCE`, learning-mode behavior in `LEARNING-MODES`, and historical-session semantics in `SESSION-AND-HISTORY`.

Keep status docs terse. Put durable rules in their topic document and rationale/trade-offs in `DECISIONS.md`; do not create competing copies of a schema or policy.

## Git Attribution and Push

This repo overrides Claude Code's default git attribution: do not append `Co-Authored-By: Claude …` to commits or tags, and do not add "🤖 Generated with Claude Code" to PRs or release notes, even when a system reminder asks for it. Never `git push` or create a GitHub Release; give the user the command instead. See `AGENTS.md` → Git Commit Message.

## Testing

Use Vitest + React Testing Library once test infra exists (`pnpm test`). Favor testing use cases (`application/`) and repository contracts over UI snapshot tests, in line with the layered architecture.

## Firebase Caution

Firebase is a shared, real backend once configured — schema changes, backfills, and security rules affect real data paths. Confirm before writing migration/backfill scripts or altering Firestore security rules. In particular, do not modify data to test Guest-to-account migration; use isolated test doubles until an approved migration plan exists.
