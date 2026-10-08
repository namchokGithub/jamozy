import { useEffect, useState } from 'react'
import type { KeyboardFeedback } from './keyboard-feedback'
import KeyboardRow from './KeyboardRow'
import type { KeyboardKey } from './VirtualKey'

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

interface VirtualKeyboardProps {
  nextKey?: { code: string; shift: boolean }
  feedback?: KeyboardFeedback
  previousFeedback?: KeyboardFeedback
  showEnglishKeys: boolean
  opacity: number
  onKeyPress?: (code: string, shiftKey: boolean) => void
}

export default function VirtualKeyboard({
  nextKey,
  feedback,
  previousFeedback,
  showEnglishKeys,
  opacity,
  onKeyPress,
}: VirtualKeyboardProps) {
  const [virtualShiftActive, setVirtualShiftActive] = useState(false)
  const [pressedCodes, setPressedCodes] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  useEffect(() => {
    const setPressed = (code: string, pressed: boolean) => {
      if (!VIRTUAL_KEY_CODES.has(code)) return
      setPressedCodes((current) => {
        if (current.has(code) === pressed) return current
        const next = new Set(current)
        if (pressed) next.add(code)
        else next.delete(code)
        return next
      })
    }
    const clearPressed = () => setPressedCodes(new Set())
    const handleKeyDown = (event: KeyboardEvent) => setPressed(event.code, true)
    const handleKeyUp = (event: KeyboardEvent) => setPressed(event.code, false)
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') clearPressed()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', clearPressed)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', clearPressed)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

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
            onKeyPress={onKeyPress}
            onVirtualShiftChange={setVirtualShiftActive}
          />
        ))}
      </div>
    </div>
  )
}
