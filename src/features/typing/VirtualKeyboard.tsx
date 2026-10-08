import { useState } from 'react'
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

interface VirtualKeyboardProps {
  nextKey?: { code: string; shift: boolean }
  feedback?: KeyboardFeedback
  previousFeedback?: KeyboardFeedback
  isPreviousFading?: boolean
  isFeedbackFading?: boolean
  showEnglishKeys: boolean
  opacity: number
  onKeyPress?: (code: string, shiftKey: boolean) => void
}

export default function VirtualKeyboard({
  nextKey,
  feedback,
  previousFeedback,
  isPreviousFading = false,
  isFeedbackFading = false,
  showEnglishKeys,
  opacity,
  onKeyPress,
}: VirtualKeyboardProps) {
  const [virtualShiftActive, setVirtualShiftActive] = useState(false)

  return (
    <div
      className="mt-6 rounded-2xl bg-[#fffaf3] p-4 shadow-[0_0_24px_-16px_rgba(87,65,45,0.35)] select-none sm:p-5"
      aria-label="Virtual Korean keyboard"
      style={{ opacity }}
    >
      <div className="mx-auto max-w-4xl space-y-1.5">
        {[ROW_1, ROW_2, ROW_3].map((keys) => (
          <KeyboardRow
            key={keys[0].code}
            keys={keys}
            nextKey={nextKey}
            feedback={feedback}
            previousFeedback={previousFeedback}
            isPreviousFading={isPreviousFading}
            isFeedbackFading={isFeedbackFading}
            showEnglishKeys={showEnglishKeys}
            virtualShiftActive={virtualShiftActive}
            onKeyPress={onKeyPress}
            onVirtualShiftChange={setVirtualShiftActive}
          />
        ))}
      </div>
    </div>
  )
}
