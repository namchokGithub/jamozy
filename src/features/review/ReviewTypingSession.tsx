import { useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import { getCharacterStates, getComposedText } from '../../domain/korean/typing-session'
import { getLessonProgress } from '../../domain/korean/lesson-session'
import { KEY_TO_JAMO } from '../../domain/korean/keymap'
import VirtualKeyboard from '../typing/VirtualKeyboard'
import type { ReviewItem } from '../../domain/models/review-item'
import type { SubmitReviewSessionOutcome } from '../../application/submit-review-session'

interface ReviewTypingSessionProps {
  items: ReviewItem[]
  onComplete: (outcome: SubmitReviewSessionOutcome) => void
}

export default function ReviewTypingSession({ items, onComplete }: ReviewTypingSessionProps) {
  const { session, start, pressKey, generation } = useLessonSessionStore()
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
    if (session?.status === 'completed' && !hasSubmitted.current) {
      hasSubmitted.current = true
      const results = session.completedResults.map((result) => ({
        itemId: result.exerciseId,
        wasCorrect: result.mistakes.length === 0,
      }))
      fetcher.submit({ results }, { method: 'post', encType: 'application/json' })
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
