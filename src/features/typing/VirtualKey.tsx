import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
} from 'motion/react'
import { useEffect } from 'react'
import {
  isKoreanJamoKey,
  isTypingInputKey,
  KEY_TO_JAMO,
} from '../../domain/korean/keymap'
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
    backgroundColor: 'var(--color-mint-100)',
    borderColor: 'var(--color-mint-400)',
    color: 'var(--color-mint-900)',
  },
  nearby: {
    backgroundColor: 'var(--color-card)',
    borderColor: 'var(--color-mint-150)',
    color: 'var(--color-ink-soft)',
  },
  other: {
    backgroundColor: 'var(--color-sand)',
    borderColor: 'var(--color-mint-150)',
    color: 'var(--color-ink-soft)',
    opacity: 0.9,
  },
}

export type KeyboardKey = {
  code: string
  label?: string
  wide?: 'tab' | 'caps' | 'shift' | 'enter' | 'space'
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
  onUtilityPress?: (code: string) => void
  onShiftToggle: () => void
  // Below `sm`, draws the key like a phone keyboard; `sm` and up is unchanged.
  mobileStyle?: boolean
}

function englishLabel(code: string): string {
  if (code === 'Comma') return ','
  if (code === 'Period') return '.'
  if (code === 'Slash') return '/'
  return code.replace('Key', '').toLowerCase()
}

const MOBILE_UTILITY_LABELS: Record<string, string> = {
  Tab: '⇥',
  CapsLock: '⇪',
  Enter: '↵',
  ShiftLeft: '⇧',
  ShiftRight: '⇧',
}

function keyWidth(wide: KeyboardKey['wide']): string {
  if (wide === 'tab') return 'basis-[9%]'
  if (wide === 'caps') return 'basis-[12%]'
  if (wide === 'shift') return 'basis-[15%]'
  if (wide === 'enter') return 'basis-[12%]'
  if (wide === 'space') return 'basis-[45%]'
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
      return 'border-mint-400 bg-mint-100 text-mint-900 shadow-[0_3px_10px_-5px_rgba(35,109,86,0.45)]'
    case 'active':
      return 'border-sky-300 bg-sky-100 text-sky-700 shadow-[0_3px_10px_-5px_rgba(63,111,174,0.35)]'
    case 'previous':
      return 'border-lavender-300 bg-lavender-50 text-lavender-600'
    case 'wrong':
      return 'border-coral-300 bg-coral-100 text-coral-700 shadow-[0_3px_10px_-5px_rgba(169,74,61,0.35)]'
    case 'dimmed':
      return 'border-sand bg-sand text-muted'
    case 'idle':
      return 'border-mint-150 bg-sand text-ink-soft'
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
      className="absolute right-0 top-0 text-xs text-peach-300"
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
        backgroundColor: [
          'var(--color-coral-100)',
          'var(--color-coral-200)',
          'var(--color-coral-100)',
        ],
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
  onUtilityPress,
  onShiftToggle,
  mobileStyle = false,
}: VirtualKeyProps) {
  const { code, label, wide } = keyboardKey
  const jamo = KEY_TO_JAMO[code]
  const isShiftKey = code === 'ShiftLeft' || code === 'ShiftRight'
  const isJamoKey = isKoreanJamoKey(code)
  const isTypingKey = isTypingInputKey(code)
  const isSoundUtilityKey = ['Tab', 'CapsLock', 'Enter'].includes(code)
  const displayLabel = label ?? englishLabel(code)
  const hasHomeRowMarker = code === 'KeyF' || code === 'KeyJ'
  const wrongAnimation = useAnimationControls()
  const shouldReduceMotion = useReducedMotion()
  const canPress =
    canInteract && (isTypingKey || isShiftKey || isSoundUtilityKey)
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
    ? 'border-peach-300 bg-peach-100 text-peach-700'
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

  // Like a phone keyboard, a held Shift shows each key's shifted jamo.
  const mobileJamo =
    jamo && (virtualShiftActive || nextKey?.shift)
      ? (jamo.shift ?? jamo.base)
      : jamo?.base
  const desktopOnly = mobileStyle ? 'hidden sm:inline' : ''
  const keyShapeClass = mobileStyle
    ? 'h-11 rounded-md px-0 sm:h-13 sm:rounded-lg sm:px-1'
    : 'h-12 rounded-lg px-1 sm:h-13'

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
      onUtilityPress?.(code)
      onShiftToggle()
      return
    }
    if (isTypingKey) onPress(code, virtualShiftActive)
    if (isSoundUtilityKey) onUtilityPress?.(code)
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
          className={`relative flex w-full flex-col items-center justify-center border text-sm transition-[background-color,border-color,color,box-shadow] duration-200 ${keyShapeClass} ${keyVisualClass} ${isVirtualShiftSelected ? 'ring-2 ring-inset ring-peach-300 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.65)]' : ''} ${canPress ? 'cursor-pointer touch-manipulation' : 'cursor-default'}`}
          aria-label={displayLabel}
          aria-pressed={isShiftKey ? virtualShiftActive : undefined}
          disabled={!canPress}
          onClick={handleClick}
        >
          {jamo ? (
            <>
              {jamo.shift && (
                <span
                  className={`absolute top-1 right-1 text-[12px] leading-none text-coral-600 ${desktopOnly}`}
                >
                  {jamo.shift}
                </span>
              )}
              {mobileStyle && (
                <span className="text-[25px] leading-5 sm:hidden">
                  {mobileJamo}
                </span>
              )}
              <span className={`text-base leading-4 ${desktopOnly}`}>
                {jamo.base}
              </span>
              {showEnglishKeys && (
                <span
                  className={`mt-0.5 text-[10px] leading-3 text-line-strong ${hasHomeRowMarker ? 'mb-1.5' : ''} ${desktopOnly}`}
                >
                  {englishLabel(code)}
                </span>
              )}
              {hasHomeRowMarker && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1 h-0.5 w-5 rounded-full bg-line-strong/50 sm:bottom-1.5 sm:h-px sm:w-4"
                />
              )}
            </>
          ) : (
            <>
              {mobileStyle && (
                <span className="text-xs font-semibold text-muted sm:hidden">
                  {MOBILE_UTILITY_LABELS[code] ?? displayLabel}
                </span>
              )}
              <span
                className={`text-[11px] font-semibold text-muted ${desktopOnly}`}
              >
                {displayLabel}
              </span>
            </>
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
