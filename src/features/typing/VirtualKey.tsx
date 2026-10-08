import { isKoreanJamoKey, KEY_TO_JAMO } from '../../domain/korean/keymap'
import type { KeyboardFeedback } from './keyboard-feedback'

export type KeyVisualState =
  'idle' | 'target' | 'active' | 'previous' | 'wrong' | 'dimmed'

export type KeyboardKey = {
  code: string
  label?: string
  wide?: 'tab' | 'caps' | 'shift' | 'enter'
}

interface VirtualKeyProps {
  keyboardKey: KeyboardKey
  nextKey?: { code: string; shift: boolean }
  feedback?: KeyboardFeedback
  previousFeedback?: KeyboardFeedback
  isPreviousFading: boolean
  isFeedbackFading: boolean
  showEnglishKeys: boolean
  virtualShiftActive: boolean
  canInteract: boolean
  onPress: (code: string, shiftKey: boolean) => void
  onShiftToggle: () => void
}

function englishLabel(code: string): string {
  if (code === 'Comma') return ','
  if (code === 'Period') return '.'
  if (code === 'Slash') return '/'
  return code.replace('Key', '').toLowerCase()
}

function keyWidth(wide: KeyboardKey['wide']): string {
  if (wide === 'tab') return 'basis-[9%]'
  if (wide === 'caps') return 'basis-[12%]'
  if (wide === 'shift') return 'basis-[15%]'
  if (wide === 'enter') return 'basis-[12%]'
  return 'min-w-0 flex-1'
}

function getVisualState(
  code: string,
  isJamoKey: boolean,
  nextKey: VirtualKeyProps['nextKey'],
  feedback: KeyboardFeedback | undefined,
  previousFeedback: KeyboardFeedback | undefined,
): KeyVisualState {
  if (feedback?.code === code)
    return feedback.outcome === 'correct' ? 'active' : 'wrong'
  if (nextKey?.code === code) return 'target'
  if (previousFeedback?.code === code) return 'previous'
  if (isJamoKey && nextKey) return 'dimmed'
  return 'idle'
}

function visualStateClass(state: KeyVisualState): string {
  switch (state) {
    case 'target':
      return 'border-[#78bca6] bg-[#ddf5e9] text-[#194d41] shadow-[0_3px_10px_-5px_rgba(35,109,86,0.45)]'
    case 'active':
      return 'border-[#8db7f4] bg-[#e8f1ff] text-[#3f6fae] shadow-[0_3px_10px_-5px_rgba(63,111,174,0.35)]'
    case 'previous':
      return 'border-[#d8d0ec] bg-[#f3f0fa] text-[#746b8f]'
    case 'wrong':
      return 'border-[#e5a196] bg-[#fde5e1] text-[#8d4c43] shadow-[0_3px_10px_-5px_rgba(169,74,61,0.35)]'
    case 'dimmed':
      return 'border-[#ebe7df] bg-[#fbf9f4] text-[#66736c]'
    case 'idle':
      return 'border-[#d8e8e3] bg-[#f7f4ec] text-[#39465b]'
  }
}

export default function VirtualKey({
  keyboardKey,
  nextKey,
  feedback,
  previousFeedback,
  isPreviousFading,
  isFeedbackFading,
  showEnglishKeys,
  virtualShiftActive,
  canInteract,
  onPress,
  onShiftToggle,
}: VirtualKeyProps) {
  const { code, label, wide } = keyboardKey
  const jamo = KEY_TO_JAMO[code]
  const isShiftKey = code === 'ShiftLeft' || code === 'ShiftRight'
  const isJamoKey = isKoreanJamoKey(code)
  const displayLabel = label ?? englishLabel(code)
  const hasHomeRowMarker = code === 'KeyF' || code === 'KeyJ'
  const canPress = canInteract && (isJamoKey || isShiftKey)
  const visualState = getVisualState(
    code,
    isJamoKey,
    nextKey,
    feedback,
    previousFeedback,
  )
  const isActiveShift = isShiftKey && (nextKey?.shift || virtualShiftActive)
  const keyVisualClass = isActiveShift
    ? 'border-[#e3ad73] bg-[#fff0d8] text-[#8b6035]'
    : visualStateClass(visualState)

  const handleClick = () => {
    if (!canInteract) return
    if (isShiftKey) {
      onShiftToggle()
      return
    }
    if (isJamoKey) onPress(code, virtualShiftActive)
  }

  return (
    <button
      type="button"
      data-state={visualState}
      className={`relative flex h-12 ${keyWidth(wide)} flex-col items-center justify-center rounded-lg border px-1 text-sm transition-[background-color,border-color,color,box-shadow,opacity] duration-200 sm:h-13 ${keyVisualClass} ${(visualState === 'previous' && isPreviousFading) || (visualState === 'wrong' && isFeedbackFading) ? 'opacity-0' : 'opacity-100'} ${canPress ? 'cursor-pointer touch-manipulation' : 'cursor-default'}`}
      aria-label={displayLabel}
      aria-pressed={isShiftKey ? virtualShiftActive : undefined}
      disabled={!canPress}
      onClick={handleClick}
    >
      {jamo ? (
        <>
          {jamo.shift && (
            <span className="absolute top-1 right-1 text-[10px] leading-none text-[#a85d4e]">
              {jamo.shift}
            </span>
          )}
          <span className="text-base leading-4">{jamo.base}</span>
          {showEnglishKeys && (
            <span
              className={`mt-0.5 text-[10px] leading-3 text-slate-400 ${hasHomeRowMarker ? 'mb-1.5' : ''}`}
            >
              {englishLabel(code)}
            </span>
          )}
          {hasHomeRowMarker && (
            <span
              aria-hidden="true"
              className="absolute bottom-1 h-0.5 w-5 rounded-full bg-gray-300/50 sm:bottom-1.5 sm:h-px sm:w-4"
            />
          )}
        </>
      ) : (
        <span className="text-[11px] font-semibold text-[#667085]">
          {displayLabel}
        </span>
      )}
    </button>
  )
}
