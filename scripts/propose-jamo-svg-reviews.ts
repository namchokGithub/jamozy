import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import { extractGlyph } from '../tools/jamo-svg/extract'
import { proposeReview, type ApprovedTemplate } from '../tools/jamo-svg/propose'
import { QueueStore, ReviewStore, type ReviewManifest, type ReviewShard } from '../tools/jamo-svg/review-store'

// Writes `proposed` reviews for queue syllables that have no review yet, by
// copying whole-contour ownership from the closest approved glyph. Existing
// reviews of any status are never touched. A human still approves each one.
const { values } = parseArgs({ options: { 'max-cost': { type: 'string', default: '250' }, exclude: { type: 'string', default: '' }, 'dry-run': { type: 'boolean', default: false } } })
const maxCost = Number(values['max-cost'])
if (!Number.isFinite(maxCost)) throw new Error(`--max-cost must be a number, received ${values['max-cost']}.`)
const excluded = new Set([...values.exclude].filter((char) => char.trim() && char !== ','))
const root = process.cwd()
const reviewsRoot = join(root, 'tools/jamo-svg/reviews/pretendard-600')
const manifest = JSON.parse(await readFile(join(reviewsRoot, 'manifest.json'), 'utf8')) as ReviewManifest
const cacheRoot = join(root, 'tools/jamo-svg/cache', manifest.activeFontFingerprint)
const queue = new QueueStore(join(root, 'tools/jamo-svg/queue/pretendard-600/queue.json'), manifest.activeFontFingerprint)

const reviewed = new Set<string>()
const templates: ApprovedTemplate[] = []
for (const { file } of manifest.shards) {
  const shard = JSON.parse(await readFile(join(reviewsRoot, file), 'utf8')) as ReviewShard
  for (const [syllable, review] of Object.entries(shard.reviews)) {
    reviewed.add(syllable)
    if (review.status === 'approved' && !excluded.has(syllable)) templates.push({ glyph: await extractGlyph(syllable), review })
  }
}
const store = new ReviewStore(reviewsRoot, cacheRoot)
const entries = await queue.list()
const proposedFrom = new Map<string, string>()
for (const entry of entries) {
  if (reviewed.has(entry.syllable)) continue
  const proposal = proposeReview(await extractGlyph(entry.syllable), templates, maxCost)
  if (!proposal) continue
  proposedFrom.set(entry.syllable, proposal.templateSyllable)
  if (!values['dry-run']) await store.save(proposal.review)
}
if (!values['dry-run']) await queue.save(entries.map((entry) => (proposedFrom.has(entry.syllable) ? { ...entry, nearestApprovedSyllables: [proposedFrom.get(entry.syllable)!] } : entry)))
const unreviewed = entries.filter(({ syllable }) => !reviewed.has(syllable)).length
console.log(`${templates.length} approved templates; ${values['dry-run'] ? 'would propose' : 'proposed'} ${proposedFrom.size} of ${unreviewed} unreviewed syllables (max cost ${maxCost}).`)
