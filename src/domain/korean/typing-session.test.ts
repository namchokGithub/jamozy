import { describe, expect, it } from 'vitest'
import {
  getAccuracy,
  getCharacterStates,
  getComposedText,
  getProgress,
  pressKey,
  startTypingSession,
} from './typing-session'

describe('startTypingSession', () => {
  it('starts in-progress for a non-empty target', () => {
    const state = startTypingSession('가')
    expect(state.status).toBe('in-progress')
    expect(state.keyIndex).toBe(0)
    expect(state.mistakeCount).toBe(0)
  })

  it('starts already completed for an empty target', () => {
    const state = startTypingSession('')
    expect(state.status).toBe('completed')
    expect(getProgress(state)).toEqual({ typed: 0, total: 0 })
    expect(getComposedText(state)).toBe('')
    expect(getCharacterStates(state)).toEqual([])
  })
})

describe('pressKey', () => {
  it('advances on a correct key and completes when the target is fully typed', () => {
    let state = startTypingSession('가') // ㄱ (KeyR) + ㅏ (KeyK)
    state = pressKey(state, 'KeyR', false)
    expect(state.keyIndex).toBe(1)
    expect(state.status).toBe('in-progress')

    state = pressKey(state, 'KeyK', false)
    expect(state.keyIndex).toBe(2)
    expect(state.status).toBe('completed')
    expect(state.mistakeCount).toBe(0)
  })

  it('rejects a wrong key: counts a mistake, does not advance or mutate composed text', () => {
    let state = startTypingSession('가')
    state = pressKey(state, 'KeyT', false) // wrong — ㅅ, not ㄱ

    expect(state.keyIndex).toBe(0)
    expect(state.mistakeCount).toBe(1)
    expect(getComposedText(state)).toBe('')
  })

  it('treats the correct code with the wrong Shift state as a mistake', () => {
    let state = startTypingSession('빵') // choseong ㅃ = Shift+KeyQ
    state = pressKey(state, 'KeyQ', false) // right key, missing Shift

    expect(state.keyIndex).toBe(0)
    expect(state.mistakeCount).toBe(1)

    state = pressKey(state, 'KeyQ', true) // now correct
    expect(state.keyIndex).toBe(1)
  })

  it('ignores further key presses once the session is completed', () => {
    let state = startTypingSession('가')
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    expect(state.status).toBe('completed')

    const completed = state
    state = pressKey(state, 'KeyR', false)
    expect(state).toEqual(completed)
  })

  it('accepts a held Shift on a key with no Shift variant (still matches)', () => {
    let state = startTypingSession('까') // choseong ㄲ = Shift+KeyR, jungseong ㅏ = KeyK (no shift variant)
    state = pressKey(state, 'KeyR', true) // ㄲ
    expect(state.keyIndex).toBe(1)

    state = pressKey(state, 'KeyK', true) // ㅏ, Shift still held from the previous key — should still match
    expect(state.keyIndex).toBe(2)
    expect(state.mistakeCount).toBe(0)
  })

  it('still requires the exact Shift state for a key that has a Shift variant', () => {
    let state = startTypingSession('가') // choseong ㄱ = KeyR (unshifted) — ㄲ is Shift+KeyR
    state = pressKey(state, 'KeyR', true) // right key, wrong Shift state (asks for ㄲ, not ㄱ)

    expect(state.keyIndex).toBe(0)
    expect(state.mistakeCount).toBe(1)
  })

  it('ignores a bare modifier keydown rather than counting it as a mistake', () => {
    let state = startTypingSession('가')
    state = pressKey(state, 'ShiftLeft', true)

    expect(state.keyIndex).toBe(0)
    expect(state.mistakeCount).toBe(0)
  })
})

describe('getComposedText', () => {
  it('shows only the choseong while the jungseong has not been typed yet', () => {
    let state = startTypingSession('가')
    state = pressKey(state, 'KeyR', false)
    expect(getComposedText(state)).toBe('ㄱ')
  })

  it('composes progressively with the first half of a compound jongseong, then the full syllable', () => {
    let state = startTypingSession('값') // ㄱ, ㅏ, ㅂ+ㅅ (compound jongseong)
    state = pressKey(state, 'KeyR', false) // ㄱ
    state = pressKey(state, 'KeyK', false) // ㅏ
    state = pressKey(state, 'KeyQ', false) // ㅂ (1st half of ㅄ) — ㅂ is itself a valid final, so this shows 갑

    expect(getComposedText(state)).toBe('갑')
    expect(getCharacterStates(state)).toEqual(['current'])

    state = pressKey(state, 'KeyT', false) // ㅅ (2nd half of ㅄ)
    expect(getComposedText(state)).toBe('값')
    expect(getCharacterStates(state)).toEqual(['correct'])
  })

  it('composes progressively with the first half of a compound jungseong, then the full syllable', () => {
    let state = startTypingSession('화') // ㅎ, ㅗ+ㅏ (compound jungseong)
    state = pressKey(state, 'KeyG', false) // ㅎ
    expect(getComposedText(state)).toBe('ㅎ')

    state = pressKey(state, 'KeyH', false) // ㅗ (1st half of ㅘ) — ㅗ is itself a valid vowel, so this shows 호
    expect(getComposedText(state)).toBe('호')

    state = pressKey(state, 'KeyK', false) // ㅏ (2nd half of ㅘ)
    expect(getComposedText(state)).toBe('화')
  })

  it('passes punctuation and space through once typed', () => {
    let state = startTypingSession('가,')
    state = pressKey(state, 'KeyR', false)
    state = pressKey(state, 'KeyK', false)
    state = pressKey(state, 'Comma', false)
    expect(getComposedText(state)).toBe('가,')
  })
})

describe('getCharacterStates', () => {
  it('marks a completed syllable correct and the next one current immediately', () => {
    let state = startTypingSession('사랑')
    state = pressKey(state, 'KeyT', false) // ㅅ
    state = pressKey(state, 'KeyK', false) // ㅏ — 사 complete, 랑 becomes current

    expect(getCharacterStates(state)).toEqual(['correct', 'current'])
  })

  it('marks every syllable correct once the whole target is typed', () => {
    let state = startTypingSession('사랑')
    state = pressKey(state, 'KeyT', false)
    state = pressKey(state, 'KeyK', false)
    state = pressKey(state, 'KeyF', false)
    state = pressKey(state, 'KeyK', false)
    state = pressKey(state, 'KeyD', false)

    expect(getCharacterStates(state)).toEqual(['correct', 'correct'])
  })
})

describe('getAccuracy', () => {
  it('is 0 with no key presses yet', () => {
    expect(getAccuracy(startTypingSession('가'))).toBe(0)
  })

  it('reflects correct presses against total attempts', () => {
    let state = startTypingSession('가')
    state = pressKey(state, 'KeyT', false) // wrong
    state = pressKey(state, 'KeyR', false) // correct
    expect(getAccuracy(state)).toBe(0.5)
  })
})

describe('getProgress', () => {
  it('only counts a syllable as typed once all of its keys are entered', () => {
    let state = startTypingSession('사랑')
    expect(getProgress(state)).toEqual({ typed: 0, total: 2 })

    state = pressKey(state, 'KeyT', false)
    expect(getProgress(state)).toEqual({ typed: 0, total: 2 }) // 사 not complete yet

    state = pressKey(state, 'KeyK', false)
    expect(getProgress(state)).toEqual({ typed: 1, total: 2 }) // 사 complete
  })
})
