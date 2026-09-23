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
