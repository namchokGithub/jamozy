import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExpectedKey } from '../../domain/korean/target-sequence'

export interface KeyboardFeedback {
  id: number
  code: string
  shift: boolean
  outcome: 'correct' | 'wrong'
}

const ACTIVE_CORRECT_MS = 210
const PREVIOUS_VISIBLE_MS = 210
const WRONG_VISIBLE_MS = 420

export function createKeyboardFeedback(
  expectedKey: ExpectedKey | undefined,
  code: string,
  shift: boolean,
  id: number,
): KeyboardFeedback | null {
  if (!expectedKey) return null

  const shiftMatches = expectedKey.strictShift
    ? expectedKey.shift === shift
    : true

  return {
    id,
    code,
    shift,
    outcome: expectedKey.code === code && shiftMatches ? 'correct' : 'wrong',
  }
}

export function useKeyboardFeedback() {
  const [feedback, setFeedback] = useState<KeyboardFeedback | undefined>()
  const [previousFeedback, setPreviousFeedback] = useState<
    KeyboardFeedback | undefined
  >()
  const nextFeedbackId = useRef(0)
  const activeTimer = useRef<number | undefined>(undefined)
  const previousClearTimer = useRef<number | undefined>(undefined)
  const wrongClearTimer = useRef<number | undefined>(undefined)

  const clearFeedbackTimers = useCallback(() => {
    if (activeTimer.current !== undefined)
      window.clearTimeout(activeTimer.current)
    if (previousClearTimer.current !== undefined)
      window.clearTimeout(previousClearTimer.current)
    if (wrongClearTimer.current !== undefined)
      window.clearTimeout(wrongClearTimer.current)
  }, [])

  useEffect(() => clearFeedbackTimers, [clearFeedbackTimers])

  const recordAttempt = useCallback(
    (expectedKey: ExpectedKey | undefined, code: string, shift: boolean) => {
      const next = createKeyboardFeedback(
        expectedKey,
        code,
        shift,
        nextFeedbackId.current + 1,
      )
      if (!next) return
      clearFeedbackTimers()
      nextFeedbackId.current = next.id
      setPreviousFeedback(undefined)
      setFeedback(next)

      if (next.outcome === 'wrong') {
        wrongClearTimer.current = window.setTimeout(() => {
          setFeedback((current) =>
            current?.id === next.id ? undefined : current,
          )
        }, WRONG_VISIBLE_MS)
        return
      }

      activeTimer.current = window.setTimeout(() => {
        setFeedback((current) =>
          current?.id === next.id ? undefined : current,
        )
        setPreviousFeedback(next)
        previousClearTimer.current = window.setTimeout(() => {
          setPreviousFeedback((current) =>
            current?.id === next.id ? undefined : current,
          )
        }, PREVIOUS_VISIBLE_MS)
      }, ACTIVE_CORRECT_MS)
    },
    [clearFeedbackTimers],
  )

  return {
    feedback,
    previousFeedback,
    recordAttempt,
  }
}
