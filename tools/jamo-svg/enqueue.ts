import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { generateCache, type CacheManifest, type CacheShard } from './cache'
import type { QueueEntry } from './review-store'
import type { CachedGlyph } from './types'

export const FREQUENCY_QUEUE_PRIORITY = 5

const isHangulSyllable = (char: string) => char >= '가' && char <= '힣'

/** Non-empty, non-heading lines of a Markdown word list, in file order. */
export function parseWordList(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line && !line.startsWith('#'))
}

/** Unique Hangul syllables in first-appearance order; `rank` is the 1-based index of the first text using the syllable. */
export function syllablesByFirstAppearance(texts: string[]): Array<{ syllable: string; rank: number }> {
  const seen = new Map<string, number>()
  texts.forEach((text, index) => { for (const char of text) if (isHangulSyllable(char) && !seen.has(char)) seen.set(char, index + 1) })
  return [...seen].map(([syllable, rank]) => ({ syllable, rank }))
}

/** Appends syllables missing from the queue. Existing entries, including their priority and reasons, are never changed. */
export function mergeQueueEntries(existing: QueueEntry[], additions: Array<{ glyph: CachedGlyph; rank: number }>, reason: string): QueueEntry[] {
  const known = new Set(existing.map(({ syllable }) => syllable))
  const added = additions.filter(({ glyph }) => !known.has(glyph.syllable)).map(({ glyph, rank }): QueueEntry => ({ syllable: glyph.syllable, priority: FREQUENCY_QUEUE_PRIORITY, reasons: [reason], sourceRank: rank, queueKey: glyph.family.queueKey, nearestApprovedSyllables: [] }))
  return [...existing, ...added]
}

export async function cachedSyllables(root: string): Promise<string[]> {
  let manifest: CacheManifest
  try { manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')) as CacheManifest } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error }
  const shards = await Promise.all(manifest.shards.map(async ({ file }) => JSON.parse(await readFile(join(root, file), 'utf8')) as CacheShard))
  return shards.flatMap((shard) => Object.keys(shard.glyphs))
}

/** Regenerates the extraction cache for the union of already-cached and new syllables, so no cached glyph is dropped. */
export async function addToCache(root: string, syllables: string[]) {
  return generateCache(root, [...new Set([...(await cachedSyllables(root)), ...syllables])])
}
