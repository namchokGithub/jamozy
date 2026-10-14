import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  CHOSEONG_SHARD_COUNT,
  getChoseongShardIndex,
  shardFileName,
} from '../../src/domain/korean/hangul'
import {
  STANDALONE_JAMO_SHARD_FILE,
  type RuntimeJamoSvgShard,
} from '../../src/domain/korean/jamo-svg-runtime'
import { compileReview, validateReview } from './compile'
import { extractGlyph, fontUnitsPerEm } from './extract'
import type { ReviewManifest, ReviewShard } from './review-store'
import type { CachedGlyph, GlyphReview } from './types'

export type ApprovedEntry = { glyph: CachedGlyph; review: GlyphReview }
export { STANDALONE_JAMO_SHARD_FILE }

function addCompiledGlyph(
  shard: RuntimeJamoSvgShard,
  glyph: CachedGlyph,
  review: GlyphReview,
) {
  const { blockers } = validateReview(glyph, review)
  if (blockers.length)
    throw new Error(
      `${glyph.syllable} is approved but fails validation: ${blockers.join(', ')}`,
    )
  const compiled = compileReview(glyph, review)
  shard.glyphs[glyph.syllable] = {
    width: compiled.width,
    paths: compiled.paths.map(({ jamo, d }) => ({
      jamo,
      d: roundPathNumbers(d),
    })),
  }
}

export function roundPathNumbers(d: string) {
  // Whole SVG numbers, including leading-dot (.5) and exponent (1e-7) forms.
  return d.replace(/-?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?/gi, (value) =>
    String(Math.round(Number(value) * 10) / 10 || 0),
  )
}

/** Builds all 19 runtime shards from approved reviews (DEC-039). */
export function buildRuntimeShards(
  entries: ApprovedEntry[],
  meta: { fontSha256: string; unitsPerEm: number },
): RuntimeJamoSvgShard[] {
  const shards = Array.from(
    { length: CHOSEONG_SHARD_COUNT },
    (): RuntimeJamoSvgShard => ({
      datasetSchemaVersion: 1,
      fontSha256: meta.fontSha256,
      unitsPerEm: meta.unitsPerEm,
      glyphs: {},
    }),
  )
  const sorted = [...entries].sort(
    (a, b) =>
      (a.glyph.syllable.codePointAt(0) ?? 0) -
      (b.glyph.syllable.codePointAt(0) ?? 0),
  )
  for (const { glyph, review } of sorted) {
    if (review.status !== 'approved') continue
    const index = getChoseongShardIndex(glyph.syllable)
    if (index === undefined)
      throw new Error(`${glyph.syllable} is not a Hangul syllable.`)
    addCompiledGlyph(shards[index], glyph, review)
  }
  return shards
}

/** Builds the dedicated runtime shard for approved standalone compatibility jamo. */
export function buildStandaloneJamoShard(
  entries: ApprovedEntry[],
  meta: { fontSha256: string; unitsPerEm: number },
): RuntimeJamoSvgShard {
  const shard: RuntimeJamoSvgShard = {
    datasetSchemaVersion: 1,
    fontSha256: meta.fontSha256,
    unitsPerEm: meta.unitsPerEm,
    glyphs: {},
  }
  for (const { glyph, review } of [...entries]
    .filter(({ glyph }) => glyph.kind === 'standalone-jamo')
    .sort(
      (a, b) =>
        (a.glyph.syllable.codePointAt(0) ?? 0) -
        (b.glyph.syllable.codePointAt(0) ?? 0),
    )) {
    if (review.status === 'approved') addCompiledGlyph(shard, glyph, review)
  }
  return shard
}

/** Stable text: fixed key order, one glyph per line, trailing newline. */
export function serializeRuntimeShard(shard: RuntimeJamoSvgShard) {
  const lines = Object.entries(shard.glyphs).map(
    ([syllable, { width, paths }]) =>
      `    ${JSON.stringify(syllable)}: ${JSON.stringify({
        width,
        paths: paths.map(({ jamo, d }) => ({ jamo, d })),
      })}`,
  )
  const glyphs = lines.length ? `{\n${lines.join(',\n')}\n  }` : '{}'
  return `{\n  "datasetSchemaVersion": ${shard.datasetSchemaVersion},\n  "fontSha256": ${JSON.stringify(shard.fontSha256)},\n  "unitsPerEm": ${shard.unitsPerEm},\n  "glyphs": ${glyphs}\n}\n`
}

/** Reads every approved review and returns the 19 serialized shards. */
export async function compileRuntimeShards(reviewsRoot: string) {
  const manifest = JSON.parse(
    await readFile(join(reviewsRoot, 'manifest.json'), 'utf8'),
  ) as ReviewManifest
  const entries: ApprovedEntry[] = []
  for (const item of manifest.shards) {
    const shard = JSON.parse(
      await readFile(join(reviewsRoot, item.file), 'utf8'),
    ) as ReviewShard
    for (const review of Object.values(shard.reviews)) {
      if (review.status !== 'approved') continue
      const glyph = await extractGlyph(review.syllable)
      if (
        glyph.extraction.fontSha256 !== manifest.activeFontFingerprint ||
        glyph.extraction.physicalStepAlgorithm !==
          manifest.physicalStepAlgorithmVersion
      )
        throw new Error(
          `${review.syllable}: font or step-algorithm fingerprint differs from the review manifest; migrate reviews first.`,
        )
      entries.push({ glyph, review })
    }
  }
  const meta = {
    fontSha256: manifest.activeFontFingerprint,
    unitsPerEm: await fontUnitsPerEm(),
  }
  return {
    syllableShards: buildRuntimeShards(
      entries.filter(({ glyph }) => glyph.kind === 'syllable'),
      meta,
    ).map(serializeRuntimeShard),
    standaloneJamoShard: serializeRuntimeShard(
      buildStandaloneJamoShard(entries, meta),
    ),
  }
}

/**
 * Writes every shard to a staging file first and renames them into place only
 * after all writes succeed, so a failed run leaves the previous set intact.
 */
export async function writeRuntimeShards(
  outDir: string,
  texts: string[],
  standaloneJamoText?: string,
) {
  await mkdir(outDir, { recursive: true })
  const files = [
    ...texts.map((_, index) => join(outDir, shardFileName(index))),
    ...(standaloneJamoText === undefined
      ? []
      : [join(outDir, STANDALONE_JAMO_SHARD_FILE)]),
  ]
  const allTexts =
    standaloneJamoText === undefined ? texts : [...texts, standaloneJamoText]
  const staged: string[] = []
  try {
    for (const [index, file] of files.entries()) {
      await writeFile(`${file}.tmp`, allTexts[index])
      staged.push(`${file}.tmp`)
    }
  } catch (error) {
    await Promise.all(staged.map((temp) => rm(temp, { force: true })))
    throw error
  }
  for (const file of files) await rename(`${file}.tmp`, file)
}
