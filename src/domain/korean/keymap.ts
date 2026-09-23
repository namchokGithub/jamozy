export const KEY_TO_JAMO: Record<string, { base: string; shift?: string }> = {
  // Choseong (initial consonant) keys
  KeyQ: { base: 'ㅂ', shift: 'ㅃ' },
  KeyW: { base: 'ㅈ', shift: 'ㅉ' },
  KeyE: { base: 'ㄷ', shift: 'ㄸ' },
  KeyR: { base: 'ㄱ', shift: 'ㄲ' },
  KeyT: { base: 'ㅅ', shift: 'ㅆ' },
  KeyA: { base: 'ㅁ' },
  KeyS: { base: 'ㄴ' },
  KeyD: { base: 'ㅇ' },
  KeyF: { base: 'ㄹ' },
  KeyG: { base: 'ㅎ' },
  KeyZ: { base: 'ㅋ' },
  KeyX: { base: 'ㅌ' },
  KeyC: { base: 'ㅊ' },
  KeyV: { base: 'ㅍ' },
  // Jungseong (vowel) keys
  KeyY: { base: 'ㅛ' },
  KeyU: { base: 'ㅕ' },
  KeyI: { base: 'ㅑ' },
  KeyO: { base: 'ㅐ', shift: 'ㅒ' },
  KeyP: { base: 'ㅔ', shift: 'ㅖ' },
  KeyH: { base: 'ㅗ' },
  KeyJ: { base: 'ㅓ' },
  KeyK: { base: 'ㅏ' },
  KeyL: { base: 'ㅣ' },
  KeyB: { base: 'ㅠ' },
  KeyN: { base: 'ㅜ' },
  KeyM: { base: 'ㅡ' },
  // Punctuation / space (no jamo role)
  Comma: { base: ',' },
  Period: { base: '.' },
  Space: { base: ' ' },
}

export const JAMO_TO_KEY: Record<string, { code: string; shift: boolean }> = Object.entries(
  KEY_TO_JAMO,
).reduce<Record<string, { code: string; shift: boolean }>>((acc, [code, { base, shift }]) => {
  acc[base] = { code, shift: false }
  if (shift) acc[shift] = { code, shift: true }
  return acc
}, {})
