import { KEY_TO_JAMO, JAMO_TO_KEY } from './keymap'
import {
  COMPOUND_JONGSEONG_PARTS,
  COMPOUND_JUNGSEONG_PARTS,
  decomposeSyllable,
} from './hangul'

export type JamoSlot = 'choseong' | 'jungseong' | 'jongseong' | 'literal'

export interface ExpectedKey {
  code: string
  shift: boolean
  jamo: string
  syllableIndex: number
  slot: JamoSlot
  /**
   * Whether the physical key at `code` has a Shift variant at all. When
   * false, the key types the same jamo regardless of Shift state (e.g. a
   * learner who is still holding Shift from the previous tense consonant),
   * so `pressKey` should not require an exact Shift match for it.
   */
  strictShift: boolean
}

function toExpectedKey(jamo: string, syllableIndex: number, slot: JamoSlot): ExpectedKey {
  const key = JAMO_TO_KEY[jamo]
  if (!key) {
    throw new Error(`No keymap entry for character: "${jamo}"`)
  }
  const strictShift = Boolean(KEY_TO_JAMO[key.code]?.shift)
  return { code: key.code, shift: key.shift, jamo, syllableIndex, slot, strictShift }
}

function expandParts(jamo: string, compoundParts: Record<string, [string, string]>): string[] {
  const parts = compoundParts[jamo]
  return parts ? [...parts] : [jamo]
}

export function buildExpectedKeys(targetText: string): ExpectedKey[] {
  const keys: ExpectedKey[] = []

  Array.from(targetText).forEach((char, syllableIndex) => {
    const decomposed = decomposeSyllable(char)

    if (!decomposed) {
      // Standalone compound vowels (for example ㅘ) have no direct physical
      // key, but are typeable through their two 2-beolsik vowel keys.
      for (const jamo of expandParts(char, COMPOUND_JUNGSEONG_PARTS)) {
        keys.push(toExpectedKey(jamo, syllableIndex, 'literal'))
      }
      return
    }

    const { choseong, jungseong, jongseong } = decomposed
    keys.push(toExpectedKey(choseong, syllableIndex, 'choseong'))

    for (const jamo of expandParts(jungseong, COMPOUND_JUNGSEONG_PARTS)) {
      keys.push(toExpectedKey(jamo, syllableIndex, 'jungseong'))
    }

    if (jongseong) {
      for (const jamo of expandParts(jongseong, COMPOUND_JONGSEONG_PARTS)) {
        keys.push(toExpectedKey(jamo, syllableIndex, 'jongseong'))
      }
    }
  })

  return keys
}

/**
 * Distinct characters in `targetText` that the 2-beolsik keymap cannot type,
 * in order of appearance — for example conjoining jamo such as U+1100, which
 * look like compatibility jamo (ㄱ U+3131) but have no key.
 */
export function findUntypeableCharacters(targetText: string): string[] {
  const untypeable = new Set<string>()
  for (const char of Array.from(targetText)) {
    try {
      buildExpectedKeys(char)
    } catch {
      untypeable.add(char)
    }
  }
  return [...untypeable]
}

/** Formats characters for an error message, e.g. `"ᄀ" U+1100`. */
export function formatCharacters(chars: string[]): string {
  return chars
    .map((char) => {
      const codePoint = char.codePointAt(0) ?? 0
      return `"${char}" U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`
    })
    .join(', ')
}
