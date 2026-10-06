import { describe, expect, it } from 'vitest'
import {
  CHOSEONG_SHARD_COUNT,
  COMPOUND_JONGSEONG_PARTS,
  COMPOUND_JUNGSEONG_PARTS,
  composeSyllable,
  decomposeSyllable,
  getChoseongShardIndex,
  shardFileName,
  normalizeHangulText,
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

describe('getChoseongShardIndex', () => {
  it('derives the choseong index of a precomposed syllable', () => {
    expect(getChoseongShardIndex('가')).toBe(0)
    expect(getChoseongShardIndex('까')).toBe(1)
    expect(getChoseongShardIndex('꿱')).toBe(1)
    expect(getChoseongShardIndex('나')).toBe(2)
    expect(getChoseongShardIndex('힣')).toBe(18)
  })

  it('returns undefined for anything that is not one precomposed syllable', () => {
    for (const value of ['ㄱ', 'A', ' ', '', '가나']) expect(getChoseongShardIndex(value)).toBeUndefined()
  })

  it('formats two-digit shard file names', () => {
    expect(CHOSEONG_SHARD_COUNT).toBe(19)
    expect(shardFileName(0)).toBe('00.json')
    expect(shardFileName(18)).toBe('18.json')
  })
})

describe('normalizeHangulText', () => {
  it('maps standalone conjoining jamo to compatibility jamo', () => {
    // Choseong U+1100/U+1101, jungseong U+1161/U+1175, jongseong U+11A8/U+11AA/U+11C2.
    expect(normalizeHangulText('\u1100\u1101 \u1161\u1175 \u11A8\u11AA\u11C2'))
      .toBe('ㄱㄲ ㅏㅣ ㄱㄳㅎ')
  })

  it('composes decomposed (NFD) syllables', () => {
    expect(normalizeHangulText('\u1100\u1161\u11A8')).toBe('각')
    expect(normalizeHangulText('안녕'.normalize('NFD'))).toBe('안녕')
  })

  it('leaves compatibility jamo, syllables, and other text unchanged', () => {
    expect(normalizeHangulText('ㄱ 가, abc.')).toBe('ㄱ 가, abc.')
  })

  it('leaves archaic conjoining jamo that have no key unchanged', () => {
    expect(normalizeHangulText('\u1140')).toBe('\u1140')
  })
})

