import type { Dispatch, SetStateAction } from 'react'
import type { KeyboardFeedback } from './keyboard-feedback'
import VirtualKey, { type KeyboardKey } from './VirtualKey'

interface KeyboardRowProps {
  keys: KeyboardKey[]
  nextKey?: { code: string; shift: boolean }
  feedback?: KeyboardFeedback
  previousFeedback?: KeyboardFeedback
  showEnglishKeys: boolean
  virtualShiftActive: boolean
  pressedCodes: ReadonlySet<string>
  onKeyPress?: (code: string, shiftKey: boolean) => void
  onVirtualShiftChange: Dispatch<SetStateAction<boolean>>
}

export default function KeyboardRow({
  keys,
  nextKey,
  feedback,
  previousFeedback,
  showEnglishKeys,
  virtualShiftActive,
  pressedCodes,
  onKeyPress,
  onVirtualShiftChange,
}: KeyboardRowProps) {
  return (
    <div className="flex gap-1.5">
      {keys.map((keyboardKey) => (
        <VirtualKey
          key={keyboardKey.code}
          keyboardKey={keyboardKey}
          nextKey={nextKey}
          feedback={feedback}
          previousFeedback={previousFeedback}
          showEnglishKeys={showEnglishKeys}
          virtualShiftActive={virtualShiftActive}
          isPressed={pressedCodes.has(keyboardKey.code)}
          canInteract={Boolean(onKeyPress)}
          onPress={(code, shiftKey) => {
            onKeyPress?.(code, shiftKey)
            onVirtualShiftChange(() => false)
          }}
          onShiftToggle={() => onVirtualShiftChange((current) => !current)}
        />
      ))}
    </div>
  )
}
