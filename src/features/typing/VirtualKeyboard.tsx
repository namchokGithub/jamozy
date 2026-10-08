import { useState } from 'react'
import { isKoreanJamoKey, KEY_TO_JAMO } from '../../domain/korean/keymap'
import type { KeyboardFeedback } from './keyboard-feedback'

type KeyboardKey = {
  code: string
  label?: string
  wide?: 'tab' | 'caps' | 'shift' | 'enter'
}

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

interface VirtualKeyboardProps {
  nextKey?: { code: string; shift: boolean }
  feedback?: KeyboardFeedback
  showEnglishKeys: boolean
  opacity: number
  onKeyPress?: (code: string, shiftKey: boolean) => void
}

export default function VirtualKeyboard({
  nextKey,
  showEnglishKeys,
  opacity,
  onKeyPress,
}: VirtualKeyboardProps) {
  const [virtualShiftActive, setVirtualShiftActive] = useState(false)

  const renderKey = ({ code, label, wide }: KeyboardKey) => {
    const jamo = KEY_TO_JAMO[code]
    const isNext = nextKey?.code === code
    const isShiftKey = code === 'ShiftLeft' || code === 'ShiftRight'
    const isActiveShift = isShiftKey && (nextKey?.shift || virtualShiftActive)
    const displayLabel = label ?? englishLabel(code)
    const isJamoKey = isKoreanJamoKey(code)
    const hasHomeRowMarker = code === 'KeyF' || code === 'KeyJ'
    const canPress = Boolean(onKeyPress && (isJamoKey || isShiftKey))
    const keyVisualClass = isNext
      ? 'border-[#78bca6] bg-[#ddf5e9] text-[#194d41] shadow-[0_3px_10px_-5px_rgba(35,109,86,0.45)]'
      : isActiveShift
        ? 'border-[#e3ad73] bg-[#fff0d8] text-[#8b6035]'
        : isJamoKey && nextKey
          ? 'border-[#ebe7df] bg-[#fbf9f4] text-[#66736c]'
          : 'border-[#d8e8e3] bg-[#f7f4ec] text-[#39465b]'

    const handleClick = () => {
      if (!onKeyPress) return
      if (isShiftKey) {
        setVirtualShiftActive((active) => !active)
        return
      }
      if (!isJamoKey) return
      onKeyPress(code, virtualShiftActive)
      setVirtualShiftActive(false)
    }

    return (
      <button
        type="button"
        key={code}
        className={`relative flex h-12 ${keyWidth(wide)} flex-col items-center justify-center rounded-lg border px-1 text-sm sm:h-13 ${keyVisualClass} ${canPress ? 'cursor-pointer touch-manipulation' : 'cursor-default'}`}
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

  return (
    <div
      className="mt-6 rounded-2xl bg-[#fffaf3] p-4 shadow-[0_0_24px_-16px_rgba(87,65,45,0.35)] select-none sm:p-5"
      aria-label="Virtual Korean keyboard"
      style={{ opacity }}
    >
      <div className="mx-auto max-w-4xl space-y-1.5">
        <div className="flex gap-1.5">{ROW_1.map(renderKey)}</div>
        <div className="flex gap-1.5">{ROW_2.map(renderKey)}</div>
        <div className="flex gap-1.5">{ROW_3.map(renderKey)}</div>
      </div>
    </div>
  )
}
