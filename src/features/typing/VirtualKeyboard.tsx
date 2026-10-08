import { useMemo, useState } from 'react'
import type { KeyboardFeedback } from './keyboard-feedback'
import KeyboardRow from './KeyboardRow'
import type { KeyboardKey, KeyFocusLevel } from './VirtualKey'

const ROW_1: KeyboardKey[] = [
  { code: 'Tab', label: 'Tab', wide: 'tab' },
  ...[
    'KeyQ',
    'KeyW',
    'KeyE',
    'KeyR',
    'KeyT',
    'KeyY',
    'KeyU',
    'KeyI',
    'KeyO',
    'KeyP',
  ].map((code) => ({ code })),
  { code: 'BracketLeft', label: '[' },
  { code: 'BracketRight', label: ']' },
  { code: 'Backslash', label: '\\' },
]

const ROW_2: KeyboardKey[] = [
  { code: 'CapsLock', label: 'Caps Lock', wide: 'caps' },
  ...[
    'KeyA',
    'KeyS',
    'KeyD',
    'KeyF',
    'KeyG',
    'KeyH',
    'KeyJ',
    'KeyK',
    'KeyL',
  ].map((code) => ({ code })),
  { code: 'Semicolon', label: ';' },
  { code: 'Quote', label: "'" },
  { code: 'Enter', label: 'Enter ↵', wide: 'enter' },
]

const ROW_3: KeyboardKey[] = [
  { code: 'ShiftLeft', label: 'Shift ⇧', wide: 'shift' },
  ...[
    'KeyZ',
    'KeyX',
    'KeyC',
    'KeyV',
    'KeyB',
    'KeyN',
    'KeyM',
    'Comma',
    'Period',
    'Slash',
  ].map((code) => ({ code })),
  { code: 'ShiftRight', label: 'Shift ⇧', wide: 'shift' },
]

const VIRTUAL_KEY_CODES = new Set(
  [...ROW_1, ...ROW_2, ...ROW_3].map(({ code }) => code),
)

const KEYBOARD_ROWS = [ROW_1, ROW_2, ROW_3]

function closestCodeInRow(
  index: number,
  sourceLength: number,
  row: KeyboardKey[],
): string | undefined {
  const position = index / Math.max(sourceLength - 1, 1)
  let closestCode: string | undefined
  let closestDistance = Infinity
  row.forEach(({ code }, candidateIndex) => {
    const candidatePosition = candidateIndex / Math.max(row.length - 1, 1)
    const distance = Math.abs(position - candidatePosition)
    if (distance < closestDistance) {
      closestCode = code
      closestDistance = distance
    }
  })
  return closestCode
}

function nearbyCodes(code: string): Set<string> {
  const rowIndex = KEYBOARD_ROWS.findIndex((row) =>
    row.some((key) => key.code === code),
  )

  if (rowIndex === -1) return new Set()

  const row = KEYBOARD_ROWS[rowIndex]
  const index = row.findIndex((key) => key.code === code)
  const nearby = new Set<string>()

  const spread = 2

  // ซ้าย / ขวา {{spread}} ปุ่ม
  for (let offset = 1; offset <= spread; offset++) {
    if (row[index - offset]) nearby.add(row[index - offset].code)
    if (row[index + offset]) nearby.add(row[index + offset].code)
  }

  // if (row[index - 1]) nearby.add(row[index - 1].code)
  // if (row[index + 1]) nearby.add(row[index + 1].code)

  // แถวบน / ล่าง
  // const above = KEYBOARD_ROWS[rowIndex - 1]
  // const below = KEYBOARD_ROWS[rowIndex + 1]

  // const aboveCode = above && closestCodeInRow(index, row.length, above)
  // const belowCode = below && closestCodeInRow(index, row.length, below)

  // if (aboveCode) nearby.add(aboveCode)
  // if (belowCode) nearby.add(belowCode)

  // แถวบน / ล่าง + แนวทะแยง
  for (const otherRow of [
    KEYBOARD_ROWS[rowIndex - 1],
    KEYBOARD_ROWS[rowIndex + 1],
  ]) {
    if (!otherRow) continue

    const centerCode = closestCodeInRow(index, row.length, otherRow)
    const centerIndex = otherRow.findIndex((key) => key.code === centerCode)

    for (let offset = -spread; offset <= spread; offset++) {
      const key = otherRow[centerIndex + offset]
      if (key) nearby.add(key.code)
    }
  }

  return nearby
}

function focusLevelsFor(
  nextKey: VirtualKeyboardProps['nextKey'],
): ReadonlyMap<string, KeyFocusLevel> {
  const levels = new Map<string, KeyFocusLevel>()
  if (!nextKey) {
    for (const code of VIRTUAL_KEY_CODES) levels.set(code, 'nearby')
    return levels
  }
  for (const code of VIRTUAL_KEY_CODES) levels.set(code, 'other')
  levels.set(nextKey.code, 'target')
  if (nextKey.shift) {
    levels.set('ShiftLeft', 'target')
    levels.set('ShiftRight', 'target')
  }
  for (const code of nearbyCodes(nextKey.code)) {
    if (levels.get(code) !== 'target') levels.set(code, 'nearby')
  }
  return levels
}

interface VirtualKeyboardProps {
  nextKey?: { code: string; shift: boolean }
  feedback?: KeyboardFeedback
  previousFeedback?: KeyboardFeedback
  showEnglishKeys: boolean
  opacity: number
  onKeyPress?: (code: string, shiftKey: boolean) => void
  pressedCodes?: ReadonlySet<string>
}

export default function VirtualKeyboard({
  nextKey,
  feedback,
  previousFeedback,
  showEnglishKeys,
  opacity,
  onKeyPress,
  pressedCodes = new Set(),
}: VirtualKeyboardProps) {
  const [virtualShiftActive, setVirtualShiftActive] = useState(false)
  const focusLevels = useMemo(() => focusLevelsFor(nextKey), [nextKey])

  return (
    <div
      className="mt-6 rounded-2xl bg-[#FFF8EF] p-4 shadow-[0_0_24px_-16px_rgba(87,65,45,0.35)] select-none sm:p-5"
      aria-label="Virtual Korean keyboard"
      style={{ opacity }}
    >
      <div className="mx-auto max-w-5xl space-y-2 sm:space-y-3">
        {[ROW_1, ROW_2, ROW_3].map((keys) => (
          <KeyboardRow
            key={keys[0].code}
            keys={keys}
            nextKey={nextKey}
            feedback={feedback}
            previousFeedback={previousFeedback}
            showEnglishKeys={showEnglishKeys}
            virtualShiftActive={virtualShiftActive}
            pressedCodes={pressedCodes}
            focusLevels={focusLevels}
            onKeyPress={onKeyPress}
            onVirtualShiftChange={setVirtualShiftActive}
          />
        ))}
      </div>
    </div>
  )
}
