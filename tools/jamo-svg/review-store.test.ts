import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { generateCache } from './cache'
import { extractGlyph } from './extract'
import { ConflictError, initializeReviewManifest, ReviewStore } from './review-store'
import { seedReview } from './seed'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })
describe('sharded review store', () => {
  test('saves only the chosen-initial review and rejects stale revisions', async () => {
    const root = await mkdtemp(join(tmpdir(), 'jamo-svg-')); roots.push(root)
    const source = await extractGlyph('가'); const cache = join(root, 'cache', source.extraction.fontSha256)
    await generateCache(cache, ['가', '하']); const reviewsRoot = join(root, 'reviews'); await initializeReviewManifest(reviewsRoot, source.extraction.fontSha256)
    const store = new ReviewStore(reviewsRoot, cache); const saved = await store.save(await seedReview('가'))
    expect((await store.getManifest()).shards).toEqual([expect.objectContaining({ choseong: 'ㄱ', file: 'ㄱ.json', reviewCount: 1 })])
    expect(await store.getWithRevision('가')).toEqual(expect.objectContaining({ review: expect.objectContaining({ syllable: '가' }), revision: saved.revision }))
    await expect(store.save(await seedReview('가'), 'stale-revision')).rejects.toBeInstanceOf(ConflictError)
    expect(saved.revision).toHaveLength(64)
  })
})
