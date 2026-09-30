import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { generateCache } from '../tools/jamo-svg/cache'
import { extractGlyph } from '../tools/jamo-svg/extract'
import { QueueStore, ReviewStore, initializeReviewManifest, type QueueEntry } from '../tools/jamo-svg/review-store'
import { REFERENCE_SYLLABLES, seedReview } from '../tools/jamo-svg/seed'

const root = process.cwd()
const valuesSlice = ['값', '낪', '닶']
const oneContour = ['굵', '굸', '귟', '귌']
const surplus = ['하', '녕', '화']
const syllables = [...new Set([...REFERENCE_SYLLABLES, ...valuesSlice, ...oneContour, ...surplus])]
const glyphs = await Promise.all(syllables.map((syllable) => extractGlyph(syllable)))
const fingerprint = glyphs[0].extraction.fontSha256
const cacheRoot = join(root, 'tools/jamo-svg/cache', fingerprint)
const reviewsRoot = join(root, 'tools/jamo-svg/reviews/pretendard-600')
const queueFile = join(root, 'tools/jamo-svg/queue/pretendard-600/queue.json')
await generateCache(cacheRoot, syllables)
await mkdir(reviewsRoot, { recursive: true })
await initializeReviewManifest(reviewsRoot, fingerprint)
const reviews = new ReviewStore(reviewsRoot, cacheRoot)
for (const syllable of REFERENCE_SYLLABLES) await reviews.save(await seedReview(syllable))
const entries: QueueEntry[] = glyphs.map((glyph) => ({ syllable: glyph.syllable, priority: REFERENCE_SYLLABLES.includes(glyph.syllable as typeof REFERENCE_SYLLABLES[number]) ? 1 : glyph.hangul.compoundFinal === 'ㅄ' ? 2 : glyph.signals.oneContourMultiStep ? 3 : 4, reasons: REFERENCE_SYLLABLES.includes(glyph.syllable as typeof REFERENCE_SYLLABLES[number]) ? ['verified-reference'] : glyph.hangul.compoundFinal === 'ㅄ' ? ['compound-final-ㅄ'] : glyph.signals.oneContourMultiStep ? ['one-contour-multi-step'] : ['contour-surplus'], queueKey: glyph.family.queueKey, nearestApprovedSyllables: [] }))
await new QueueStore(queueFile, fingerprint).save(entries)
console.log(`Generated ${glyphs.length} cached glyphs and ${REFERENCE_SYLLABLES.length} reviewed references.`)
