import { useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import { getCharacterStates, getComposedText } from '../../domain/korean/typing-session'
import { getLessonProgress, getLessonResult } from '../../domain/korean/lesson-session'
import { KEY_TO_JAMO } from '../../domain/korean/keymap'
import VirtualKeyboard from '../typing/VirtualKeyboard'
import type { Lesson } from '../../domain/models/lesson'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'

interface LessonTypingSessionProps {
  lesson: Lesson
  onComplete: (outcome: CompleteLessonOutcome) => void
}

export default function LessonTypingSession({ lesson, onComplete }: LessonTypingSessionProps) {
  const { session, start, pressKey, generation } = useLessonSessionStore()
  const fetcher = useFetcher<CompleteLessonOutcome>()
  const hasStarted = useRef(false)
  const hasSubmitted = useRef(false)
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
      lesson.exercises.map((exercise) => ({ id: exercise.id, targetText: exercise.targetText })),
    )
  }, [lesson, start])

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
    if (session?.status === 'completed' && !hasSubmitted.current) {
      hasSubmitted.current = true
      const result = getLessonResult(session)
      fetcher.submit(
        {
          accuracy: result.accuracy,
          speedWpm: result.speedWpm,
          durationSeconds: result.durationSeconds,
          mistakes: result.mistakes.map((m) => ({
            sourceExerciseId: m.sourceExerciseId,
            targetText: m.targetText,
          })),
        },
        { method: 'post', encType: 'application/json' },
      )
    }
  }, [session, generation, fetcher])

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
    <div>
      <p className="text-sm text-slate-500">
        {progress.current} / {progress.total}
      </p>

      <div className="mt-4 flex gap-1 text-3xl">
        {characters.map((char, index) => (
          <span
            key={index}
            className={
              characterStates[index] === 'correct'
                ? 'text-emerald-600'
                : characterStates[index] === 'current'
                  ? 'text-slate-900 underline'
                  : 'text-slate-300'
            }
          >
            {char}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-slate-500">Typed: {composed}</p>
      <VirtualKeyboard nextKey={nextKey} />
    </div>
  )
}
