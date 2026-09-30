import { expect, test } from 'vitest'
import { retainSourceAfterSave } from './tagger-state'

test('retains the loaded source glyph when the save endpoint returns review-only data', () => {
  const current = {
    source: { syllable: '굵', sourcePath: 'M0 0Z' },
    review: { syllable: '굵', status: 'reviewing' },
  }
  const saved = {
    review: { syllable: '굵', status: 'reviewing' },
    revision: 'next-revision',
    compiled: { paths: [] },
    validation: { blockers: [] },
  }

  expect(retainSourceAfterSave(current, saved)).toMatchObject({
    source: { sourcePath: 'M0 0Z' },
    revision: 'next-revision',
  })
})
