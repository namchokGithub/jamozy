import { useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import { getCharacterStates, getComposedText } from '../../domain/korean/typing-session'
import { getLessonProgress, getLessonResult } from '../../domain/korean/lesson-session'
import { KEY_TO_JAMO } from '../../domain/korean/keymap'
import VirtualKeyboard from '../typing/VirtualKeyboard'
import type { ReviewItem } from '../../domain/models/review-item'
import type { SubmitReviewSessionOutcome } from '../../application/submit-review-session'
import type { UserSettings } from '../../domain/models/user-profile'

type KeyboardSettings = Pick<UserSettings, 'showKeyboard' | 'showEnglishKeys' | 'keyboardOpacity'>

const defaultKeyboardSettings: KeyboardSettings = {
  showKeyboard: true,
  showEnglishKeys: true,
  keyboardOpacity: 0.7,
}

interface ReviewTypingSessionProps {
  items: ReviewItem[]
  onComplete: (outcome: SubmitReviewSessionOutcome) => void
  keyboardSettings?: KeyboardSettings
}

export default function ReviewTypingSession({
  items,
  onComplete,
  keyboardSettings = defaultKeyboardSettings,
}: ReviewTypingSessionProps) {
  const { session, start, pressKey, generation, submissionId } = useLessonSessionStore()
  const fetcher = useFetcher<SubmitReviewSessionOutcome>()
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
    myGenerationRef.current = start(items.map((item) => ({ id: item.id, targetText: item.targetText })))
  }, [items, start])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (KEY_TO_JAMO[event.code]) {
        event.preventDefault()
      }
      pressKey(event.code, event.shiftKey)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pressKey])

  useEffect(() => {
    if (generation !== myGenerationRef.current) {
      return
    }
    if (session?.status === 'completed' && submissionId && !hasSubmitted.current) {
      hasSubmitted.current = true
      const metrics = getLessonResult(session)
      const results = session.completedResults.map((result) => ({
        itemId: result.exerciseId,
        wasCorrect: result.mistakes.length === 0,
      }))
      fetcher.submit({
        submissionId,
        durationSeconds: metrics.durationSeconds,
        startedAtMs: metrics.startedAtMs,
        exercisesAttempted: metrics.exercisesAttempted,
        acceptedKeystrokes: metrics.acceptedKeystrokes,
        rejectedKeystrokes: metrics.rejectedKeystrokes,
        results: results.map((result) => ({ itemId: result.itemId, wasCorrect: result.wasCorrect })),
      }, { method: 'post', encType: 'application/json' })
    }
  }, [session, generation, submissionId, fetcher])

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      onComplete(fetcher.data)
    }
  }, [fetcher.state, fetcher.data, onComplete])

  if (!session || session.status === 'completed') {
    return <p className="mt-4 text-sm text-slate-500">Saving…</p>
  }

  const progress = getLessonProgress(session)
  const characters = Array.from(session.currentSession.targetText)
  const characterStates = getCharacterStates(session.currentSession)
  const composed = getComposedText(session.currentSession)
  const nextKey = session.currentSession.expectedKeys[session.currentSession.keyIndex]

  return (
    <div className="mt-5 rounded-3xl border border-[#eadfd4] bg-[#fffdf9] p-5 shadow-sm">
      <p className="text-sm font-semibold text-[#a85d4e]">
        {progress.current} / {progress.total}
      </p>

      <div className="mt-4 flex gap-1 text-3xl">
        {characters.map((char, index) => (
          <span
            key={index}
            className={
              characterStates[index] === 'correct'
                ? 'text-[#58733f]'
                : characterStates[index] === 'current'
                  ? 'text-[#a85d4e] underline'
                  : 'text-[#c7c3bc]'
            }
          >
            {char}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-[#667085]">Typed: {composed}</p>
      {keyboardSettings.showKeyboard && (
        <VirtualKeyboard
          nextKey={nextKey}
          showEnglishKeys={keyboardSettings.showEnglishKeys}
          opacity={keyboardSettings.keyboardOpacity}
        />
      )}
    </div>
  )
}
