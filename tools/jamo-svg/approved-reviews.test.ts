import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { validateReview } from './compile'
import { extractGlyph } from './extract'
import type { ReviewManifest, ReviewShard } from './review-store'

const reviewsRoot = 'tools/jamo-svg/reviews/pretendard-600'

// Guards committed review data: a compiler or extraction change must not
// silently invalidate an approval. One test covers every approved glyph.
test('every committed approved review still validates against the bundled font', async () => {
  const manifest = JSON.parse(await readFile(join(reviewsRoot, 'manifest.json'), 'utf8')) as ReviewManifest
  const failures: string[] = []
  let checked = 0
  for (const item of manifest.shards) {
    const shard = JSON.parse(await readFile(join(reviewsRoot, item.file), 'utf8')) as ReviewShard
    for (const review of Object.values(shard.reviews)) {
      if (review.status !== 'approved') continue
      checked += 1
      const blockers = review.approved ? validateReview(await extractGlyph(review.syllable), review).blockers : ['missing approval record']
      if (blockers.length) failures.push(`${review.syllable}: ${blockers.join(', ')}`)
    }
  }
  expect(failures).toEqual([])
  expect(checked).toBeGreaterThan(0)
})
