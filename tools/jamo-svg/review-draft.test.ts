import { expect, test } from 'vitest'
import { createUnreviewedDraft } from './review-draft'
import type { CachedGlyph } from './types'

test('creates an unsaved review draft for a queued glyph without a persisted review', () => {
  const source = {
    syllable: '굵',
    extraction: { fontSha256: 'font', extractionSchema: 1, pathNormalization: 1, physicalStepAlgorithm: 3 },
    sourceGlyphHash: 'glyph',
    physicalSteps: [{ order: 0, jamo: 'ㄱ', slot: 'choseong' }, { order: 1, jamo: 'ㅜ', slot: 'jungseong' }, { order: 2, jamo: 'ㄹ', slot: 'jongseong' }, { order: 3, jamo: 'ㄱ', slot: 'jongseong' }],
  } as CachedGlyph

  expect(createUnreviewedDraft(source)).toMatchObject({
    syllable: '굵',
    status: 'unreviewed',
    blockers: ['unassigned-source-geometry', 'empty-physical-step'],
    steps: [
      { order: 0, jamo: 'ㄱ', geometry: [] },
      { order: 1, jamo: 'ㅜ', geometry: [] },
      { order: 2, jamo: 'ㄹ', geometry: [] },
      { order: 3, jamo: 'ㄱ', geometry: [] },
    ],
  })
})
