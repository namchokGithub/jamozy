import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseArgs } from 'node:util'
import {
  addToCache,
  mergeQueueEntries,
  parseWordList,
  syllablesByFirstAppearance,
} from '../tools/jamo-svg/enqueue'
import { extractGlyph } from '../tools/jamo-svg/extract'
import { QueueStore, type ReviewManifest } from '../tools/jamo-svg/review-store'

// Adds syllables from a word list to the Jamo SVG Tagger queue. Unlike
// `jamo-svg:seed`, this never touches review records or the review manifest.
// `--dry-run` lists the syllables it would add and writes nothing.
const { values } = parseArgs({
  options: {
    words: { type: 'string', default: 'docs/informations/korean_words.md' },
    top: { type: 'string' },
    reason: { type: 'string', default: 'frequency-list:korean-5800' },
    'dry-run': { type: 'boolean', default: false },
  },
})
const root = process.cwd()
const reviewsRoot = join(root, 'tools/jamo-svg/reviews/pretendard-600')
const queueFile = join(root, 'tools/jamo-svg/queue/pretendard-600/queue.json')

const top = values.top === undefined ? Infinity : Number(values.top)
if (!Number.isInteger(top) && top !== Infinity)
  throw new Error(`--top must be an integer, received ${values.top}.`)
const words = parseWordList(
  await readFile(join(root, values.words), 'utf8'),
).slice(0, top)
const wanted = syllablesByFirstAppearance(words)
const manifest = JSON.parse(
  await readFile(join(reviewsRoot, 'manifest.json'), 'utf8'),
) as ReviewManifest
const glyphs = await Promise.all(
  wanted.map(async ({ syllable, rank }) => ({
    glyph: await extractGlyph(syllable),
    rank,
  })),
)
if (
  glyphs.some(
    ({ glyph }) =>
      glyph.extraction.fontSha256 !== manifest.activeFontFingerprint ||
      glyph.extraction.physicalStepAlgorithm !==
        manifest.physicalStepAlgorithmVersion,
  )
)
  throw new Error(
    'Font or step-algorithm fingerprint differs from the review manifest; migrate reviews first.',
  )
const queue = new QueueStore(queueFile, manifest.activeFontFingerprint)
const existing = await queue.list()
const merged = mergeQueueEntries(existing, glyphs, values.reason)
const added = merged.slice(existing.length)
if (added.length)
  console.log(
    added
      .map(({ syllable, sourceRank }) => `  ${syllable}  word ${sourceRank}`)
      .join('\n'),
  )
if (values['dry-run']) {
  console.log(
    `${words.length} words → ${wanted.length} syllables; would add ${added.length}, queue would be ${merged.length}. Nothing written.`,
  )
  process.exit(0)
}
await addToCache(
  join(root, 'tools/jamo-svg/cache', manifest.activeFontFingerprint),
  merged.map(({ syllable }) => syllable),
)
await queue.save(merged)
console.log(
  `${words.length} words → ${wanted.length} syllables; added ${merged.length - existing.length}, queue now ${merged.length}.`,
)
