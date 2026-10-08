import { useCallback, useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import {
  getLessonProgress,
  getLessonResult,
  type LessonResult,
} from '../../domain/korean/lesson-session'
import { isKoreanJamoKey } from '../../domain/korean/keymap'
import VirtualKeyboard from '../typing/VirtualKeyboard'
import HangulTarget from '../typing/HangulTarget'
import FingerPlacementGuide from '../home/FingerPlacementGuide'
import { useKeyboardFeedback } from '../typing/keyboard-feedback'
import type { Lesson } from '../../domain/models/lesson'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'
import type { UserSettings } from '../../domain/models/user-profile'

type KeyboardSettings = Pick<
  UserSettings,
  'showKeyboard' | 'showEnglishKeys' | 'keyboardOpacity'
>

export interface LessonCompletion {
  outcome: CompleteLessonOutcome
  result: LessonResult
}

interface LessonTypingSessionProps {
  lesson: Lesson
  onComplete: (completion: LessonCompletion) => void
  keyboardSettings: KeyboardSettings
}

export default function LessonTypingSession({
  lesson,
  onComplete,
  keyboardSettings,
}: LessonTypingSessionProps) {
  const { session, start, pressKey, generation, submissionId } =
    useLessonSessionStore()
  const fetcher = useFetcher<CompleteLessonOutcome>()
  const hasStarted = useRef(false)
  const hasSubmitted = useRef(false)
  const completedResult = useRef<LessonResult | null>(null)
  const { feedback, recordAttempt } = useKeyboardFeedback()
  // useLessonSessionStore is a module-level singleton, so `session`/`generation`
  // may still belong to a previous lesson's mount (possibly already completed)
  // until this mount's own start() call lands. myGenerationRef pins the exact
  // generation this mount created, so the submit effect below only ever acts
  // once the store has caught up to it — a plain "skip the first run" ref
  // flag is not enough here, since React StrictMode's dev-mode double-invoke
  // of effects consumes a one-shot flag on its throwaway pass and falls
  // through to a stale read on the pass that's kept.
  const myGenerationRef = useRef<number | null>(null)

  useEffect(() => {
    if (hasStarted.current) return
    hasStarted.current = true
    myGenerationRef.current = start(
      lesson.exercises.map((exercise) => ({
        id: exercise.id,
        targetText: exercise.targetText,
      })),
    )
  }, [lesson, start])

  const handleKeyPress = useCallback(
    (code: string, shiftKey: boolean) => {
      const currentSession = useLessonSessionStore.getState().session?.currentSession
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
      const result = getLessonResult(session)
      completedResult.current = result
      fetcher.submit(
        {
          submissionId,
          accuracy: result.accuracy,
          speedWpm: result.speedWpm,
          durationSeconds: result.durationSeconds,
          startedAtMs: result.startedAtMs,
          exercisesAttempted: result.exercisesAttempted,
          acceptedKeystrokes: result.acceptedKeystrokes,
          rejectedKeystrokes: result.rejectedKeystrokes,
          mistakes: result.mistakes.map((mistake) => ({
            sourceExerciseId: mistake.sourceExerciseId,
            targetText: mistake.targetText,
          })),
        },
        { method: 'post', encType: 'application/json' },
      )
    }
  }, [session, generation, submissionId, fetcher])

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data && completedResult.current) {
      onComplete({ outcome: fetcher.data, result: completedResult.current })
    }
  }, [fetcher.state, fetcher.data, onComplete])

  if (!session || session.status === 'completed') {
    return <p className="mt-4 text-sm text-slate-500">Saving…</p>
  }

  const progress = getLessonProgress(session)
  // const composed = getComposedText(session.currentSession)
  const nextKey =
    session.currentSession.expectedKeys[session.currentSession.keyIndex]

  return (
    <div className="mt-5 rounded-3xl border border-[#eadfd4] bg-[#fffdf9] p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#a85d4e]">
        {progress.current} / {progress.total}
      </p>

      <HangulTarget
        session={session.currentSession}
        className="mt-4 text-3xl"
      />
      {/* <p className="mt-2 text-sm text-[#667085]">Typed: {composed}</p> */}
      {keyboardSettings.showKeyboard && (
        <>
          <VirtualKeyboard
            nextKey={nextKey}
            feedback={feedback}
            showEnglishKeys={keyboardSettings.showEnglishKeys}
            opacity={keyboardSettings.keyboardOpacity}
            onKeyPress={handleKeyPress}
          />
          <FingerPlacementGuide nextKey={nextKey} />
        </>
      )}
    </div>
  )
}
