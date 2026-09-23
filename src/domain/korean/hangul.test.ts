import { describe, expect, it } from 'vitest'
import {
  COMPOUND_JONGSEONG_PARTS,
  COMPOUND_JUNGSEONG_PARTS,
  composeSyllable,
  decomposeSyllable,
} from './hangul'

describe('decomposeSyllable / composeSyllable round trips', () => {
  it('round-trips a syllable with no final consonant', () => {
    const decomposed = decomposeSyllable('가')
    expect(decomposed).toEqual({ choseong: 'ㄱ', jungseong: 'ㅏ', jongseong: '' })
    expect(composeSyllable('ㄱ', 'ㅏ')).toBe('가')
  })

  it('round-trips a syllable with a simple final consonant', () => {
    const decomposed = decomposeSyllable('안')
    expect(decomposed).toEqual({ choseong: 'ㅇ', jungseong: 'ㅏ', jongseong: 'ㄴ' })
    expect(composeSyllable('ㅇ', 'ㅏ', 'ㄴ')).toBe('안')
  })

  it('round-trips a syllable with a compound final consonant', () => {
    const decomposed = decomposeSyllable('값')
    expect(decomposed).toEqual({ choseong: 'ㄱ', jungseong: 'ㅏ', jongseong: 'ㅄ' })
    expect(composeSyllable('ㄱ', 'ㅏ', 'ㅄ')).toBe('값')
  })

  it('round-trips a syllable with a compound jungseong', () => {
    const decomposed = decomposeSyllable('화')
    expect(decomposed).toEqual({ choseong: 'ㅎ', jungseong: 'ㅘ', jongseong: '' })
    expect(composeSyllable('ㅎ', 'ㅘ')).toBe('화')
  })

  it('returns null for a non-syllable character', () => {
    expect(decomposeSyllable(',')).toBeNull()
    expect(decomposeSyllable(' ')).toBeNull()
    expect(decomposeSyllable('a')).toBeNull()
  })

  it('throws composing from jamo that are not valid choseong/jungseong/jongseong', () => {
    expect(() => composeSyllable('x', 'ㅏ')).toThrow()
  })
})

describe('compound part tables', () => {
  it('lists the 7 compound jungseong and their 2 typed parts', () => {
    expect(Object.keys(COMPOUND_JUNGSEONG_PARTS)).toHaveLength(7)
    expect(COMPOUND_JUNGSEONG_PARTS['ㅘ']).toEqual(['ㅗ', 'ㅏ'])
    expect(COMPOUND_JUNGSEONG_PARTS['ㅢ']).toEqual(['ㅡ', 'ㅣ'])
  })

  it('lists the 11 compound jongseong and their 2 typed parts', () => {
    expect(Object.keys(COMPOUND_JONGSEONG_PARTS)).toHaveLength(11)
    expect(COMPOUND_JONGSEONG_PARTS['ㅄ']).toEqual(['ㅂ', 'ㅅ'])
    expect(COMPOUND_JONGSEONG_PARTS['ㄺ']).toEqual(['ㄹ', 'ㄱ'])
  })
})
