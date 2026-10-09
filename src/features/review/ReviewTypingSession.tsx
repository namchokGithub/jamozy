import { useCallback, useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import {
  getLessonProgress,
  getLessonResult,
} from '../../domain/korean/lesson-session'
import {
  reviewSessionBody,
  type CompletedTypingSession,
} from './review-session-body'
import { isKoreanJamoKey } from '../../domain/korean/keymap'
import VirtualKeyboard from '../typing/VirtualKeyboard'
import HangulTarget from '../typing/HangulTarget'
import FingerPlacementGuide from '../home/FingerPlacementGuide'
import { useKeyboardFeedback } from '../typing/keyboard-feedback'
import { Button } from '../../components/ui/Button'
import type { UserSettings } from '../../domain/models/user-profile'
import { usePressedKeyCodes } from '../typing/usePressedKeyCodes'
import { useKeyboardSound } from '../typing/useKeyboardSound'

type KeyboardSettings = Pick<UserSettings, 'showKeyboard' | 'showEnglishKeys' | 'soundEnabled' | 'keyboardSoundPack'>

const defaultKeyboardSettings: KeyboardSettings = {
  showKeyboard: true,
  showEnglishKeys: true,
  soundEnabled: false,
  keyboardSoundPack: 'turquoise',
}

interface ReviewTypingSessionProps<Outcome> {
  exercises: Array<{ id: string; targetText: string }>
  onComplete: (outcome: Outcome, completed: CompletedTypingSession) => void
  keyboardSettings?: KeyboardSettings
  // Builds the action's JSON body; Review's shape by default.
  buildBody?: (completed: CompletedTypingSession) => Record<string, unknown>
}

// Shared by Review and Weak Jamo practice (DEC-051).
export default function ReviewTypingSession<Outcome extends object>({
  exercises,
  onComplete,
  keyboardSettings = defaultKeyboardSettings,
  buildBody = reviewSessionBody,
}: ReviewTypingSessionProps<Outcome>) {
  const pressedCodes = usePressedKeyCodes()
  const { session, start, pressKey, generation, submissionId } =
    useLessonSessionStore()
  const playVirtualKey = useKeyboardSound(
    keyboardSettings.soundEnabled,
    keyboardSettings.keyboardSoundPack,
    session?.status === 'typing',
  )
  const fetcher = useFetcher<Outcome | { error: string }>()
  const completedRef = useRef<CompletedTypingSession | null>(null)
  const [body, setBody] = useState<Record<string, unknown> | null>(null)
  const { feedback, previousFeedback, recordAttempt } = useKeyboardFeedback()
  const hasStarted = useRef(false)
  const hasSubmitted = useRef(false)
  // See LessonTypingSession.tsx / DEC-018 for why this needs to be a
  // generation match rather than a one-shot ref flag: useLessonSessionStore
  // is a module-level singleton shared with the lesson-typing flow too, and
  // React StrictMode's dev-mode double-invoke of mount effects defeats a
  // one-shot guard.
  const myGenerationRef = useRef<number | null>(null)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    myGenerationRef.current = start(
      exercises.map(({ id, targetText }) => ({ id, targetText })),
    )
  }, [exercises, start])

  const handleKeyPress = useCallback(
    (code: string, shiftKey: boolean) => {
      const currentSession =
        useLessonSessionStore.getState().session?.currentSession
      recordAttempt(
        currentSession?.expectedKeys[currentSession.keyIndex],
        code,
        shiftKey,
      )
      pressKey(code, shiftKey)
    },
    [pressKey, recordAttempt],
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (!isKoreanJamoKey(event.code)) {
        if (event.code === 'Space') event.preventDefault()
        return
      }
      event.preventDefault()
      handleKeyPress(event.code, event.shiftKey)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyPress])

  useEffect(() => {
    if (generation !== myGenerationRef.current) {
      return
    }
    if (
      session?.status === 'completed' &&
      submissionId &&
      !hasSubmitted.current
    ) {
      hasSubmitted.current = true
      const completed = {
        submissionId,
        metrics: getLessonResult(session),
        results: session.completedResults,
      }
      completedRef.current = completed
      const nextBody = buildBody(completed)
      setBody(nextBody)
      fetcher.submit(nextBody as never, {
        method: 'post',
        encType: 'application/json',
      })
    }
  }, [session, generation, submissionId, fetcher, buildBody])

  const saveError =
    fetcher.state === 'idle' && fetcher.data && 'error' in fetcher.data
      ? fetcher.data.error
      : null

  useEffect(() => {
    if (
      fetcher.state === 'idle' &&
      fetcher.data &&
      !('error' in fetcher.data) &&
      completedRef.current
    ) {
      onComplete(fetcher.data as Outcome, completedRef.current)
    }
  }, [fetcher.state, fetcher.data, onComplete])

  if (saveError && body) {
    // The same body keeps the submission id, so the retry cannot count twice.
    return (
      <div className="mt-4">
        <p className="text-sm text-[#a85d4e]">{saveError}</p>
        <Button
          type="button"
          className="mt-3"
          onClick={() =>
            fetcher.submit(body as never, {
              method: 'post',
              encType: 'application/json',
            })
          }
        >
          Try again
        </Button>
      </div>
    )
  }

  if (!session || session.status === 'completed') {
    return <p className="mt-4 text-sm text-slate-500">Saving…</p>
  }

  const progress = getLessonProgress(session)
  // const composed = getComposedText(session.currentSession)
  const nextKey =
    session.currentSession.expectedKeys[session.currentSession.keyIndex]

  return (
    <div className="mt-5 rounded-3xl border border-[#eadfd4] bg-[#fffdf9] p-3 shadow-sm sm:p-5">
      <p className="text-sm font-semibold text-[#a85d4e]">
        {progress.current} / {progress.total}
      </p>

      <HangulTarget
        session={session.currentSession}
        className="mt-4 mb-8 scale-120 text-8xl font-bold sm:text-8xl"
        compact
      />

      {/* <p className="mt-2 text-sm text-[#667085]">Typed: {composed}</p> */}
      {keyboardSettings.showKeyboard && (
        <>
          <VirtualKeyboard
            nextKey={nextKey}
            feedback={feedback}
            previousFeedback={previousFeedback}
            showEnglishKeys={keyboardSettings.showEnglishKeys}
            // Keyboard opacity is on hold: the setting stays stored but is
            // not offered, so the guide is always fully visible, as on Home.
            opacity={1}
            onKeyPress={(code, shiftKey) => {
              playVirtualKey(code)
              handleKeyPress(code, shiftKey)
            }}
            pressedCodes={pressedCodes}
            mobileStyle
          />
          <div className="hidden sm:block">
            <FingerPlacementGuide
              nextKey={nextKey}
              pressedCodes={pressedCodes}
            />
          </div>
        </>
      )}
    </div>
  )
}
