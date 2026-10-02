import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { generateCache } from './cache'
import { extractGlyph } from './extract'
import { ConflictError, initializeReviewManifest, ReviewStore } from './review-store'
import { seedReview } from './seed'
import { createUnreviewedDraft } from './review-draft'
import { yeoCounterSplit } from './counter-split.fixture'

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

  test.each(['굵', '굸', '귟', '귌'])('persists %s as needs-split without forcing invalid ownership', async (syllable) => {
    const root = await mkdtemp(join(tmpdir(), 'jamo-svg-')); roots.push(root)
    const source = await extractGlyph(syllable); const cache = join(root, 'cache', source.extraction.fontSha256)
    await generateCache(cache, [syllable]); const reviewsRoot = join(root, 'reviews'); await initializeReviewManifest(reviewsRoot, source.extraction.fontSha256)
    const review = createUnreviewedDraft(source)
    review.status = 'reviewing'; review.blockers = [...review.blockers, 'needs-split']; review.notes = 'One contour spans all four physical steps.'
    const store = new ReviewStore(reviewsRoot, cache)
    await expect(store.save(review)).resolves.toEqual(expect.objectContaining({ revision: expect.any(String) }))
    expect(await store.get(syllable)).toMatchObject({ status: 'reviewing', blockers: expect.arrayContaining(['needs-split']), notes: review.notes })
  })

  test('saves an unfinished split as a needs-split draft but not as a plain review', async () => {
    const root = await mkdtemp(join(tmpdir(), 'jamo-svg-')); roots.push(root)
    const source = await extractGlyph('여'); const cache = join(root, 'cache', source.extraction.fontSha256)
    await generateCache(cache, ['여']); const reviewsRoot = join(root, 'reviews'); await initializeReviewManifest(reviewsRoot, source.extraction.fontSha256)
    const store = new ReviewStore(reviewsRoot, cache)
    // Mid-edit: a range past the last command (invalid recipe) and the counter still owned whole (duplicate).
    const unfinished = yeoCounterSplit(source)
    unfinished.splitRecipes[0].pieces[1].tokens[0] = { kind: 'source-range', fromCommand: 4, toCommand: 30 }
    unfinished.steps[1].geometry.push({ kind: 'contour', contourId: 2 })
    await expect(store.save(structuredClone(unfinished))).rejects.toThrow(/invalid-split-recipe/)
    await store.save({ ...unfinished, blockers: ['needs-split'] })
    expect(await store.get('여')).toMatchObject({ status: 'reviewing', blockers: expect.arrayContaining(['needs-split', 'invalid-split-recipe', 'duplicate-ownership']) })
  })
})
