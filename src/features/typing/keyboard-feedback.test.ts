import { describe, expect, it } from 'vitest'
import type { ExpectedKey } from '../../domain/korean/target-sequence'
import { createKeyboardFeedback } from './keyboard-feedback'

const strictKey: ExpectedKey = {
  code: 'KeyQ',
  shift: true,
  jamo: 'ㅃ',
  syllableIndex: 0,
  slot: 'choseong',
  strictShift: true,
}

const nonStrictKey: ExpectedKey = {
  code: 'KeyK',
  shift: false,
  jamo: 'ㅏ',
  syllableIndex: 0,
  slot: 'jungseong',
  strictShift: false,
}

describe('createKeyboardFeedback', () => {
  it('reports a correct attempt when code and required Shift match', () => {
    expect(createKeyboardFeedback(strictKey, 'KeyQ', true, 1)).toEqual({
      id: 1,
      code: 'KeyQ',
      shift: true,
      outcome: 'correct',
    })
  })

  it('reports a wrong attempt for another key code', () => {
    expect(createKeyboardFeedback(strictKey, 'KeyW', true, 2)).toMatchObject({
      code: 'KeyW',
      shift: true,
      outcome: 'wrong',
    })
  })

  it('reports a wrong attempt when a strict Shift key is missing Shift', () => {
    expect(createKeyboardFeedback(strictKey, 'KeyQ', false, 3)).toMatchObject({
      outcome: 'wrong',
    })
  })

  it('accepts held Shift for a key without a Shift variant', () => {
    expect(createKeyboardFeedback(nonStrictKey, 'KeyK', true, 4)).toMatchObject({
      outcome: 'correct',
    })
  })

  it('does not create feedback when the session has no expected key', () => {
    expect(createKeyboardFeedback(undefined, 'KeyQ', false, 5)).toBeNull()
  })
})
