import { getChoseongShardIndex } from '../../domain/korean/hangul'
import type { RuntimeJamoSvgGlyph } from '../../domain/korean/jamo-svg-runtime'
import type { ExpectedKey } from '../../domain/korean/target-sequence'
import type { LoadedJamoSvgGlyphs } from '../../infrastructure/jamo-svg/jamo-svg-dataset'

export type SyllableGroup = { syllable: string; jamo: string[] }

export type RendererChoice =
  | {
      kind: 'svg'
      unitsPerEm: number
      glyphs: Map<string, RuntimeJamoSvgGlyph>
    }
  | { kind: 'canvas'; reason: string }

/** Target syllables with their typed jamo; undefined when any group is not a precomposed syllable. */
export function svgTargetSyllables(
  targetText: string,
  expectedKeys: ExpectedKey[],
): SyllableGroup[] | undefined {
  const characters = Array.from(targetText)
  const groups = new Map<number, string[]>()
  for (const key of expectedKeys) {
    const jamo = groups.get(key.syllableIndex) ?? []
    jamo.push(key.jamo)
    groups.set(key.syllableIndex, jamo)
  }
  const result: SyllableGroup[] = []
  for (const [syllableIndex, jamo] of groups) {
    const syllable = characters[syllableIndex] ?? ''
    if (getChoseongShardIndex(syllable) === undefined) return undefined
    result.push({ syllable, jamo })
  }
  return result.length ? result : undefined
}

/** SVG only when every syllable has a glyph whose paths match its typed keys (DEC-039). */
export function chooseRenderer(
  groups: SyllableGroup[],
  loaded: LoadedJamoSvgGlyphs | undefined,
): RendererChoice {
  if (!loaded)
    return { kind: 'canvas', reason: 'a runtime shard failed to load' }
  const missing = [
    ...new Set(
      groups
        .filter(({ syllable }) => !loaded.glyphs.has(syllable))
        .map(({ syllable }) => syllable),
    ),
  ]
  if (missing.length)
    return {
      kind: 'canvas',
      reason: `no approved SVG for ${missing.join(' ')}`,
    }
  const mismatched = groups.filter(({ syllable, jamo }) => {
    const paths = loaded.glyphs.get(syllable)?.paths ?? []
    return (
      paths.length !== jamo.length ||
      paths.some((path, index) => path.jamo !== jamo[index])
    )
  })
  if (mismatched.length)
    return {
      kind: 'canvas',
      reason: `step mismatch for ${mismatched.map(({ syllable }) => syllable).join(' ')}`,
    }
  return { kind: 'svg', unitsPerEm: loaded.unitsPerEm, glyphs: loaded.glyphs }
}
