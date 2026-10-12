import { describe, expect, test } from 'vitest'
import { extractGlyph } from './extract'

describe('extractGlyph', () => {
  test('extracts a standalone compound vowel as its physical typing steps', async () => {
    const glyph = await extractGlyph('ㅝ')

    expect(glyph).toMatchObject({
      syllable: 'ㅝ',
      kind: 'standalone-jamo',
      physicalSteps: [
        { order: 0, jamo: 'ㅜ', slot: 'literal' },
        { order: 1, jamo: 'ㅓ', slot: 'literal' },
      ],
    })
    expect(glyph.sourcePath).not.toBe('')
  })

  test('rejects jamo outside the supported compatibility-jamo set', async () => {
    await expect(extractGlyph('ㅤ')).rejects.toThrow(
      'Expected a modern precomposed Hangul syllable or supported compatibility jamo',
    )
  })
})
