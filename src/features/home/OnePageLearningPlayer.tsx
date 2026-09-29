import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useFetcher } from 'react-router'
import type { OnePageLearningPath } from '../../application/get-one-page-learning-path'
import { KEY_TO_JAMO } from '../../domain/korean/keymap'
import { getCharacterStates, getComposedText } from '../../domain/korean/typing-session'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import VirtualKeyboard from '../typing/VirtualKeyboard'
import FingerPlacementGuide from './FingerPlacementGuide'

interface OnePageLearningPlayerProps {
  learningPath: OnePageLearningPath
}

export default function OnePageLearningPlayer({ learningPath }: OnePageLearningPlayerProps) {
  const { session, start, pressKey } = useLessonSessionStore()
  const fetcher = useFetcher<{ onePageCheckpointed?: boolean }>()
  const completedIds = useRef(new Set<string>())
  const [nowMs, setNowMs] = useState(0)
  const queueKey = useMemo(
    () => learningPath.queue.map(({ lesson, exercise }) => `${lesson.id}:${exercise.id}`).join(','),
    [learningPath.queue],
  )
  const sessionStartedAtMs = session?.startedAt.getTime()

  useEffect(() => {
    completedIds.current = new Set()
    if (learningPath.queue.length > 0) {
      start(learningPath.queue.map(({ exercise }) => ({ id: exercise.id, targetText: exercise.targetText })))
    }
  }, [queueKey, learningPath.queue, start])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (KEY_TO_JAMO[event.code]) event.preventDefault()
      pressKey(event.code, event.shiftKey)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [pressKey])

  useEffect(() => {
    if (sessionStartedAtMs === undefined) return
    const updateNow = () => setNowMs(Date.now())
    updateNow()
    const intervalId = window.setInterval(updateNow, 1000)
    return () => window.clearInterval(intervalId)
  }, [sessionStartedAtMs])

  useEffect(() => {
    const result = session?.lastCompletedExercise
    if (!result || completedIds.current.has(result.exerciseId)) return
    const entry = learningPath.queue.find(({ exercise }) => exercise.id === result.exerciseId)
    if (!entry || !learningPath.selectedCourseId) return
    completedIds.current.add(result.exerciseId)
    fetcher.submit(JSON.stringify({
      intent: 'one-page-exercise-completed',
      courseId: learningPath.selectedCourseId,
      lessonId: entry.lesson.id,
      result,
    }), { method: 'post', encType: 'application/json' })
  }, [fetcher, learningPath.queue, learningPath.selectedCourseId, session?.lastCompletedExercise])

  if (learningPath.courses.length === 0) return null
  const currentIndex = session?.currentIndex ?? 0
  const active = learningPath.queue[currentIndex]
  const characters = session ? Array.from(session.currentSession.targetText) : []
  const states = session ? getCharacterStates(session.currentSession) : []
  const nextKey = session?.currentSession.expectedKeys[session.currentSession.keyIndex]
  const acceptedKeystrokes = session
    ? session.completedResults.reduce((total, result) => total + result.correctKeyCount, 0) + session.currentSession.keyIndex
    : 0
  const rejectedKeystrokes = session
    ? session.completedResults.reduce((total, result) => total + result.mistakes.length, 0) + session.currentSession.mistakes.length
    : 0
  const elapsedSeconds = session ? Math.max((nowMs - session.startedAt.getTime()) / 1000, 1) : 1
  const accuracy = acceptedKeystrokes + rejectedKeystrokes === 0 ? 0 : Math.round((acceptedKeystrokes / (acceptedKeystrokes + rejectedKeystrokes)) * 100)
  const wpm = Math.round((acceptedKeystrokes / 5) / (elapsedSeconds / 60))

  return (
    <section className="mt-7 rounded-4xl border border-[#d9d1ed] bg-[#fffdf9] p-5 shadow-[0_20px_55px_-35px_rgba(87,65,45,0.45)] sm:p-7" aria-labelledby="one-page-player-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#7863a8]">TYPE, ONE STEP AT A TIME</p>
          <h2 id="one-page-player-heading" className="mt-1 text-2xl font-bold tracking-tight text-[#253247]">Your practice room</h2>
        </div>
        <p className="rounded-full bg-[#f2edf9] px-3 py-1.5 text-sm font-semibold text-[#7863a8]">{Math.min(currentIndex + 1, learningPath.queue.length)} / {learningPath.queue.length || 0}</p>
      </div>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Choose course">
        {learningPath.courses.map((course) => (
          <Link key={course.id} to={`/?course=${encodeURIComponent(course.id)}`} className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${course.id === learningPath.selectedCourseId ? 'border-[#9d8bc8] bg-[#e9e1f8] text-[#5c4b88]' : 'border-[#eadfd4] bg-white text-[#667085] hover:border-[#c8b9e7]'}`}>
            {course.title}
          </Link>
        ))}
      </nav>

      {active && session ? (
        <div className="mt-6">
          <p className="text-sm font-semibold text-[#a85d4e]">{active.lesson.title}</p>
          <div className="mt-3 flex justify-center gap-2">
            <span className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 text-center text-xs font-semibold text-[#667085]">WPM <strong className="ml-1 text-base text-[#253247]">{wpm}</strong></span>
            <span className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 text-center text-xs font-semibold text-[#667085]">ACC <strong className="ml-1 text-base text-[#253247]">{accuracy}%</strong></span>
          </div>
          <div className="mt-3 rounded-3xl border border-[#eadfd4] bg-white p-6 text-center">
            <div className="flex justify-center gap-1 text-4xl font-bold tracking-wide sm:text-5xl">
              {characters.map((character, index) => (
                <span key={`${character}-${index}`} className={states[index] === 'correct' ? 'text-[#58733f]' : states[index] === 'current' ? 'text-[#a85d4e] underline' : 'text-[#c7c3bc]'}>{character}</span>
              ))}
            </div>
            <p className="mt-4 text-sm text-[#667085]">{active.exercise.meaningTh}</p>
            <p className="mt-1 text-sm text-[#667085]">{active.exercise.meaningEn}</p>
            {active.exercise.romanization && <p className="mt-2 text-sm italic text-[#7863a8]">{active.exercise.romanization}</p>}
            <p className="mt-4 text-xs text-[#98a2b3]">Typed: {getComposedText(session.currentSession)}</p>
          </div>
          <VirtualKeyboard nextKey={nextKey} showEnglishKeys opacity={1} />
          <FingerPlacementGuide />
          {fetcher.state !== 'idle' && <p className="mt-3 text-center text-sm text-[#667085]">Saving progress…</p>}
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-[#dfcfc0] bg-white/60 p-6 text-center text-sm text-[#667085]">
          {learningPath.pendingLessonId ? <button type="button" className="rounded-full bg-[#e9e1f8] px-4 py-2 font-semibold text-[#5c4b88]" onClick={() => fetcher.submit(JSON.stringify({ intent: 'one-page-retry-completion', courseId: learningPath.selectedCourseId, lessonId: learningPath.pendingLessonId }), { method: 'post', encType: 'application/json' })}>Save completed lesson</button> : 'This course is complete. Choose another course or revisit a lesson below.'}
        </div>
      )}
    </section>
  )
}
