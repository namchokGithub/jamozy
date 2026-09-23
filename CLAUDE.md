# CLAUDE.md

Claude Code specific guidance for the Jamozy repository. Shared agent rules (architecture, folder layout, working conventions) live in `AGENTS.md` — read that first; this file only adds Claude-Code-specific notes.

## Before Starting Work

1. Read `README.md` for product scope and current MVP checklist.
2. Read `AGENTS.md` for architecture rules and working conventions.
3. Check `docs/PROGRESS.md` for what's already done vs. still open.
4. Check `docs/DECISIONS.md` before revisiting a choice that may already be settled.

## Project State

Pre-MVP, no `src/` yet. Treat any task that scaffolds the app (Vite setup, Firebase init, first routes) as foundational — get confirmation on structure choices that aren't already dictated by `README.md`/`AGENTS.md` before generating a large number of files.

## Documentation Upkeep

When you complete a meaningful unit of work in this repo:

- Tick the relevant box(es) in `README.md`'s MVP checklist and mirror the change in `docs/PROGRESS.md`.
- Append an entry to `docs/COMPLETE-LOG.md` (date, what shipped, relevant commit).
- If the work involved a non-obvious tradeoff (library choice, data-model shape, layering exception), add an entry to `docs/DECISIONS.md`.

Keep these docs terse — status and rationale, not narrative.

## Testing

Use Vitest + React Testing Library once test infra exists (`pnpm test`). Favor testing use cases (`application/`) and repository contracts over UI snapshot tests, in line with the layered architecture.

## Firebase Caution

Firebase is a shared, real backend once configured — schema changes to `courses`/`units`/`lessons`/`users` collections affect real data paths. Confirm before writing migration/backfill scripts or altering Firestore security rules.
