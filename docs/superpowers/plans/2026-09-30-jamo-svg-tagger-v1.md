# Jamo SVG Tagger v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a development-only Pretendard 600 Jamo SVG Tagger with durable review storage for a bounded reference queue.

**Architecture:** Node-only tooling generates a fingerprinted choseong-sharded source cache and owns manifest/shard persistence behind `ReviewStore` and `QueueStore`. A Vite development plugin exposes that tooling to a lazy-loaded React route; the route displays and edits ordered ownership, validates it, and never enters production bundles.

**Tech Stack:** React 19, TypeScript, Vite dev middleware, `opentype.js`, Node `crypto`/filesystem APIs, Vitest.

**Spec:** `docs/research/JAMO_SVG_TAGGER_DESIGN.md`

## Global Constraints

- Use only `src/assets/fonts/pretendard-latin-600-normal.ttf` as source geometry.
- Keep all Tagger code and routes development-only; do not touch Canvas/lesson/review/typing production systems.
- Review records are committed choseong shards; cache is generated and ignored.
- Do not implement all-Hangul tagging, automatic splitting, or a runtime dataset compiler.
- Use the existing six verified PoC references; `하` is `ㅏ: contour 1`, `ㅎ: contours 2–4`.
- Do not create commits automatically or use a new worktree.

## Review Focus

- Font, extraction, or source-outline identity changes must block approval/save as stale rather than reusing reviews.
- A save based on a stale shard revision must report conflict without overwriting another reviewer's record.
- `하`'s combined counter contours must retain `evenodd` transparency.
- `값` must use only the constrained audited source-command recipe and reconstruct with no lost source contour.
- A malformed review must not become approved even if the UI submits an approval request.

### Task 1: Tagger domain contracts, extraction, and constrained recipe compiler

**Files:**
- Create: `tools/jamo-svg/types.ts`, `tools/jamo-svg/extract.ts`, `tools/jamo-svg/compile.ts`
- Test: `tools/jamo-svg/compile.test.ts`

- [ ] Write failing compiler/validator tests for verified `하`, `값`, malformed ownership, and source-hash mismatch.
- [ ] Run the focused test and confirm it fails because the modules do not exist.
- [ ] Implement immutable TTF extraction, deterministic SVG normalization/hashing, physical step derivation, and only the fixed `값` source-command recipe compiler.
- [ ] Run the focused test and confirm it passes.

### Task 2: Cache generator and sharded review/queue stores

**Files:**
- Create: `tools/jamo-svg/cache.ts`, `tools/jamo-svg/review-store.ts`, `tools/jamo-svg/seed.ts`, `tools/jamo-svg/cache.test.ts`, `tools/jamo-svg/review-store.test.ts`
- Modify: `.gitignore`, `package.json`

- [ ] Write failing tests for cache manifest/checksums, choseong routing, stale fingerprints, deterministic shard output, and checksum conflicts.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement generated cache, versioned manifests, temporary-file atomic writes, independent `ReviewStore`/`QueueStore`, and seed data/queue.
- [ ] Add cache ignore rule and a cache-generation command.
- [ ] Run focused tests and confirm they pass.

### Task 3: Development API and isolated route

**Files:**
- Create: `tools/jamo-svg/vite-plugin.ts`, `src/features/dev-jamo-svg-tagger/*`
- Modify: `vite.config.ts`, `src/app/router.ts`

- [ ] Write focused request-handler tests for load/save/approve conflict and stale responses.
- [ ] Run them and confirm expected failure.
- [ ] Implement development-only Vite endpoints and the lazy development route: queue, search/navigation, source/contour/step views, ownership controls, split recipe visibility, colored/monochrome/overlay views, validation, save and approval actions.
- [ ] Run focused tests and confirm they pass.

### Task 4: End-to-end seed validation and documentation

**Files:**
- Modify: `docs/research/JAMO_SVG_TAGGER_DESIGN.md`, `docs/COMPLETE-LOG.md`
- Test: `tools/jamo-svg/tagger.integration.test.ts`

- [ ] Write failing integration tests that generate/load cache and validate/save the `가`, `하`, and `값` references, including a simulated stale/conflict condition.
- [ ] Run the test and confirm expected failure.
- [ ] Complete only implementation details that the failing integration test exposes; document material operational details, not a redesigned architecture.
- [ ] Run integration and full relevant test suite; manually inspect the dev page.
