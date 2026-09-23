import { buildExpectedKeys, type ExpectedKey } from './target-sequence'
import { COMPOUND_JONGSEONG_PARTS, COMPOUND_JUNGSEONG_PARTS, composeSyllable } from './hangul'

export type CharacterState = 'correct' | 'current' | 'pending'

export interface TypingSessionState {
  targetText: string
  expectedKeys: ExpectedKey[]
  keyIndex: number
  mistakeCount: number
  status: 'in-progress' | 'completed'
}

export function startTypingSession(targetText: string): TypingSessionState {
  const expectedKeys = buildExpectedKeys(targetText)
  return {
    targetText,
    expectedKeys,
    keyIndex: 0,
    mistakeCount: 0,
    status: expectedKeys.length === 0 ? 'completed' : 'in-progress',
  }
}

const MODIFIER_CODES = new Set([
  'ShiftLeft', 'ShiftRight',
  'ControlLeft', 'ControlRight',
  'AltLeft', 'AltRight',
  'MetaLeft', 'MetaRight',
  'CapsLock',
])

export function pressKey(state: TypingSessionState, code: string, shiftKey: boolean): TypingSessionState {
  if (state.status === 'completed' || MODIFIER_CODES.has(code)) {
    return state
  }

  const expected = state.expectedKeys[state.keyIndex]
  const shiftMatches = expected.strictShift ? expected.shift === shiftKey : true
  if (expected.code === code && shiftMatches) {
    const keyIndex = state.keyIndex + 1
    return {
      ...state,
      keyIndex,
      status: keyIndex === state.expectedKeys.length ? 'completed' : 'in-progress',
    }
  }

  return { ...state, mistakeCount: state.mistakeCount + 1 }
}

function syllableIndexes(state: TypingSessionState): number[] {
  return [...new Set(state.expectedKeys.map((k) => k.syllableIndex))]
}

function recombine(group: ExpectedKey[]): string {
  if (group.length === 1) return group[0].jamo
  const table = group[0].slot === 'jungseong' ? COMPOUND_JUNGSEONG_PARTS : COMPOUND_JONGSEONG_PARTS
  const match = Object.entries(table).find(
    ([, parts]) => parts[0] === group[0].jamo && parts[1] === group[1].jamo,
  )
  if (!match) {
    throw new Error(`Cannot recombine jamo parts: ${group.map((k) => k.jamo).join(', ')}`)
  }
  return match[0]
}

function composeFullSyllable(fullGroup: ExpectedKey[]): string {
  const choseong = fullGroup.find((k) => k.slot === 'choseong')!.jamo
  const jungseong = recombine(fullGroup.filter((k) => k.slot === 'jungseong'))
  const jongseongGroup = fullGroup.filter((k) => k.slot === 'jongseong')
  return composeSyllable(choseong, jungseong, jongseongGroup.length ? recombine(jongseongGroup) : undefined)
}

// The first key of any 2-key compound jungseong/jongseong (ㅗ ㅜ ㅡ; ㄱ ㄴ ㄹ ㅂ)
// is itself a complete, valid jamo in that slot — so it's safe to compose
// with just that one key while its compound partner hasn't landed yet,
// rather than showing no visible change for a correct keystroke.
function partialJamo(typed: ExpectedKey[], total: number): string | undefined {
  if (typed.length === 0) return undefined
  if (typed.length === total) return recombine(typed)
  return typed[0].jamo
}

function composePartialSyllable(typedGroup: ExpectedKey[], fullGroup: ExpectedKey[]): string {
  const choseong = typedGroup.find((k) => k.slot === 'choseong')
  if (!choseong) return ''

  const jungseongTotal = fullGroup.filter((k) => k.slot === 'jungseong').length
  const jungseongTyped = typedGroup.filter((k) => k.slot === 'jungseong')
  const jungseong = partialJamo(jungseongTyped, jungseongTotal)
  if (!jungseong) return choseong.jamo

  const jongseongTotal = fullGroup.filter((k) => k.slot === 'jongseong').length
  const jongseongTyped = typedGroup.filter((k) => k.slot === 'jongseong')
  const jongseong = partialJamo(jongseongTyped, jongseongTotal)

  return composeSyllable(choseong.jamo, jungseong, jongseong)
}

export function getComposedText(state: TypingSessionState): string {
  const typedKeys = state.expectedKeys.slice(0, state.keyIndex)
  let result = ''

  for (const syllableIndex of syllableIndexes(state)) {
    const fullGroup = state.expectedKeys.filter((k) => k.syllableIndex === syllableIndex)
    const typedGroup = typedKeys.filter((k) => k.syllableIndex === syllableIndex)

    if (typedGroup.length === 0) break

    if (fullGroup[0].slot === 'literal') {
      result += fullGroup[0].jamo
      continue
    }

    result +=
      typedGroup.length === fullGroup.length
        ? composeFullSyllable(fullGroup)
        : composePartialSyllable(typedGroup, fullGroup)
  }

  return result
}

export function getCharacterStates(state: TypingSessionState): CharacterState[] {
  const characters = Array.from(state.targetText)
  const currentSyllableIndex = state.expectedKeys[state.keyIndex]?.syllableIndex

  return characters.map((_, syllableIndex) => {
    const fullGroup = state.expectedKeys.filter((k) => k.syllableIndex === syllableIndex)
    const typedCount = state.expectedKeys
      .slice(0, state.keyIndex)
      .filter((k) => k.syllableIndex === syllableIndex).length

    if (fullGroup.length > 0 && typedCount === fullGroup.length) return 'correct'
    if (syllableIndex === currentSyllableIndex) return 'current'
    return 'pending'
  })
}

export function getAccuracy(state: TypingSessionState): number {
  const attempts = state.keyIndex + state.mistakeCount
  return attempts === 0 ? 0 : state.keyIndex / attempts
}

export function getProgress(state: TypingSessionState): { typed: number; total: number } {
  const indexes = syllableIndexes(state)
  const typed = indexes.filter((syllableIndex) => {
    const fullGroup = state.expectedKeys.filter((k) => k.syllableIndex === syllableIndex)
    const typedGroup = state.expectedKeys
      .slice(0, state.keyIndex)
      .filter((k) => k.syllableIndex === syllableIndex)
    return typedGroup.length === fullGroup.length
  }).length

  return { typed, total: indexes.length }
}
