# Keyboard Sound Implementation Plan

**Goal:** Play a mechanical-keyboard press/release sound for every key a learner types — hardware or virtual keyboard — when `UserSettings.soundEnabled` is on.

**Architecture:** Web Audio API, no new dependency. A module-level player fetches and decodes each pack file once into an `AudioBuffer`, then plays each event through a fresh `AudioBufferSourceNode` (low latency, overlapping sounds during fast typing; `HTMLAudioElement` cannot overlap itself and lags). A pure mapper chooses the sound file from `KeyboardEvent.code`. A typing hook wires keydown/keyup and the virtual keyboard to the player and is mounted by each typing host.

**Tech Stack:** React 19, TypeScript, Web Audio API, Vitest.

## Constraints

- `soundEnabled` already exists in `UserSettings` (`src/domain/models/user-profile.ts`) and the Settings toggle already saves it. No schema, persistence, or migration change.
- Sound is transient client presentation; never store it in typing-session or domain state.
- Play the same sound for correct and wrong attempts. Sound does not signal correctness.
- Skip `keydown` events with `event.repeat`.
- A missing, still-loading, or undecodable file plays nothing and never throws.
- When `soundEnabled` is false, register no listeners and fetch no files.
- Browsers block audio until a user gesture: call `AudioContext.resume()` on the first keydown/pointerdown.
- Sound files are not ready yet. Tasks 2–5 run against test doubles; Task 1 lands when the files exist.

## Sound Pack Layout

```
public/sounds/keyboard/blackink/
  press/    BACKSPACE.mp3 ENTER.mp3 SPACE.mp3 GENERIC_R0.mp3 … GENERIC_R4.mp3
  release/  BACKSPACE.mp3 ENTER.mp3 SPACE.mp3 GENERIC.mp3
```

Press mapping by physical row (`GENERIC_R{n}`):

| Sound          | `KeyboardEvent.code`                                                     |
| -------------- | ------------------------------------------------------------------------ |
| `BACKSPACE`    | `Backspace`                                                              |
| `ENTER`        | `Enter`, `NumpadEnter`                                                   |
| `SPACE`        | `Space`                                                                  |
| `GENERIC_R0`   | `Escape`, `F1`–`F12`                                                     |
| `GENERIC_R1`   | `Backquote`, `Digit0`–`Digit9`, `Minus`, `Equal`                         |
| `GENERIC_R2`   | `Tab`, `KeyQ`–`KeyP`, `BracketLeft`, `BracketRight`, `Backslash`         |
| `GENERIC_R3`   | `CapsLock`, `KeyA`–`KeyL`, `Semicolon`, `Quote`                          |
| `GENERIC_R4`   | `ShiftLeft`, `ShiftRight`, `KeyZ`–`KeyM`, `Comma`, `Period`, `Slash`; fallback for any other code (Ctrl, Alt, Meta, arrows) |

Release mapping: `BACKSPACE`, `ENTER`, `SPACE` as above; every other code → `GENERIC`.

### Task 1: Add sound assets and credits

**Files:**

- Create: `public/sounds/keyboard/blackink/press/*.mp3` (8 files)
- Create: `public/sounds/keyboard/blackink/release/*.mp3` (4 files)
- Modify: `docs/CREDITS.md`

- [ ] Copy the `blackink` files into the layout above, keeping the file names.
- [ ] Record the pack source, author, and license in `docs/CREDITS.md`.

### Task 2: Add a tested key-to-sound mapper

**Files:**

- Create: `src/features/typing/keyboard-sound-map.ts`
- Create: `src/features/typing/keyboard-sound-map.test.ts`

- [ ] Write failing tests: Backspace/Enter/NumpadEnter/Space map to their own press and release sounds; one representative code per row maps to `GENERIC_R0`–`GENERIC_R4`; an unknown code (`ControlLeft`) falls back to `GENERIC_R4`; every non-special release maps to `GENERIC`.
- [ ] Implement `pressSoundFor(code)`, `releaseSoundFor(code)`, and `KEYBOARD_SOUND_FILES` (pack-relative paths for preload).
- [ ] Run `pnpm test src/features/typing/keyboard-sound-map.test.ts`.

### Task 3: Add the Web Audio player

**Files:**

- Create: `src/infrastructure/audio/keyboard-sound-player.ts`
- Create: `src/infrastructure/audio/keyboard-sound-player.test.ts`

- [ ] Write failing tests with a fake `AudioContext` and `fetch`: `load()` decodes each file once even when called twice; `play()` before load finishes is a no-op; one failed file does not block the others; `unlock()` resumes a suspended context.
- [ ] Implement a lazily created single `AudioContext`, `load(pack)`, `play(name)`, and `unlock()`.
- [ ] Run `pnpm test src/infrastructure/audio/keyboard-sound-player.test.ts`.

### Task 4: Add the `useKeyboardSound` hook

**Files:**

- Create: `src/features/typing/useKeyboardSound.ts`
- Create: `src/features/typing/useKeyboardSound.test.ts`

- [ ] Write failing tests with a mocked player: enabled → keydown plays the press sound and keyup plays the release sound; `event.repeat` plays nothing; disabled → no load and no play; unmount removes listeners.
- [ ] Implement `useKeyboardSound(enabled)`: preload on enable, unlock on first gesture, window keydown/keyup listeners, and return `playVirtualKey(code)`, which plays press then release after ~60 ms.
- [ ] Run `pnpm test src/features/typing/useKeyboardSound.test.ts`.

### Task 5: Wire sound into every typing host

**Files:**

- Modify: `src/features/lesson/LessonTypingSession.tsx`
- Modify: `src/features/review/ReviewTypingSession.tsx`
- Modify: `src/features/home/HomePlayer.tsx`
- Modify: `src/features/home/OnePageLearningPlayer.tsx`

- [ ] In each host, pass the learner's `settings.soundEnabled` to `useKeyboardSound`. Thread the value from the host's existing settings source; do not add a new loader request.
- [ ] In each host's virtual-keyboard `onKeyPress` handler, call `playVirtualKey(code)` next to the existing `recordAttempt`/`pressKey` call.
- [ ] Run `pnpm test`, `pnpm lint`, and `pnpm build`.
- [ ] Manual check: type in Lesson, Review, and Home with sound on and off; toggle Settings → Sound and confirm it takes effect.

### Task 6: Documentation

- [ ] Tick the matching MVP checklist item in `README.md` and mirror it in `docs/PROGRESS.md`.
- [ ] Append a log entry to `docs/log/2026-10.md`.
- [ ] Add `DEC-052` to `docs/DECISIONS.md` and its index: Web Audio API buffers over howler or `<audio>` elements.

## Out of Scope

- Volume control.
- Choosing a sound pack (for example `bluealps`) in Settings.
- Distinct correct/wrong feedback sounds.
