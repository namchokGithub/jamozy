import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { atomicWrite, loadCacheGlyph } from '../tools/jamo-svg/cache'
import { validateReview } from '../tools/jamo-svg/compile'
import { migrateV1Review } from '../tools/jamo-svg/migrate'

type V1Manifest = { manifestSchemaVersion: 1; reviewRecordSchemaVersion: 1; splitRecipeSchemaVersion: 1; activeFontFingerprint: string; physicalStepAlgorithmVersion: 1; shards: Array<{ choseong: string; file: string; reviewCount: number; sha256: string }> }
type V1Shard = { shardSchemaVersion: 1; choseong: string; fontFingerprint: string; physicalStepAlgorithmVersion: 1; splitRecipeSchemaVersion: 1; reviews: Record<string, Parameters<typeof migrateV1Review>[0]> }
const root = process.cwd()
const reviewsRoot = join(root, 'tools/jamo-svg/reviews/pretendard-600')
const stable = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

async function main() {
  const manifest = JSON.parse(await readFile(join(reviewsRoot, 'manifest.json'), 'utf8')) as V1Manifest
  if (manifest.manifestSchemaVersion !== 1 || manifest.reviewRecordSchemaVersion !== 1 || manifest.splitRecipeSchemaVersion !== 1) throw new Error('Expected an unmigrated V1 review manifest.')
  const cacheRoot = join(root, 'tools/jamo-svg/cache', manifest.activeFontFingerprint)
  const nextShards = []
  for (const item of manifest.shards) {
    const shard = JSON.parse(await readFile(join(reviewsRoot, item.file), 'utf8')) as V1Shard
    if (shard.shardSchemaVersion !== 1 || shard.splitRecipeSchemaVersion !== 1) throw new Error(`Unknown shard schema in ${item.file}.`)
    const reviews = Object.fromEntries(await Promise.all(Object.entries(shard.reviews).map(async ([syllable, review]) => {
      const migrated = migrateV1Review(review)
      const source = await loadCacheGlyph(cacheRoot, syllable)
      const validation = validateReview(source, migrated.review)
      if (migrated.diagnostics.length) throw new Error(`Migration requires review: ${migrated.diagnostics.join(' ')}`)
      return [syllable, { ...migrated.review, blockers: validation.blockers }]
    })))
    const text = stable({ ...shard, shardSchemaVersion: 2, splitRecipeSchemaVersion: 2, reviews })
    await atomicWrite(join(reviewsRoot, item.file), text)
    nextShards.push({ choseong: item.choseong, file: item.file, reviewCount: Object.keys(reviews).length, sha256: sha256(text) })
  }
  await atomicWrite(join(reviewsRoot, 'manifest.json'), stable({ ...manifest, manifestSchemaVersion: 2, reviewRecordSchemaVersion: 2, splitRecipeSchemaVersion: 2, shards: nextShards }))
  console.log(`Migrated ${nextShards.reduce((count, shard) => count + shard.reviewCount, 0)} reviews to schema V2.`)
}

void main()
