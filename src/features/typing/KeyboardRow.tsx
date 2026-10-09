import type { Dispatch, SetStateAction } from 'react'
import type { KeyboardFeedback } from './keyboard-feedback'
import VirtualKey, { type KeyboardKey, type KeyFocusLevel } from './VirtualKey'

interface KeyboardRowProps {
  keys: KeyboardKey[]
  nextKey?: { code: string; shift: boolean }
  feedback?: KeyboardFeedback
  previousFeedback?: KeyboardFeedback
  showEnglishKeys: boolean
  virtualShiftActive: boolean
  pressedCodes: ReadonlySet<string>
  focusLevels: ReadonlyMap<string, KeyFocusLevel>
  onKeyPress?: (code: string, shiftKey: boolean) => void
  onVirtualShiftChange: Dispatch<SetStateAction<boolean>>
  mobileStyle?: boolean
}

export default function KeyboardRow({
  keys,
  nextKey,
  feedback,
  previousFeedback,
  showEnglishKeys,
  virtualShiftActive,
  pressedCodes,
  focusLevels,
  onKeyPress,
  onVirtualShiftChange,
  mobileStyle = false,
}: KeyboardRowProps) {
  return (
    <div className={`flex ${mobileStyle ? 'gap-[3px] sm:gap-1.5' : 'gap-1.5'}`}>
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
          focusLevel={focusLevels.get(keyboardKey.code) ?? 'target'}
          canInteract={Boolean(onKeyPress)}
          onPress={(code, shiftKey) => {
            onKeyPress?.(code, shiftKey)
            onVirtualShiftChange(() => false)
          }}
          onShiftToggle={() => onVirtualShiftChange((current) => !current)}
          mobileStyle={mobileStyle}
        />
      ))}
    </div>
  )
}
