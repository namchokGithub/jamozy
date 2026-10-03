import {
  getChoseongShardIndex,
  shardFileName,
} from '../../domain/korean/hangul'
import type {
  RuntimeJamoSvgGlyph,
  RuntimeJamoSvgShard,
} from '../../domain/korean/jamo-svg-runtime'

export type LoadedJamoSvgGlyphs = {
  unitsPerEm: number
  glyphs: Map<string, RuntimeJamoSvgGlyph>
}

// Static, read-only content; not learner state (DEC-039).
const shardCache = new Map<number, Promise<RuntimeJamoSvgShard>>()

function warn(message: string) {
  if (import.meta.env.DEV) console.warn(`[jamo-svg] ${message}`)
}

async function fetchShard(index: number): Promise<RuntimeJamoSvgShard> {
  const file = shardFileName(index)
  const response = await fetch(
    `${import.meta.env.BASE_URL}jamo-svg/pretendard-600/${file}`,
  )
  if (!response.ok)
    throw new Error(`shard ${file} returned HTTP ${response.status}`)
  const shard = (await response.json()) as RuntimeJamoSvgShard
  if (shard.datasetSchemaVersion !== 1)
    throw new Error(`shard ${file} has an unsupported schema version`)
  if (typeof shard.glyphs !== 'object' || shard.glyphs === null)
    throw new Error(`shard ${file} has no glyphs`)
  return shard
}

function loadShard(index: number) {
  let pending = shardCache.get(index)
  if (!pending) {
    const request = fetchShard(index)
    pending = request
    shardCache.set(index, request)
    request.catch(() => {
      if (shardCache.get(index) === request) shardCache.delete(index)
    })
  }
  return pending
}

/** Loads the shards the syllables need; undefined when any shard fails. */
export async function loadJamoSvgGlyphs(
  syllables: string[],
): Promise<LoadedJamoSvgGlyphs | undefined> {
  const indexes = syllables.map(getChoseongShardIndex)
  if (!indexes.length || indexes.some((index) => index === undefined))
    return undefined
  const unique = [...new Set(indexes as number[])]
  let shards: RuntimeJamoSvgShard[]
  try {
    shards = await Promise.all(unique.map(loadShard))
  } catch (error) {
    warn(error instanceof Error ? error.message : String(error))
    return undefined
  }
  const [first] = shards
  if (
    shards.some(
      (shard) =>
        shard.fontSha256 !== first.fontSha256 ||
        shard.unitsPerEm !== first.unitsPerEm,
    )
  ) {
    warn('shards disagree on font or units per em')
    return undefined
  }
  const glyphs = new Map<string, RuntimeJamoSvgGlyph>()
  syllables.forEach((syllable, position) => {
    const shard = shards[unique.indexOf(indexes[position] as number)]
    if (Object.hasOwn(shard.glyphs, syllable))
      glyphs.set(syllable, shard.glyphs[syllable])
  })
  return { unitsPerEm: first.unitsPerEm, glyphs }
}

export function resetJamoSvgDatasetCacheForTests() {
  shardCache.clear()
}
