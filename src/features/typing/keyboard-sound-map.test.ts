import { describe, expect, it } from 'vitest'
import { pressSoundFor, releaseSoundFor } from './keyboard-sound-map'

describe('pressSoundFor', () => {
  it('uses dedicated special-key sounds when the selected pack includes them', () => {
    expect(pressSoundFor('turquoise', 'Backspace')).toBe('press/BACKSPACE')
    expect(pressSoundFor('mxblack', 'NumpadEnter')).toBe('press/ENTER')
    expect(pressSoundFor('turquoise', 'Space')).toBe('press/SPACE')
  })

  it('uses the physical-row fallback for MX Blue special keys', () => {
    expect(pressSoundFor('mxblue', 'Backspace')).toBe('press/GENERIC_R1')
    expect(pressSoundFor('mxblue', 'Enter')).toBe('press/GENERIC_R3')
    expect(pressSoundFor('mxblue', 'Space')).toBe('press/GENERIC_R4')
  })

  it.each([
    ['Escape', 'press/GENERIC_R0'],
    ['Digit1', 'press/GENERIC_R1'],
    ['KeyQ', 'press/GENERIC_R2'],
    ['KeyA', 'press/GENERIC_R3'],
    ['KeyS', 'press/GENERIC_R3'],
    ['KeyB', 'press/GENERIC_R4'],
    ['KeyC', 'press/GENERIC_R4'],
    ['KeyZ', 'press/GENERIC_R4'],
    ['ControlLeft', 'press/GENERIC_R4'],
  ])('maps %s to %s', (code, expected) => {
    expect(pressSoundFor('turquoise', code)).toBe(expected)
  })
})

describe('releaseSoundFor', () => {
  it('uses dedicated release sounds only for packs that include them', () => {
    expect(releaseSoundFor('turquoise', 'Backspace')).toBe('release/BACKSPACE')
    expect(releaseSoundFor('mxblack', 'Enter')).toBe('release/ENTER')
    expect(releaseSoundFor('turquoise', 'Space')).toBe('release/SPACE')
  })

  it('uses the generic release sound for every MX Blue and non-special release', () => {
    expect(releaseSoundFor('mxblue', 'Backspace')).toBe('release/GENERIC')
    expect(releaseSoundFor('turquoise', 'KeyR')).toBe('release/GENERIC')
  })
})
