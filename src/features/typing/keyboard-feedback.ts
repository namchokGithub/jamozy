import { useCallback, useEffect, useRef, useState } from 'react'
import type { ExpectedKey } from '../../domain/korean/target-sequence'

export interface KeyboardFeedback {
  id: number
  code: string
  shift: boolean
  outcome: 'correct' | 'wrong'
}

const ACTIVE_CORRECT_MS = 140
const PREVIOUS_VISIBLE_MS = 420
const PREVIOUS_FADE_MS = 260
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
  const [isPreviousFading, setIsPreviousFading] = useState(false)
  const nextFeedbackId = useRef(0)
  const activeTimer = useRef<number | undefined>(undefined)
  const previousFadeTimer = useRef<number | undefined>(undefined)
  const previousClearTimer = useRef<number | undefined>(undefined)
  const wrongFadeTimer = useRef<number | undefined>(undefined)
  const wrongClearTimer = useRef<number | undefined>(undefined)
  const [isFeedbackFading, setIsFeedbackFading] = useState(false)

  const clearCorrectTimers = useCallback(() => {
    if (activeTimer.current !== undefined)
      window.clearTimeout(activeTimer.current)
    if (previousFadeTimer.current !== undefined)
      window.clearTimeout(previousFadeTimer.current)
    if (previousClearTimer.current !== undefined)
      window.clearTimeout(previousClearTimer.current)
    if (wrongFadeTimer.current !== undefined)
      window.clearTimeout(wrongFadeTimer.current)
    if (wrongClearTimer.current !== undefined)
      window.clearTimeout(wrongClearTimer.current)
  }, [])

  useEffect(() => clearCorrectTimers, [clearCorrectTimers])

  const recordAttempt = useCallback(
    (expectedKey: ExpectedKey | undefined, code: string, shift: boolean) => {
      const next = createKeyboardFeedback(
        expectedKey,
        code,
        shift,
        nextFeedbackId.current + 1,
      )
      if (!next) return
      clearCorrectTimers()
      nextFeedbackId.current = next.id
      setPreviousFeedback(undefined)
      setIsPreviousFading(false)
      setIsFeedbackFading(false)
      setFeedback(next)

      if (next.outcome === 'wrong') {
        wrongFadeTimer.current = window.setTimeout(() => {
          setIsFeedbackFading(true)
          wrongClearTimer.current = window.setTimeout(() => {
            setFeedback((current) =>
              current?.id === next.id ? undefined : current,
            )
            setIsFeedbackFading(false)
          }, PREVIOUS_FADE_MS)
        }, WRONG_VISIBLE_MS)
        return
      }

      activeTimer.current = window.setTimeout(() => {
        setFeedback((current) =>
          current?.id === next.id ? undefined : current,
        )
        setPreviousFeedback(next)
        previousFadeTimer.current = window.setTimeout(() => {
          setIsPreviousFading(true)
          previousClearTimer.current = window.setTimeout(() => {
            setPreviousFeedback((current) =>
              current?.id === next.id ? undefined : current,
            )
            setIsPreviousFading(false)
          }, PREVIOUS_FADE_MS)
        }, PREVIOUS_VISIBLE_MS)
      }, ACTIVE_CORRECT_MS)
    },
    [clearCorrectTimers],
  )

  return {
    feedback,
    previousFeedback,
    isPreviousFading,
    isFeedbackFading,
    recordAttempt,
  }
}
