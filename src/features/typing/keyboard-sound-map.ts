import type { KeyboardSoundPack } from '../../domain/models/user-profile'

export type KeyboardSoundName =
  | 'press/BACKSPACE'
  | 'press/ENTER'
  | 'press/SPACE'
  | 'press/GENERIC_R0'
  | 'press/GENERIC_R1'
  | 'press/GENERIC_R2'
  | 'press/GENERIC_R3'
  | 'press/GENERIC_R4'
  | 'release/BACKSPACE'
  | 'release/ENTER'
  | 'release/SPACE'
  | 'release/GENERIC'

const specialPressRows: Record<string, KeyboardSoundName> = {
  Backspace: 'press/GENERIC_R1',
  Enter: 'press/GENERIC_R3',
  NumpadEnter: 'press/GENERIC_R3',
  Space: 'press/GENERIC_R4',
}

function genericPressFor(code: string): KeyboardSoundName {
  if (/^(Escape|F(?:[1-9]|1[0-2]))$/.test(code)) return 'press/GENERIC_R0'
  if (/^(Backquote|Digit[0-9]|Minus|Equal)$/.test(code)) return 'press/GENERIC_R1'
  if (/^(Tab|Key[QWERTYUIOP]|BracketLeft|BracketRight|Backslash)$/.test(code)) return 'press/GENERIC_R2'
  if (/^(CapsLock|Key[ASDFGHJKL]|Semicolon|Quote)$/.test(code)) return 'press/GENERIC_R3'
  return 'press/GENERIC_R4'
}

export function pressSoundFor(pack: KeyboardSoundPack, code: string): KeyboardSoundName {
  if (pack !== 'mxblue') {
    if (code === 'Backspace') return 'press/BACKSPACE'
    if (code === 'Enter' || code === 'NumpadEnter') return 'press/ENTER'
    if (code === 'Space') return 'press/SPACE'
  }
  return specialPressRows[code] ?? genericPressFor(code)
}

export function releaseSoundFor(pack: KeyboardSoundPack, code: string): KeyboardSoundName {
  if (pack !== 'mxblue') {
    if (code === 'Backspace') return 'release/BACKSPACE'
    if (code === 'Enter' || code === 'NumpadEnter') return 'release/ENTER'
    if (code === 'Space') return 'release/SPACE'
  }
  return 'release/GENERIC'
}
