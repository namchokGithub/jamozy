import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { generateCache, loadCacheGlyph } from './cache'
import { addToCache, cachedSyllables, FREQUENCY_QUEUE_PRIORITY, mergeQueueEntries, parseWordList, syllablesByFirstAppearance } from './enqueue'
import { extractGlyph } from './extract'
import { QueueStore, type QueueEntry } from './review-store'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))) })
const tempRoot = async () => { const root = await mkdtemp(join(tmpdir(), 'jamo-svg-enqueue-')); roots.push(root); return root }

describe('frequency-list enqueue', () => {
  test('parses word lines and skips headings and blanks', () => {
    expect(parseWordList('# Title\n\n## 1 - 1000\n\n것\n하다\n \n있다\n')).toEqual(['것', '하다', '있다'])
  })

  test('orders unique syllables by the first word that uses them', () => {
    expect(syllablesByFirstAppearance(['하다', '있다', '다시', 'TV 가'])).toEqual([
      { syllable: '하', rank: 1 }, { syllable: '다', rank: 1 }, { syllable: '있', rank: 2 }, { syllable: '시', rank: 3 }, { syllable: '가', rank: 4 },
    ])
  })

  test('appends only missing syllables, keeps existing entries unchanged, and is idempotent', async () => {
    const existingGlyph = await extractGlyph('하')
    const existing: QueueEntry[] = [{ syllable: '하', priority: 1, reasons: ['verified-reference'], queueKey: existingGlyph.family.queueKey, nearestApprovedSyllables: [] }]
    const additions = await Promise.all([{ syllable: '하', rank: 1 }, { syllable: '다', rank: 1 }, { syllable: '있', rank: 2 }].map(async ({ syllable, rank }) => ({ glyph: await extractGlyph(syllable), rank })))
    const once = mergeQueueEntries(existing, additions, 'frequency-list:korean-5800')
    expect(once[0]).toBe(existing[0])
    expect(once.slice(1)).toEqual([
      expect.objectContaining({ syllable: '다', priority: FREQUENCY_QUEUE_PRIORITY, sourceRank: 1, reasons: ['frequency-list:korean-5800'] }),
      expect.objectContaining({ syllable: '있', priority: FREQUENCY_QUEUE_PRIORITY, sourceRank: 2 }),
    ])
    expect(mergeQueueEntries(once, additions, 'frequency-list:korean-5800')).toEqual(once)
  })

  test('adds glyphs to the extraction cache without dropping cached ones', async () => {
    const root = await tempRoot()
    await generateCache(root, ['가', '하'])
    await addToCache(root, ['하', '있', '다'])
    expect((await cachedSyllables(root)).sort()).toEqual(['가', '다', '있', '하'])
    await expect(loadCacheGlyph(root, '가')).resolves.toMatchObject({ syllable: '가' })
    await expect(loadCacheGlyph(root, '있')).resolves.toMatchObject({ syllable: '있' })
  })

  test('queue file lists curated priorities first, then frequency rank', async () => {
    const root = await tempRoot(); const file = join(root, 'queue.json')
    const key = (await extractGlyph('가')).family.queueKey
    const entry = (syllable: string, priority: number, sourceRank?: number): QueueEntry => ({ syllable, priority, reasons: [], sourceRank, queueKey: key, nearestApprovedSyllables: [] })
    await new QueueStore(file, 'font').save([entry('다', 5, 3), entry('하', 1), entry('것', 5, 1), entry('값', 2)])
    const saved = JSON.parse(await readFile(file, 'utf8')) as { entries: QueueEntry[] }
    expect(saved.entries.map(({ syllable }) => syllable)).toEqual(['하', '값', '것', '다'])
  })
})
