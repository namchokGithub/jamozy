import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
} from 'motion/react'
import { useEffect } from 'react'
import { isKoreanJamoKey, KEY_TO_JAMO } from '../../domain/korean/keymap'
import type { KeyboardFeedback } from './keyboard-feedback'

export type KeyVisualState =
  'idle' | 'target' | 'active' | 'previous' | 'wrong' | 'dimmed'

export type KeyFocusLevel = 'target' | 'nearby' | 'other'

type FocusStyle = {
  backgroundColor: string
  borderColor: string
  color: string
  opacity?: number
}

const focusStyles: Record<KeyFocusLevel, FocusStyle> = {
  target: {
    backgroundColor: '#ddf5e9',
    borderColor: '#78bca6',
    color: '#194d41',
  },
  nearby: {
    backgroundColor: '#fffdf9',
    borderColor: '#d8e8e3',
    color: '#39465b',
  },
  other: {
    backgroundColor: '#F7F4EC',
    borderColor: '#CBDCD7',
    color: '#39465b',
    opacity: 0.9,
  },
}

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
  isPressed: boolean
  focusLevel: KeyFocusLevel
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

function WrongKeyFeedback() {
  return (
    <motion.span
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 0.42, 0],
        backgroundColor: ['#fde5e1', '#f8cec7', '#fde5e1'],
      }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="pointer-events-none absolute inset-0 rounded-lg"
    />
  )
}

export default function VirtualKey({
  keyboardKey,
  nextKey,
  feedback,
  previousFeedback,
  showEnglishKeys,
  virtualShiftActive,
  isPressed,
  focusLevel,
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
  const wrongAnimation = useAnimationControls()
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
  const isVirtualShiftSelected = isShiftKey && virtualShiftActive
  const shouldPulseShift = isShiftKey && nextKey?.shift === true
  const shouldPulseTarget = visualState === 'target' && !isShiftKey
  const keyVisualClass = isActiveShift
    ? 'border-[#e3ad73] bg-[#fff0d8] text-[#8b6035]'
    : visualStateClass(visualState)
  const correctFeedbackId =
    feedback?.outcome === 'correct' && feedback.code === code
      ? feedback.id
      : undefined
  const wrongFeedbackId =
    feedback?.outcome === 'wrong' && feedback.code === code
      ? feedback.id
      : undefined
  const hasSemanticStyle =
    isActiveShift ||
    visualState === 'active' ||
    visualState === 'wrong' ||
    visualState === 'previous'
  const isUtilityKey = [
    'Tab',
    'CapsLock',
    'ShiftLeft',
    'ShiftRight',
    'Enter',
    'Backspace',
    'Space',
  ].includes(code)

  const focusStyle =
    hasSemanticStyle || isUtilityKey ? undefined : focusStyles[focusLevel]

  useEffect(() => {
    if (wrongFeedbackId === undefined || shouldReduceMotion) return
    void wrongAnimation.start({
      x: [0, -3, 3, -2, 0],
      transition: { duration: 0.22, ease: 'easeOut' },
    })
  }, [shouldReduceMotion, wrongAnimation, wrongFeedbackId])

  const handleClick = () => {
    if (!canInteract) return
    if (isShiftKey) {
      onShiftToggle()
      return
    }
    if (isJamoKey) onPress(code, virtualShiftActive)
  }

  return (
    <motion.div
      animate={
        shouldPulseShift && !shouldReduceMotion && !isPressed
          ? {
              scale: [1, 1.04, 1],
              boxShadow: [
                '0 0 0px rgba(227, 173, 115, 0)',
                '0 0 12px rgba(227, 173, 115, 0.45)',
                '0 0 0px rgba(227, 173, 115, 0)',
              ],
            }
          : shouldPulseTarget && !shouldReduceMotion && !isPressed
            ? {
                scale: [1, 1.04, 1],
                boxShadow: [
                  '0 3px 10px -5px rgba(35, 109, 86, 0.45)',
                  '0 0 14px rgba(159, 216, 189, 0.55)',
                  '0 3px 10px -5px rgba(35, 109, 86, 0.45)',
                ],
              }
            : { scale: 1, boxShadow: 'none' }
      }
      transition={
        shouldPulseShift && !shouldReduceMotion && !isPressed
          ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          : shouldPulseTarget && !shouldReduceMotion && !isPressed
            ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
            : { duration: 0.1 }
      }
      className={`relative ${keyWidth(wide)}`}
    >
      <motion.div animate={wrongAnimation} className="h-full w-full">
        <motion.button
          type="button"
          data-state={visualState}
          animate={
            isPressed && !shouldReduceMotion
              ? { scale: 0.96, y: 2 }
              : { scale: 1, y: 0 }
          }
          whileTap={
            canPress && !shouldReduceMotion ? { scale: 0.96, y: 2 } : undefined
          }
          transition={{
            scale: { type: 'spring', stiffness: 600, damping: 30 },
            y: { type: 'spring', stiffness: 600, damping: 30 },
          }}
          style={focusStyle}
          className={`relative flex h-12 w-full flex-col items-center justify-center rounded-lg border px-1 text-sm transition-[background-color,border-color,color,box-shadow] duration-200 sm:h-13 ${keyVisualClass} ${isVirtualShiftSelected ? 'ring-2 ring-inset ring-[#c98950] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)]' : ''} ${canPress ? 'cursor-pointer touch-manipulation' : 'cursor-default'}`}
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
            {wrongFeedbackId !== undefined && !shouldReduceMotion && (
              <WrongKeyFeedback key={wrongFeedbackId} />
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
