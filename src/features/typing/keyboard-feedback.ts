import { useCallback, useRef, useState } from 'react'
import type { ExpectedKey } from '../../domain/korean/target-sequence'

export interface KeyboardFeedback {
  id: number
  code: string
  shift: boolean
  outcome: 'correct' | 'wrong'
}

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
  const nextFeedbackId = useRef(0)

  const recordAttempt = useCallback(
    (expectedKey: ExpectedKey | undefined, code: string, shift: boolean) => {
      const next = createKeyboardFeedback(
        expectedKey,
        code,
        shift,
        nextFeedbackId.current + 1,
      )
      if (!next) return
      nextFeedbackId.current = next.id
      setFeedback(next)
    },
    [],
  )

  return { feedback, recordAttempt }
}
