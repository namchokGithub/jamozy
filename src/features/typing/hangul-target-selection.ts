import { getChoseongShardIndex } from '../../domain/korean/hangul'
import type {
  LoadedJamoSvgGlyphs,
  RuntimeJamoSvgGlyph,
} from '../../domain/korean/jamo-svg-runtime'
import type { ExpectedKey } from '../../domain/korean/target-sequence'

/** One typed character of the target: a precomposed syllable or a space (`' '`). */
export type SyllableGroup = { syllable: string; jamo: string[] }

export const isSpaceGroup = ({ syllable }: SyllableGroup) => syllable === ' '

export type RendererChoice =
  | {
      kind: 'svg'
      unitsPerEm: number
      glyphs: Map<string, RuntimeJamoSvgGlyph>
    }
  | { kind: 'canvas'; reason: string }

/**
 * Target syllables and spaces with their typed keys; undefined when any other
 * character (jamo, punctuation) appears or the target has no syllable.
 */
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
    if (syllable !== ' ' && getChoseongShardIndex(syllable) === undefined)
      return undefined
    result.push({ syllable, jamo })
  }
  return result.some((group) => !isSpaceGroup(group)) ? result : undefined
}

/** Syllables of the target, without spaces, for loading glyphs. */
export const targetSyllables = (groups: SyllableGroup[]) =>
  groups.filter((group) => !isSpaceGroup(group)).map(({ syllable }) => syllable)

/** SVG only when every syllable has a glyph whose paths match its typed keys; spaces need none (DEC-039, DEC-040). */
export function chooseRenderer(
  allGroups: SyllableGroup[],
  loaded: LoadedJamoSvgGlyphs | undefined,
): RendererChoice {
  const groups = allGroups.filter((group) => !isSpaceGroup(group))
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
