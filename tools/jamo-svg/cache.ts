import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { extractGlyph } from './extract'
import { PHYSICAL_STEP_ALGORITHM_VERSION, type CachedGlyph } from './types'

export const CACHE_SCHEMA_VERSION = 1 as const
export type CacheShard = { schemaVersion: 1; choseong: string; glyphs: Record<string, CachedGlyph> }
export type CacheManifest = { schemaVersion: 1; fontFingerprint: string; extractionSchemaVersion: 1; pathNormalizationVersion: 1; physicalStepAlgorithmVersion: typeof PHYSICAL_STEP_ALGORITHM_VERSION; shards: Array<{ choseong: string; file: string; glyphCount: number; sha256: string }> }
const stable = (value: unknown) => JSON.stringify(value, null, 2) + '\n'
const checksum = (value: string) => createHash('sha256').update(value).digest('hex')
export async function atomicWrite(file: string, text: string) {
  await mkdir(dirname(file), { recursive: true }); const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, text, 'utf8'); JSON.parse(await readFile(temp, 'utf8')); await rename(temp, file)
}
export async function generateCache(root: string, syllables: string[]) {
  const glyphs = await Promise.all(syllables.map((syllable) => extractGlyph(syllable)))
  const groups = new Map<string, CachedGlyph[]>()
  for (const glyph of glyphs) groups.set(glyph.hangul.choseong, [...(groups.get(glyph.hangul.choseong) ?? []), glyph])
  const shards: CacheManifest['shards'] = []
  for (const [choseong, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const shard: CacheShard = { schemaVersion: 1, choseong, glyphs: Object.fromEntries(group.sort((a, b) => a.syllable.localeCompare(b.syllable)).map((glyph) => [glyph.syllable, glyph])) }
    const text = stable(shard); const file = `choseong-${choseong}.json`; await atomicWrite(join(root, file), text)
    shards.push({ choseong, file, glyphCount: group.length, sha256: checksum(text) })
  }
  const fontFingerprint = glyphs[0]?.extraction.fontSha256 ?? ''
  const manifest: CacheManifest = { schemaVersion: CACHE_SCHEMA_VERSION, fontFingerprint, extractionSchemaVersion: 1, pathNormalizationVersion: 1, physicalStepAlgorithmVersion: PHYSICAL_STEP_ALGORITHM_VERSION, shards }
  await atomicWrite(join(root, 'manifest.json'), stable(manifest)); return manifest
}
export async function loadCacheGlyph(root: string, syllable: string): Promise<CachedGlyph> {
  const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')) as CacheManifest
  if (manifest.schemaVersion !== CACHE_SCHEMA_VERSION) throw new Error('Unsupported extraction cache schema.')
  const extracted = await extractGlyph(syllable); if (manifest.fontFingerprint !== extracted.extraction.fontSha256 || manifest.extractionSchemaVersion !== extracted.extraction.extractionSchema || manifest.pathNormalizationVersion !== extracted.extraction.pathNormalization || manifest.physicalStepAlgorithmVersion !== extracted.extraction.physicalStepAlgorithm) throw new Error('Stale extraction cache fingerprint.')
  const item = manifest.shards.find(({ choseong }) => choseong === extracted.hangul.choseong); if (!item) throw new Error(`Missing extraction cache shard for ${syllable}.`)
  const text = await readFile(join(root, item.file), 'utf8'); if (checksum(text) !== item.sha256) throw new Error(`Extraction cache checksum mismatch for ${item.file}.`)
  const glyph = (JSON.parse(text) as CacheShard).glyphs[syllable]; if (!glyph) throw new Error(`Missing cached glyph ${syllable}.`)
  return glyph
}
export async function removeCache(root: string) { await rm(root, { recursive: true, force: true }) }
