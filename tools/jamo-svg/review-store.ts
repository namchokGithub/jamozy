import { createHash } from 'node:crypto'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadCacheGlyph, atomicWrite } from './cache'
import { validateReview } from './compile'
import type { GlyphReview } from './types'

export type ReviewShard = { shardSchemaVersion: 1; choseong: string; fontFingerprint: string; physicalStepAlgorithmVersion: 1; splitRecipeSchemaVersion: 1; reviews: Record<string, GlyphReview> }
export type ReviewManifest = { manifestSchemaVersion: 1; reviewRecordSchemaVersion: 1; splitRecipeSchemaVersion: 1; activeFontFingerprint: string; physicalStepAlgorithmVersion: 1; shards: Array<{ choseong: string; file: string; reviewCount: number; sha256: string }> }
export type QueueEntry = { syllable: string; priority: number; reasons: string[]; queueKey: { medialLayout: string; hasFinal: boolean; compoundMedial: string | null; compoundFinal: string | null; physicalStepCount: number; contourRelation: 'deficit' | 'aligned' | 'surplus' }; nearestApprovedSyllables: string[] }
export type QueueDocument = { queueSchemaVersion: 1; fontFingerprint: string; entries: QueueEntry[] }
const stable = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
const checksum = (text: string) => createHash('sha256').update(text).digest('hex')
export class ConflictError extends Error { constructor() { super('Review shard changed; reload before saving.'); } }
export class ReviewStore {
  constructor(private readonly reviewsRoot: string, private readonly cacheRoot: string) {}
  private async manifest(): Promise<ReviewManifest> { return JSON.parse(await readFile(join(this.reviewsRoot, 'manifest.json'), 'utf8')) as ReviewManifest }
  async get(syllable: string) { const source = await loadCacheGlyph(this.cacheRoot, syllable); const manifest = await this.manifest(); const item = manifest.shards.find((shard) => shard.choseong === source.hangul.choseong); if (!item) return undefined; const shard = JSON.parse(await readFile(join(this.reviewsRoot, item.file), 'utf8')) as ReviewShard; return shard.reviews[syllable] }
  async getManifest() { return this.manifest() }
  async save(review: GlyphReview, expectedRevision?: string) {
    const source = await loadCacheGlyph(this.cacheRoot, review.syllable); const validation = validateReview(source, review); if (validation.blockers.length) throw new Error(`Review validation failed: ${validation.blockers.join(', ')}`)
    const manifest = await this.manifest(); if (manifest.activeFontFingerprint !== source.extraction.fontSha256 || manifest.physicalStepAlgorithmVersion !== source.extraction.physicalStepAlgorithm) throw new Error('Stale review manifest fingerprint.')
    const choseong = source.hangul.choseong; const file = `${choseong}.json`; const existing = manifest.shards.find((item) => item.choseong === choseong)
    const shard: ReviewShard = existing ? JSON.parse(await readFile(join(this.reviewsRoot, existing.file), 'utf8')) : { shardSchemaVersion: 1, choseong, fontFingerprint: source.extraction.fontSha256, physicalStepAlgorithmVersion: 1, splitRecipeSchemaVersion: 1, reviews: {} }
    const currentRevision = checksum(stable(shard)); if (expectedRevision && expectedRevision !== currentRevision) throw new ConflictError()
    if (review.status === 'approved' && (!review.approved || validation.blockers.length)) throw new Error('Approval requires a valid explicit approval record.')
    shard.reviews[review.syllable] = review; const shardText = stable({ ...shard, reviews: Object.fromEntries(Object.entries(shard.reviews).sort(([a], [b]) => a.localeCompare(b))) })
    await mkdir(this.reviewsRoot, { recursive: true }); await atomicWrite(join(this.reviewsRoot, file), shardText)
    const nextItems = manifest.shards.filter((item) => item.choseong !== choseong); nextItems.push({ choseong, file, reviewCount: Object.keys(shard.reviews).length, sha256: checksum(shardText) }); nextItems.sort((a, b) => a.choseong.localeCompare(b.choseong))
    await atomicWrite(join(this.reviewsRoot, 'manifest.json'), stable({ ...manifest, shards: nextItems })); return { revision: checksum(shardText) }
  }
}
export class QueueStore {
  constructor(private readonly file: string, private readonly fontFingerprint: string) {}
  async list(): Promise<QueueEntry[]> { try { const queue = JSON.parse(await readFile(this.file, 'utf8')) as QueueDocument; if (queue.queueSchemaVersion !== 1 || queue.fontFingerprint !== this.fontFingerprint) throw new Error('Stale queue fingerprint.'); return queue.entries } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error } }
  async save(entries: QueueEntry[]) { await atomicWrite(this.file, stable({ queueSchemaVersion: 1, fontFingerprint: this.fontFingerprint, entries: [...entries].sort((a, b) => a.syllable.localeCompare(b.syllable)) })) }
}
export async function initializeReviewManifest(reviewsRoot: string, fontFingerprint: string) { await atomicWrite(join(reviewsRoot, 'manifest.json'), stable({ manifestSchemaVersion: 1, reviewRecordSchemaVersion: 1, splitRecipeSchemaVersion: 1, activeFontFingerprint: fontFingerprint, physicalStepAlgorithmVersion: 1, shards: [] } satisfies ReviewManifest)) }
