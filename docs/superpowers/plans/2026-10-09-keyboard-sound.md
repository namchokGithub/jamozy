# Keyboard Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play the chosen mechanical-keyboard sound for every physical or virtual key typed in a lesson, review, Weak Jamo practice, or Home player when `UserSettings.soundEnabled` is on.

**Architecture:** The bundled source assets stay under `src/assets/audio`; a typed asset manifest supplies Vite-generated URLs to a module-level Web Audio player. A pure key mapper selects a pack-relative press/release file, while `useKeyboardSound` owns loading, browser unlocking, physical listeners, and virtual-key playback. The selected pack is a persisted `UserSettings` preference, with `turquoise` as the backward-compatible default.

**Tech Stack:** React 19, TypeScript, Vite asset imports, Web Audio API, React Router loaders, Zod, Vitest + React Testing Library.

**Spec:** User-confirmed requirements in this plan update (2026-10-09).

## Global Constraints

- Do not add a dependency or persist typing audio events.
- Keep sound playback transient and outside domain typing-session state.
- Use only `src/assets/audio/{turquoise,mxblack,mxblue}`; do not duplicate or move media to `public/`.
- Default existing and new users to `turquoise` (`Turquoise Tealio`) without requiring a migration.
- The Settings dropdown order is: `turquoise` — Turquoise Tealio; `mxblack` — Cherry MX Blacks; `mxblue` — Cherry MX Blues.
- Sound plays for correct and incorrect attempts alike; it must not encode correctness.
- Ignore repeated physical `keydown` events. Missing, loading, or undecodable audio must be a silent no-op and never throw.
- When sound is disabled, do not load audio or attach sound listeners.
- Do not update automated tests for visual-only presentation. Add focused tests for domain/persistence, audio behavior, and changed non-visual UI behavior; run focused tests plus `pnpm lint`, not the full test suite by default.

## Review Focus

- Legacy profile with no `keyboardSoundPack` receives and persists `turquoise` when Settings is next saved.
- Disabling sound before mount causes neither audio loading nor listener registration.
- A failed decode for one asset does not prevent another asset from playing.
- Holding a physical key produces one press sound, while virtual input produces a press and a delayed release.
- Home-content and Learning-Path fallback both receive the same loader-provided settings without delaying static Home content unnecessarily.

## File Structure

- `src/domain/models/user-profile.ts` — pack identifier, default, and validation.
- `src/application/get-settings.ts` and `src/infrastructure/firebase/repositories/firebase-user-profile-repository.ts` — normalize legacy settings that lack the new field.
- `src/features/settings/SettingsPage.tsx` — selected-pack dropdown beside the existing Sound toggle.
- `src/features/typing/keyboard-sound-assets.ts` — typed Vite URLs for all bundled pack files.
- `src/features/typing/keyboard-sound-map.ts` — pure physical-key to pack-file mapping.
- `src/infrastructure/audio/keyboard-sound-player.ts` — Web Audio buffer cache and playback.
- `src/features/typing/useKeyboardSound.ts` — sound lifecycle and physical/virtual entry points.
- `src/features/{lesson,review,home}/...` and `src/features/course/...` — pass settings into all active typing hosts.
- `docs/CREDITS.md`, `docs/DOMAIN-MODEL.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md`, and `docs/log/2026-10.md` — attribution and durable product/architecture status.

### Task 1: Model and normalize the selected sound pack

**Files:**
- Modify: `src/domain/models/user-profile.ts`
- Modify: `src/domain/models/user-profile.test.ts`
- Modify: `src/application/get-settings.ts`
- Modify: `src/application/get-settings.test.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-user-profile-repository.ts`
- Modify: `src/infrastructure/firebase/repositories/firebase-user-profile-repository.test.ts`
- Modify: `docs/DOMAIN-MODEL.md`

**Produces:** `KeyboardSoundPack = 'turquoise' | 'mxblack' | 'mxblue'` and a complete `UserSettings` object whose `keyboardSoundPack` is always defined.

- [ ] Add `KeyboardSoundPack`, `keyboardSoundPack` to `UserSettings`, and default it to `'turquoise'` in `defaultUserProfile`.
- [ ] Extend `userSettingsSchema` to accept only the three pack IDs.
- [ ] Add a shared domain normalizer that merges a missing `keyboardSoundPack` to `'turquoise'` while retaining every existing setting; never reset a profile or overwrite another preference.
- [ ] Use that normalizer in `getSettings` so legacy Guest IndexedDB profiles and test fakes receive a complete settings object, and in Firebase's `toUserProfile` mapper for legacy cloud profiles.
- [ ] Add focused tests for the default, accepted/rejected pack IDs, and a legacy persisted profile.
- [ ] Run the focused domain/repository tests and confirm they pass.
- [ ] Update the `UserSettings` table in `docs/DOMAIN-MODEL.md` with the field, allowed values, and default.

### Task 2: Add the Settings pack control

**Files:**
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/settings/SettingsPage.test.tsx`
- Modify: `src/features/settings/SettingsPage.action.test.ts`
- Modify: `src/features/settings/SettingsPage.loader.test.ts`
- Modify: affected `get-settings` / `update-settings` tests and fixtures

**Consumes:** `UserSettings.keyboardSoundPack` from Task 1.

- [ ] Add a `Keyboard sound` dropdown in the existing `Practice feel` section, retaining the existing Sound switch as the independent on/off control.
- [ ] Render options exactly in this order: `Turquoise Tealio` (`turquoise`), `Cherry MX Blacks` (`mxblack`), `Cherry MX Blues` (`mxblue`).
- [ ] Ensure a selected pack is included unchanged in the existing save request, even when sound is disabled.
- [ ] Update affected fixtures and focused tests to prove selection, save payload, and round-trip loader value behavior.
- [ ] Run the focused Settings/application tests and confirm they pass.

### Task 3: Create Vite asset manifest and key mapper

**Files:**
- Create: `src/features/typing/keyboard-sound-assets.ts`
- Create: `src/features/typing/keyboard-sound-map.ts`
- Create: `src/features/typing/keyboard-sound-map.test.ts`

**Produces:** `keyboardSoundAssets(pack: KeyboardSoundPack): Record<KeyboardSoundName, string>`, `pressSoundFor(code)`, and `releaseSoundFor(code)`.

- [ ] Import the existing MP3 files from `src/assets/audio` into a typed manifest. Include all 12 Turquoise files, all 12 MX Black files, and the six available MX Blue generic files; do not reference files the selected pack does not contain.
- [ ] Map Backspace, Enter/NumpadEnter, and Space to their dedicated names only when that pack supplies them. For MX Blue, fall back to its generic row sound on press and `GENERIC` on release.
- [ ] Map physical rows to `GENERIC_R0` through `GENERIC_R4`; unknown codes fall back to `GENERIC_R4`. Map non-special releases to `GENERIC`.
- [ ] Write failing mapper tests for dedicated Turquoise/MX Black keys, MX Blue fallback behavior, row representatives, unknown key fallback, and generic release behavior.
- [ ] Implement the pure mapper and run its focused test file until it passes.

### Task 4: Add the Web Audio player and hook

**Files:**
- Create: `src/infrastructure/audio/keyboard-sound-player.ts`
- Create: `src/infrastructure/audio/keyboard-sound-player.test.ts`
- Create: `src/features/typing/useKeyboardSound.ts`
- Create: `src/features/typing/useKeyboardSound.test.ts`

**Consumes:** asset manifest and mapper from Task 3.

**Produces:** `load(pack)`, `play(name)`, `unlock()`, and `useKeyboardSound({ enabled, pack })` returning `playVirtualKey(code)`.

- [ ] Write fake-`AudioContext`/`fetch` tests: each URL decodes once across repeated loads, play before readiness is a no-op, one failed resource does not block others, and `unlock()` resumes a suspended context.
- [ ] Implement a lazily created shared `AudioContext`; use a new `AudioBufferSourceNode` for every playback so fast typing can overlap.
- [ ] Write hook tests: enabled physical keydown/keyup maps to press/release, repeated keydown is ignored, disabled mode has no loads or listeners, unmount cleans up, and virtual key emits press then release after about 60 ms.
- [ ] Implement the hook: preload only when enabled, unlock in the user gesture, attach/remove listeners safely, and return virtual-key playback.
- [ ] Run the two focused test files and confirm they pass.

### Task 5: Deliver settings to every typing host and wire sound

**Files:**
- Modify: `src/features/course/CourseListPage.loader.ts`
- Modify: `src/features/course/CourseListPage.tsx`
- Modify: `src/features/course/CourseListPage.loader.test.ts`
- Modify: `src/features/home/HomePlayer.tsx`
- Modify: `src/features/home/OnePageLearningPlayer.tsx`
- Modify: `src/features/lesson/LessonTypingSession.tsx`
- Modify: `src/features/review/ReviewTypingSession.tsx`
- Modify: focused affected host tests

**Consumes:** settings from Tasks 1–2 and `useKeyboardSound` from Task 4.

- [ ] Load settings alongside the Course List’s other profile-owned data and expose it through `CourseListLoaderData`; preserve the page’s streamed/static-Home behavior.
- [ ] Pass settings into `HomePlayer` and `OnePageLearningPlayer`; pass their `soundEnabled` and `keyboardSoundPack` into the hook.
- [ ] Extend Lesson and Review keyboard-setting props to include the two sound fields; their existing route loaders already supply `UserSettings`.
- [ ] In each physical typing host, call sound playback only for the same usable key input that reaches its typing session. In each virtual-keyboard handler, call `playVirtualKey(code)` beside the existing attempt handling.
- [ ] Ensure `ReviewTypingSession` covers both Review and Weak Jamo practice through its existing callers; do not duplicate the hook in `WeakJamoPage`.
- [ ] Add/update focused tests for settings propagation and virtual playback call sites; run only the affected host and Course List tests.

### Task 6: Credits, decision record, status, and verification handoff

**Files:**
- Modify: `docs/CREDITS.md`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/PROGRESS.md`
- Modify: `README.md`
- Modify: `docs/log/2026-10.md`

- [ ] Credit `tplai/kbsim` as the sound-pack source, author `tplai`, and MIT license, linking to `https://github.com/tplai/kbsim/tree/master`; describe the included Turquoise Tealio, Cherry MX Blacks, and Cherry MX Blues derivatives.
- [ ] Add `DEC-052` and its index entry: Vite-bundled Web Audio buffers are used rather than `<audio>` elements or a dependency, because they preload once and overlap during fast typing.
- [ ] Update README’s sound-feedback checklist and PROGRESS to show the feature as implemented, including the persistent pack choice and its default.
- [ ] Append the non-UI completion entry required by `docs/COMPLETE-LOG.md` to `docs/log/2026-10.md`.
- [ ] Run all focused tests added or affected by this work, then run `pnpm lint`; record actual outcomes without claiming browser verification.
- [ ] Hand off manual verification: toggle sound off/on; select and save all three packs; reload; type on physical and virtual keyboards in Lesson, Review, Weak Jamo, Home content, and Learning-Path fallback; verify a silent failure does not block typing.

## Out of Scope

- Volume controls or per-pack preview controls.
- Additional sound packs beyond the three bundled sets.
- Correct/incorrect feedback sounds.
- Per-keystroke learner-state persistence.
