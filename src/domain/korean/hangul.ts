export const CHOSEONG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

export const JUNGSEONG_LIST = [
  'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
  'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ',
] as const

export const JONGSEONG_LIST = [
  '', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
  'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

const HANGUL_BASE = 0xac00
const JUNGSEONG_COUNT = JUNGSEONG_LIST.length
const JONGSEONG_COUNT = JONGSEONG_LIST.length
const SYLLABLE_COUNT = CHOSEONG_LIST.length * JUNGSEONG_COUNT * JONGSEONG_COUNT

export function decomposeSyllable(
  char: string,
): { choseong: string; jungseong: string; jongseong: string } | null {
  const code = char.codePointAt(0)
  if (code === undefined) return null

  const offset = code - HANGUL_BASE
  if (offset < 0 || offset >= SYLLABLE_COUNT) return null

  const jongseongIndex = offset % JONGSEONG_COUNT
  const jungseongIndex = Math.floor(offset / JONGSEONG_COUNT) % JUNGSEONG_COUNT
  const choseongIndex = Math.floor(offset / JONGSEONG_COUNT / JUNGSEONG_COUNT)

  return {
    choseong: CHOSEONG_LIST[choseongIndex],
    jungseong: JUNGSEONG_LIST[jungseongIndex],
    jongseong: JONGSEONG_LIST[jongseongIndex],
  }
}

export function composeSyllable(choseong: string, jungseong: string, jongseong = ''): string {
  const choseongIndex = CHOSEONG_LIST.indexOf(choseong as (typeof CHOSEONG_LIST)[number])
  const jungseongIndex = JUNGSEONG_LIST.indexOf(jungseong as (typeof JUNGSEONG_LIST)[number])
  const jongseongIndex = JONGSEONG_LIST.indexOf(jongseong as (typeof JONGSEONG_LIST)[number])

  if (choseongIndex < 0 || jungseongIndex < 0 || jongseongIndex < 0) {
    throw new Error(
      `Cannot compose syllable from choseong="${choseong}" jungseong="${jungseong}" jongseong="${jongseong}"`,
    )
  }

  const offset = (choseongIndex * JUNGSEONG_COUNT + jungseongIndex) * JONGSEONG_COUNT + jongseongIndex
  return String.fromCodePoint(HANGUL_BASE + offset)
}

/** Number of runtime Jamo SVG shards: one per choseong (DEC-039). */
export const CHOSEONG_SHARD_COUNT = CHOSEONG_LIST.length

/** Choseong index 0–18 of one precomposed syllable 가–힣; undefined otherwise. */
export function getChoseongShardIndex(syllable: string): number | undefined {
  if (Array.from(syllable).length !== 1) return undefined
  const offset = (syllable.codePointAt(0) ?? 0) - HANGUL_BASE
  if (offset < 0 || offset >= SYLLABLE_COUNT) return undefined
  return Math.floor(offset / (JUNGSEONG_COUNT * JONGSEONG_COUNT))
}

export function shardFileName(index: number): string {
  return `${String(index).padStart(2, '0')}.json`
}

export const COMPOUND_JUNGSEONG_PARTS: Record<string, [string, string]> = {
  ㅘ: ['ㅗ', 'ㅏ'],
  ㅙ: ['ㅗ', 'ㅐ'],
  ㅚ: ['ㅗ', 'ㅣ'],
  ㅝ: ['ㅜ', 'ㅓ'],
  ㅞ: ['ㅜ', 'ㅔ'],
  ㅟ: ['ㅜ', 'ㅣ'],
  ㅢ: ['ㅡ', 'ㅣ'],
}

export const COMPOUND_JONGSEONG_PARTS: Record<string, [string, string]> = {
  ㄳ: ['ㄱ', 'ㅅ'],
  ㄵ: ['ㄴ', 'ㅈ'],
  ㄶ: ['ㄴ', 'ㅎ'],
  ㄺ: ['ㄹ', 'ㄱ'],
  ㄻ: ['ㄹ', 'ㅁ'],
  ㄼ: ['ㄹ', 'ㅂ'],
  ㄽ: ['ㄹ', 'ㅅ'],
  ㄾ: ['ㄹ', 'ㅌ'],
  ㄿ: ['ㄹ', 'ㅍ'],
  ㅀ: ['ㄹ', 'ㅎ'],
  ㅄ: ['ㅂ', 'ㅅ'],
}

const CONJOINING_CHOSEONG_BASE = 0x1100
const CONJOINING_JUNGSEONG_BASE = 0x1161
const CONJOINING_JONGSEONG_BASE = 0x11a8

function toCompatibilityJamo(char: string): string {
  const code = char.codePointAt(0) ?? 0
  const choseong = CHOSEONG_LIST[code - CONJOINING_CHOSEONG_BASE]
  if (code >= CONJOINING_CHOSEONG_BASE && choseong) return choseong
  const jungseong = JUNGSEONG_LIST[code - CONJOINING_JUNGSEONG_BASE]
  if (code >= CONJOINING_JUNGSEONG_BASE && jungseong) return jungseong
  // JONGSEONG_LIST[0] is the empty "no final" slot.
  const jongseong = JONGSEONG_LIST[code - CONJOINING_JONGSEONG_BASE + 1]
  if (code >= CONJOINING_JONGSEONG_BASE && jongseong) return jongseong
  return char
}

/**
 * Rewrites Hangul into the characters the 2-beolsik keyboard types: composes
 * decomposed (NFD) syllables, then maps standalone modern conjoining jamo
 * (U+1100 block) to compatibility jamo (U+3131 block), e.g. ᄀ → ㄱ. Archaic
 * jamo with no key are left unchanged.
 */
export function normalizeHangulText(text: string): string {
  return Array.from(text.normalize('NFC'), toCompatibilityJamo).join('')
}
