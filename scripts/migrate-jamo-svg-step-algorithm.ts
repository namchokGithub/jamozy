import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { atomicWrite, generateCache } from '../tools/jamo-svg/cache'
import { compileRecipePiece, validateReview } from '../tools/jamo-svg/compile'
import { extractGlyph } from '../tools/jamo-svg/extract'
import {
  migrateStepAlgorithmReview,
  type GeometryBounds,
} from '../tools/jamo-svg/migrate'
import type {
  QueueDocument,
  ReviewManifest,
  ReviewShard,
} from '../tools/jamo-svg/review-store'
import {
  PHYSICAL_STEP_ALGORITHM_VERSION,
  type Bounds,
  type CachedGlyph,
  type GeometryRef,
  type GlyphReview,
} from '../tools/jamo-svg/types'

// Migrates review shards from physical-step algorithm v2 (compound medial as
// one step) to v3 (one step per typed key). `--dry-run` prints the plan only.
const { values } = parseArgs({
  options: { 'dry-run': { type: 'boolean', default: false } },
})
const root = process.cwd()
const reviewsRoot = join(root, 'tools/jamo-svg/reviews/pretendard-600')
const queueFile = join(root, 'tools/jamo-svg/queue/pretendard-600/queue.json')
const stable = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex')

const pathBounds = (d: string): Bounds | undefined => {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
  const xs = numbers.filter((_, index) => index % 2 === 0)
  const ys = numbers.filter((_, index) => index % 2 === 1)
  return xs.length
    ? {
        x1: Math.min(...xs),
        y1: Math.min(...ys),
        x2: Math.max(...xs),
        y2: Math.max(...ys),
      }
    : undefined
}
const boundsFor =
  (source: CachedGlyph, review: GlyphReview): GeometryBounds =>
  (ref) => {
    if (ref.kind === 'contour')
      return source.contours.find(({ id }) => id === ref.contourId)?.bounds
    const recipe = review.splitRecipes.find(({ id }) => id === ref.recipeId)
    return recipe
      ? pathBounds(compileRecipePiece(source, recipe, ref.pieceId))
      : undefined
  }
const label = (ref: GeometryRef) =>
  ref.kind === 'contour' ? `c${ref.contourId}` : ref.pieceId
const describe = (review: GlyphReview) =>
  review.steps
    .map((step) => `${step.jamo}:${step.geometry.map(label).join(',') || '-'}`)
    .join(' / ')

const manifest = JSON.parse(
  await readFile(join(reviewsRoot, 'manifest.json'), 'utf8'),
) as Omit<ReviewManifest, 'physicalStepAlgorithmVersion'> & {
  physicalStepAlgorithmVersion: number
}
if (manifest.physicalStepAlgorithmVersion !== 2)
  throw new Error(
    `Expected a review manifest on physical-step algorithm v2, found v${manifest.physicalStepAlgorithmVersion}.`,
  )
const queue = JSON.parse(await readFile(queueFile, 'utf8')) as QueueDocument
const glyphs = new Map(
  (
    await Promise.all(
      queue.entries.map(({ syllable }) => extractGlyph(syllable)),
    )
  ).map((glyph) => [glyph.syllable, glyph]),
)
const shards = await Promise.all(
  manifest.shards.map(async (item) => {
    const text = await readFile(join(reviewsRoot, item.file), 'utf8')
    if (sha256(text) !== item.sha256)
      throw new Error(`Review shard checksum mismatch for ${item.file}.`)
    return { item, shard: JSON.parse(text) as ReviewShard }
  }),
)
const diagnostics: string[] = []
const changes: string[] = []
let kept = 0
const migrated = shards.map(({ item, shard }) => {
  const reviews = Object.fromEntries(
    Object.entries(shard.reviews).map(([syllable, review]) => {
      const source =
        glyphs.get(syllable) ??
        (() => {
          throw new Error(`${syllable} is reviewed but missing from the queue.`)
        })()
      const result = migrateStepAlgorithmReview(
        review,
        source,
        boundsFor(source, review),
      )
      diagnostics.push(...result.diagnostics)
      const next = {
        ...result.review,
        blockers: [
          ...new Set([
            ...result.review.blockers.filter(
              (blocker) => blocker === 'needs-split',
            ),
            ...validateReview(source, result.review).blockers,
          ]),
        ],
      }
      if (next.steps.length !== review.steps.length)
        changes.push(
          `  ${syllable} ${review.status} → ${next.status}${next.blockers.length ? ` [${next.blockers.join(', ')}]` : ''}\n    v2: ${describe(review)}\n    v3: ${describe(next)}`,
        )
      else if (review.status === 'approved' && next.status === 'approved')
        kept += 1
      return [syllable, next]
    }),
  )
  return {
    item,
    text: stable({
      ...shard,
      physicalStepAlgorithmVersion: PHYSICAL_STEP_ALGORITHM_VERSION,
      reviews,
    }),
  }
})
console.log(changes.join('\n'))
if (diagnostics.length)
  console.log(`Needs manual split:\n  ${diagnostics.join('\n  ')}`)
console.log(
  `${changes.length} reviews change steps and return to reviewing; ${kept} approved reviews keep approval.`,
)
if (!values['dry-run']) {
  const cacheRoot = join(
    root,
    'tools/jamo-svg/cache',
    manifest.activeFontFingerprint,
  )
  await generateCache(cacheRoot, [...glyphs.keys()])
  for (const { item, text } of migrated)
    await atomicWrite(join(reviewsRoot, item.file), text)
  await atomicWrite(
    join(reviewsRoot, 'manifest.json'),
    stable({
      ...manifest,
      physicalStepAlgorithmVersion: PHYSICAL_STEP_ALGORITHM_VERSION,
      shards: migrated.map(({ item, text }) => ({
        ...item,
        sha256: sha256(text),
      })),
    }),
  )
  await atomicWrite(
    queueFile,
    stable({
      ...queue,
      entries: queue.entries.map((entry) => ({
        ...entry,
        queueKey: glyphs.get(entry.syllable)!.family.queueKey,
      })),
    }),
  )
  console.log(
    `Migrated ${migrated.length} review shards to physical-step algorithm v${PHYSICAL_STEP_ALGORITHM_VERSION}.`,
  )
}
