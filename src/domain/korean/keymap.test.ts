import { describe, expect, it } from 'vitest'
import { isKoreanJamoKey, JAMO_TO_KEY, KEY_TO_JAMO } from './keymap'

describe('KEY_TO_JAMO', () => {
  it('maps a plain consonant key', () => {
    expect(KEY_TO_JAMO.KeyR).toEqual({ base: 'ㄱ', shift: 'ㄲ' })
  })

  it('maps a vowel key with no shift variant', () => {
    expect(KEY_TO_JAMO.KeyK).toEqual({ base: 'ㅏ' })
  })

  it('maps punctuation and space with no jamo role', () => {
    expect(KEY_TO_JAMO.Comma).toEqual({ base: ',' })
    expect(KEY_TO_JAMO.Period).toEqual({ base: '.' })
    expect(KEY_TO_JAMO.Space).toEqual({ base: ' ' })
  })
})

describe('JAMO_TO_KEY', () => {
  it('inverts a base jamo back to its key with shift: false', () => {
    expect(JAMO_TO_KEY['ㄱ']).toEqual({ code: 'KeyR', shift: false })
  })

  it('inverts a shift jamo back to its key with shift: true', () => {
    expect(JAMO_TO_KEY['ㄲ']).toEqual({ code: 'KeyR', shift: true })
  })

  it('inverts punctuation with shift: false', () => {
    expect(JAMO_TO_KEY[',']).toEqual({ code: 'Comma', shift: false })
  })
})

describe('isKoreanJamoKey', () => {
  it('accepts Korean 2-set letter positions only', () => {
    expect(isKoreanJamoKey('KeyR')).toBe(true)
    expect(isKoreanJamoKey('KeyK')).toBe(true)
  })

  it.each(['Space', 'Enter', 'ArrowLeft', 'Comma', 'Period', 'F1'])(
    'rejects a non-jamo key: %s',
    (code) => {
      expect(isKoreanJamoKey(code)).toBe(false)
    },
  )
})
