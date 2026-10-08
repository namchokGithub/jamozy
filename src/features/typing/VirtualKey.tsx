import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
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

function CorrectKeyFeedback() {
  return (
    <motion.span
      aria-hidden="true"
      initial={{ boxShadow: '0 0 0px rgba(32, 185, 129, 0)' }}
      animate={{
        boxShadow: [
          '0 0 0px rgba(32, 185, 129, 0)',
          '0 0 16px rgba(32, 185, 129, 0.58)',
          '0 0 6px rgba(32, 185, 129, 0)',
        ],
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.21, ease: 'easeOut', times: [0, 0.38, 1] }}
      className="pointer-events-none absolute -inset-1 rounded-xl"
    >
      <CorrectSparkle x={-8} y={-10} delay={0} />
      <CorrectSparkle x={12} y={-4} delay={0.025} />
      <CorrectSparkle x={8} y={12} delay={0.05} />
    </motion.span>
  )
}

function CorrectSparkle({
  x,
  y,
  delay,
}: {
  x: number
  y: number
  delay: number
}) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
      animate={{ opacity: [0, 1, 0], scale: [0, 1, 0.5], x, y }}
      transition={{ duration: 0.16, delay, ease: 'easeOut' }}
      className="absolute right-0 top-0 text-xs text-[#e8b85c]"
    >
      ✦
    </motion.span>
  )
}

export default function VirtualKey({
  keyboardKey,
  nextKey,
  feedback,
  previousFeedback,
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
  const keyAnimation = useAnimationControls()
  const shouldReduceMotion = useReducedMotion()
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
  const correctFeedbackId =
    feedback?.outcome === 'correct' && feedback.code === code
      ? feedback.id
      : undefined

  useEffect(() => {
    if (correctFeedbackId === undefined || shouldReduceMotion) return
    void keyAnimation.start({
      scale: [1, 1.08, 0.98, 1],
      transition: { duration: 0.21, ease: 'easeOut', times: [0, 0.35, 0.7, 1] },
    })
  }, [correctFeedbackId, keyAnimation, shouldReduceMotion])

  const handleClick = () => {
    if (!canInteract) return
    if (isShiftKey) {
      onShiftToggle()
      return
    }
    if (isJamoKey) onPress(code, virtualShiftActive)
  }

  return (
    <motion.button
      type="button"
      data-state={visualState}
      animate={keyAnimation}
      className={`relative flex h-12 ${keyWidth(wide)} flex-col items-center justify-center rounded-lg border px-1 text-sm transition-[background-color,border-color,color,box-shadow] duration-200 sm:h-13 ${keyVisualClass} ${canPress ? 'cursor-pointer touch-manipulation' : 'cursor-default'}`}
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
      <AnimatePresence initial={false}>
        {correctFeedbackId !== undefined && !shouldReduceMotion && (
          <CorrectKeyFeedback key={correctFeedbackId} />
        )}
      </AnimatePresence>
    </motion.button>
  )
}
