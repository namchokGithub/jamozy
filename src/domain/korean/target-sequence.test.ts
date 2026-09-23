import { describe, expect, it } from 'vitest'
import { buildExpectedKeys } from './target-sequence'

describe('buildExpectedKeys', () => {
  it('builds a plain word with no compounds, grouping keys by syllable', () => {
    const keys = buildExpectedKeys('사랑')

    expect(keys.map((k) => k.jamo)).toEqual(['ㅅ', 'ㅏ', 'ㄹ', 'ㅏ', 'ㅇ'])
    expect(keys.map((k) => k.code)).toEqual(['KeyT', 'KeyK', 'KeyF', 'KeyK', 'KeyD'])
    expect(keys.map((k) => k.syllableIndex)).toEqual([0, 0, 1, 1, 1])
    expect(keys.map((k) => k.slot)).toEqual([
      'choseong', 'jungseong', 'choseong', 'jungseong', 'jongseong',
    ])
  })

  it('expands a compound jungseong into its 2 keystrokes', () => {
    const keys = buildExpectedKeys('화')

    expect(keys.map((k) => k.jamo)).toEqual(['ㅎ', 'ㅗ', 'ㅏ'])
    expect(keys.map((k) => k.code)).toEqual(['KeyG', 'KeyH', 'KeyK'])
    expect(keys.map((k) => k.slot)).toEqual(['choseong', 'jungseong', 'jungseong'])
    expect(keys.every((k) => k.syllableIndex === 0)).toBe(true)
  })

  it('expands a compound jongseong into its 2 keystrokes', () => {
    const keys = buildExpectedKeys('값')

    expect(keys.map((k) => k.jamo)).toEqual(['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ'])
    expect(keys.map((k) => k.slot)).toEqual([
      'choseong', 'jungseong', 'jongseong', 'jongseong',
    ])
  })

  it('gives space/period/comma their own literal single-key entry', () => {
    const keys = buildExpectedKeys('안, 녕.')

    expect(keys.map((k) => k.jamo)).toEqual([
      'ㅇ', 'ㅏ', 'ㄴ', ',', ' ', 'ㄴ', 'ㅕ', 'ㅇ', '.',
    ])
    expect(keys.map((k) => k.code)).toEqual([
      'KeyD', 'KeyK', 'KeyS', 'Comma', 'Space', 'KeyS', 'KeyU', 'KeyD', 'Period',
    ])
    expect(keys.map((k) => k.syllableIndex)).toEqual([0, 0, 0, 1, 2, 3, 3, 3, 4])
    expect(keys.filter((k) => k.slot === 'literal')).toHaveLength(3)
  })

  it('throws for a character with no keymap entry', () => {
    expect(() => buildExpectedKeys('a')).toThrow('No keymap entry for character: "a"')
  })

  it('marks strictShift true only for keys that have a Shift variant', () => {
    const keys = buildExpectedKeys('가꾸') // ㄱ,ㅏ (KeyR has a shift variant ㄲ) / ㄲ,ㅜ (KeyR shifted, KeyN plain)

    expect(keys.map((k) => `${k.jamo}:${k.strictShift}`)).toEqual([
      'ㄱ:true', // KeyR — has a shift variant (ㄲ), so shift state must match exactly
      'ㅏ:false', // KeyK — no shift variant, shift state is irrelevant
      'ㄲ:true', // KeyR shifted — same key as above, still has a shift variant
      'ㅜ:false', // KeyN — no shift variant
    ])
  })
})
