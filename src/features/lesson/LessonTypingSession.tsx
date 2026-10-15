import { useCallback, useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { motion } from 'motion/react'
import { useFetcher } from 'react-router'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import {
  getLessonProgress,
  getLessonResult,
  type LessonResult,
} from '../../domain/korean/lesson-session'
import { isTypingInputKey } from '../../domain/korean/keymap'
import VirtualKeyboard from '../typing/VirtualKeyboard'
import HangulTarget from '../typing/HangulTarget'
import FingerPlacementGuide from '../home/FingerPlacementGuide'
import ExerciseHint from '../home/ExerciseHint'
import { useKeyboardFeedback } from '../typing/keyboard-feedback'
import type { Lesson } from '../../domain/models/lesson'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'
import type { CompleteLessonActionData } from './LessonDetailPage.action'
import { Button } from '../../components/ui/Button'
import type { UserSettings } from '../../domain/models/user-profile'
import { usePressedKeyCodes } from '../typing/usePressedKeyCodes'
import { useKeyboardSound } from '../typing/useKeyboardSound'

type KeyboardSettings = Pick<
  UserSettings,
  'showKeyboard' | 'showEnglishKeys' | 'soundEnabled' | 'keyboardSoundPack'
>

export interface LessonCompletion {
  outcome: CompleteLessonOutcome
  result: LessonResult
}

interface LessonTypingSessionProps {
  lesson: Lesson
  onComplete: (completion: LessonCompletion) => void
  keyboardSettings: KeyboardSettings
  onExit?: () => void
}

// After this long without an answer, the save is offered again.
const SLOW_SAVE_MS = 15000

const statBadgeClass =
  'rounded-lg border border-[#eadfd4] bg-[#fffdf9] px-2 py-0.5 text-[10px] font-semibold text-[#98a2b3]'

const comboLook = (combo: number) => {
  if (combo >= 50)
    return {
      className:
        'border-[#edc66a] bg-[#fff6d7] text-[#a66b12] shadow-[0_0_14px_rgba(231,181,57,0.32)]',
      scale: 1.25,
    }
  if (combo >= 20)
    return {
      className:
        'border-[#f0b7cd] bg-[#fff0f6] text-[#c04e80] shadow-[0_0_12px_rgba(224,138,159,0.3)]',
      scale: 1.2,
    }
  if (combo >= 10)
    return {
      className: 'border-[#f1c6b5] bg-[#fff1e9] text-[#c26e4e]',
      scale: 1.1,
    }
  if (combo >= 5)
    return {
      className: 'border-[#b9e2cf] bg-[#e8f8ef] text-[#3e8a70]',
      scale: 1,
    }
  return { className: 'border-[#d9d1ed] bg-[#f2edf9] text-[#7863a8]', scale: 1 }
}

export default function LessonTypingSession({
  lesson,
  onComplete,
  keyboardSettings,
  onExit,
}: LessonTypingSessionProps) {
  const pressedCodes = usePressedKeyCodes()
  const { session, start, pressKey, generation, submissionId } =
    useLessonSessionStore()
  const playVirtualKey = useKeyboardSound(
    keyboardSettings.soundEnabled,
    keyboardSettings.keyboardSoundPack,
    session?.status === 'typing',
  )
  const fetcher = useFetcher<CompleteLessonActionData>()
  const submittedPayload = useRef<Record<string, unknown> | null>(null)
  const [slowSave, setSlowSave] = useState(false)
  const [nowMs, setNowMs] = useState(0)
  const [combo, setCombo] = useState(0)
  const [comboBreak, setComboBreak] = useState(0)
  const hasStarted = useRef(false)
  const hasSubmitted = useRef(false)
  const completedResult = useRef<LessonResult | null>(null)
  const { feedback, previousFeedback, recordAttempt } = useKeyboardFeedback()
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
      const store = useLessonSessionStore.getState()
      const lessonSession = store.session
      const currentSession = lessonSession?.currentSession
      const expected = currentSession?.expectedKeys[currentSession.keyIndex]
      const correct =
        expected &&
        expected.code === code &&
        (!expected.strictShift || expected.shift === shiftKey)
      recordAttempt(expected, code, shiftKey)
      if (correct && currentSession) {
        const completesLesson =
          currentSession.keyIndex + 1 === currentSession.expectedKeys.length &&
          lessonSession &&
          lessonSession.currentIndex + 1 === lessonSession.exercises.length
        if (completesLesson) {
          setCombo(0)
          setComboBreak((count) => count + 1)
        } else {
          setCombo((count) => count + 1)
        }
      }
      pressKey(code, shiftKey)
    },
    [pressKey, recordAttempt],
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (!isTypingInputKey(event.code)) return
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
      submittedPayload.current = {
        submissionId,
        accuracy: result.accuracy,
        speedWpm: result.speedWpm,
        durationSeconds: result.durationSeconds,
        startedAtMs: result.startedAtMs,
        exercisesAttempted: result.exercisesAttempted,
        acceptedKeystrokes: result.acceptedKeystrokes,
        rejectedKeystrokes: result.rejectedKeystrokes,
        exercises: result.exercises,
        ...(result.jamoCounts ? { jamoCounts: result.jamoCounts } : {}),
        mistakes: result.mistakes.map((mistake) => ({
          sourceExerciseId: mistake.sourceExerciseId,
          targetText: mistake.targetText,
        })),
      }
      fetcher.submit(submittedPayload.current as never, {
        method: 'post',
        encType: 'application/json',
      })
    }
  }, [session, generation, submissionId, fetcher])

  useEffect(() => {
    if (
      fetcher.state === 'idle' &&
      fetcher.data &&
      !('error' in fetcher.data) &&
      completedResult.current
    ) {
      onComplete({
        outcome: fetcher.data as CompleteLessonOutcome,
        result: completedResult.current,
      })
    }
  }, [fetcher.state, fetcher.data, onComplete])

  const saving = fetcher.state !== 'idle'
  useEffect(() => {
    if (!saving) return
    const timer = window.setTimeout(() => setSlowSave(true), SLOW_SAVE_MS)
    return () => window.clearTimeout(timer)
  }, [saving])

  const sessionStartedAtMs = session?.startedAt.getTime()
  useEffect(() => {
    if (sessionStartedAtMs === undefined) return
    const updateNow = () => setNowMs(Date.now())
    updateNow()
    const intervalId = window.setInterval(updateNow, 1000)
    return () => window.clearInterval(intervalId)
  }, [sessionStartedAtMs])

  const retrySave = () => {
    if (!submittedPayload.current) return
    setSlowSave(false)
    fetcher.submit(submittedPayload.current as never, {
      method: 'post',
      encType: 'application/json',
    })
  }

  if (!session || session.status === 'completed') {
    const saveError =
      !saving && fetcher.data && 'error' in fetcher.data
        ? fetcher.data.error
        : null
    if (saveError || slowSave)
      return (
        <div
          role="alert"
          className="mt-5 rounded-3xl border border-[#f0d2c8] bg-[#fff5f1] p-5 text-sm text-[#8d4c43]"
        >
          <p>
            {saveError ?? 'Still saving… Check your connection and try again.'}
          </p>
          <Button type="button" className="mt-3" onClick={retrySave}>
            Try again
          </Button>
        </div>
      )
    return <p className="mt-4 text-sm text-slate-500">Saving…</p>
  }

  const acceptedKeystrokes =
    session.completedResults.reduce(
      (total, entry) => total + entry.correctKeyCount,
      0,
    ) + session.currentSession.keyIndex
  const rejectedKeystrokes =
    session.completedResults.reduce(
      (total, entry) => total + entry.mistakes.length,
      0,
    ) + session.currentSession.mistakes.length
  const elapsedSeconds = Math.max(
    (nowMs - session.startedAt.getTime()) / 1000,
    1,
  )
  const accuracy =
    acceptedKeystrokes + rejectedKeystrokes === 0
      ? 0
      : Math.round(
          (acceptedKeystrokes / (acceptedKeystrokes + rejectedKeystrokes)) *
            100,
        )
  const wpm = Math.round(acceptedKeystrokes / 5 / (elapsedSeconds / 60))

  const progress = getLessonProgress(session)
  const comboStyle = comboLook(combo)
  // const composed = getComposedText(session.currentSession)
  const nextKey =
    session.currentSession.expectedKeys[session.currentSession.keyIndex]
  const currentExercise = lesson.exercises[session.currentIndex]

  return (
    <div className="mt-5 rounded-3xl border border-[#eadfd4] bg-[#fffdf9] p-3 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            className="flex items-center gap-1 rounded-full border border-[#eadfd4] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#596579] transition hover:border-[#d8b3a9] hover:text-[#8d4c43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
          >
            <X aria-hidden="true" size={13} />
            Exit lesson
          </button>
        ) : (
          <span />
        )}
        <div className="flex flex-1 flex-wrap justify-end gap-1.5">
          <span className={statBadgeClass}>
            WPM <strong className="ml-0.5 text-[#667085]">{wpm}</strong>
          </span>
          <span className={statBadgeClass}>
            ACC <strong className="ml-0.5 text-[#667085]">{accuracy}%</strong>
          </span>
          <motion.span
            animate={{
              scale: [
                comboStyle.scale,
                comboStyle.scale * 1.12,
                comboStyle.scale,
              ],
            }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
            className={`relative inline-flex items-center gap-1 overflow-hidden rounded-lg border px-2 py-0.5 text-[10px] font-bold ${comboStyle.className}`}
          >
            {comboBreak > 0 && (
              <motion.span
                key={comboBreak}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[#f28c78]"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.65, 0] }}
                transition={{ duration: 0.42, ease: 'easeOut' }}
              />
            )}
            <Sparkles aria-hidden="true" size={12} strokeWidth={2.25} />
            <span className="relative">Combo x{combo}</span>
          </motion.span>
          <span className="rounded-lg border border-[#eadfd4] bg-[#f2edf9] px-2 py-0.5 text-[10px] font-semibold text-[#7863a8]">
            {progress.current} / {progress.total}
          </span>
        </div>
      </div>

      <HangulTarget
        session={session.currentSession}
        className="mt-4 text-3xl"
        size="compact"
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
            onUtilityKeyPress={playVirtualKey}
            pressedCodes={pressedCodes}
            mobileStyle
          />
          <div className="hidden sm:block">
            <FingerPlacementGuide
              nextKey={nextKey}
              pressedCodes={pressedCodes}
              hint={currentExercise?.hint}
              exerciseId={currentExercise?.id}
            />
          </div>
          <div className="sm:hidden">
            <ExerciseHint
              key={currentExercise?.id}
              hint={currentExercise?.hint ?? null}
            />
          </div>
        </>
      )}
      {!keyboardSettings.showKeyboard && (
        <ExerciseHint
          key={currentExercise?.id}
          hint={currentExercise?.hint ?? null}
        />
      )}
    </div>
  )
}
