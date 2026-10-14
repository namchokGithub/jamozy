import { describe, expect, test } from 'vitest'
import { buildExpectedKeys } from '../../domain/korean/target-sequence'
import { svgTargetSyllables } from './hangul-target-selection'

describe('svgTargetSyllables', () => {
  test('keeps a standalone compound vowel eligible for SVG rendering', () => {
    expect(svgTargetSyllables('ㅝ', buildExpectedKeys('ㅝ'))).toEqual([
      { syllable: 'ㅝ', jamo: ['ㅜ', 'ㅓ'] },
    ])
  })
})
