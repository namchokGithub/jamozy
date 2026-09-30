import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { atomicWrite, generateCache } from '../tools/jamo-svg/cache'
import { validateReview } from '../tools/jamo-svg/compile'
import { extractGlyph } from '../tools/jamo-svg/extract'
import { migrateStepAlgorithmReview } from '../tools/jamo-svg/migrate'
import type { QueueDocument, ReviewManifest, ReviewShard } from '../tools/jamo-svg/review-store'
import { PHYSICAL_STEP_ALGORITHM_VERSION } from '../tools/jamo-svg/types'

const root = process.cwd()
const reviewsRoot = join(root, 'tools/jamo-svg/reviews/pretendard-600')
const queueFile = join(root, 'tools/jamo-svg/queue/pretendard-600/queue.json')
const stable = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

async function main() {
  const manifest = JSON.parse(await readFile(join(reviewsRoot, 'manifest.json'), 'utf8')) as Omit<ReviewManifest, 'physicalStepAlgorithmVersion'> & { physicalStepAlgorithmVersion: number }
  if (manifest.physicalStepAlgorithmVersion !== 1) throw new Error('Expected a review manifest on physical-step algorithm v1.')
  const queue = JSON.parse(await readFile(queueFile, 'utf8')) as QueueDocument
  const glyphs = new Map((await Promise.all(queue.entries.map(({ syllable }) => extractGlyph(syllable)))).map((glyph) => [glyph.syllable, glyph]))
  const cacheRoot = join(root, 'tools/jamo-svg/cache', manifest.activeFontFingerprint)
  const shards = await Promise.all(manifest.shards.map(async (item) => {
    const text = await readFile(join(reviewsRoot, item.file), 'utf8')
    if (sha256(text) !== item.sha256) throw new Error(`Review shard checksum mismatch for ${item.file}.`)
    return { item, shard: JSON.parse(text) as ReviewShard }
  }))
  const diagnostics: string[] = []
  const migrated = shards.map(({ item, shard }) => {
    const reviews = Object.fromEntries(Object.entries(shard.reviews).map(([syllable, review]) => {
      const source = glyphs.get(syllable) ?? (() => { throw new Error(`${syllable} is reviewed but missing from the queue.`) })()
      const result = migrateStepAlgorithmReview(review, source)
      diagnostics.push(...result.diagnostics)
      return [syllable, { ...result.review, blockers: validateReview(source, result.review).blockers }]
    }))
    return { item, text: stable({ ...shard, physicalStepAlgorithmVersion: PHYSICAL_STEP_ALGORITHM_VERSION, reviews }) }
  })
  if (diagnostics.length) throw new Error(`Migration requires review: ${diagnostics.join(' ')}`)
  await generateCache(cacheRoot, [...glyphs.keys()])
  for (const { item, text } of migrated) await atomicWrite(join(reviewsRoot, item.file), text)
  await atomicWrite(join(reviewsRoot, 'manifest.json'), stable({ ...manifest, physicalStepAlgorithmVersion: PHYSICAL_STEP_ALGORITHM_VERSION, shards: migrated.map(({ item, text }) => ({ ...item, sha256: sha256(text) })) }))
  await atomicWrite(queueFile, stable({ ...queue, entries: queue.entries.map((entry) => ({ ...entry, queueKey: glyphs.get(entry.syllable)!.family.queueKey })) }))
  console.log(`Migrated ${migrated.length} review shards to physical-step algorithm v${PHYSICAL_STEP_ALGORITHM_VERSION}.`)
}

void main()
