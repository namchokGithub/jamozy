import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useFetcher } from 'react-router'
import type {
  OnePageLearningPath,
  OnePageQueueExercise,
} from '../../application/get-one-page-learning-path'
import type { ExerciseResult } from '../../domain/korean/lesson-session'
import { isTypingInputKey } from '../../domain/korean/keymap'
import type { CourseListLoaderData } from '../course/CourseListPage.loader'
import VirtualKeyboard from '../typing/VirtualKeyboard'
import HangulTarget from '../typing/HangulTarget'
import FingerPlacementGuide from './FingerPlacementGuide'
import { useKeyboardFeedback } from '../typing/keyboard-feedback'
import { useOnePagePlayerStore } from './one-page-player-store'
import { usePressedKeyCodes } from '../typing/usePressedKeyCodes'
import { useKeyboardSound } from '../typing/useKeyboardSound'
import { useResolvedSoundSettings, type SoundSettings } from '../typing/useResolvedSoundSettings'

interface OnePageLearningPlayerProps {
  learningPath: OnePageLearningPath
  settings: SoundSettings | Promise<SoundSettings>
}

type PendingCheckpoint =
  | {
      intent: 'one-page-exercise-completed'
      courseId: string
      lessonId: string
      result: ExerciseResult
    }
  | { intent: 'one-page-retry-completion'; courseId: string; lessonId: string }

// Refill the play queue once this many words, including the current one,
// remain (DEC-042).
const REFILL_THRESHOLD = 3

export default function OnePageLearningPlayer({
  learningPath,
  settings,
}: OnePageLearningPlayerProps) {
  const pressedCodes = usePressedKeyCodes()
  const {
    entries,
    session,
    completedCount,
    exhausted,
    acceptedKeystrokes: completedAcceptedKeystrokes,
    rejectedKeystrokes: completedRejectedKeystrokes,
    start,
    append,
    pressKey,
  } = useOnePagePlayerStore()
  const soundSettings = useResolvedSoundSettings(settings)
  const playVirtualKey = useKeyboardSound(
    soundSettings.soundEnabled,
    soundSettings.keyboardSoundPack,
    session?.status === 'typing',
  )
  const fetcher = useFetcher<{ onePageCheckpointed?: boolean }>()
  const refill = useFetcher<CourseListLoaderData>()
  // The player owns its queue from mount on; later loader data for the same
  // course (revalidation) never restarts it. The parent keys the player by
  // course, so a course change mounts a fresh player.
  const [initialPath] = useState(learningPath)
  const courseId = initialPath.selectedCourseId
  const pendingCheckpoints = useRef<PendingCheckpoint[]>([])
  const activeCheckpoint = useRef<PendingCheckpoint | null>(null)
  const completedCheckpointData = useRef(fetcher.data)
  const retryQueued = useRef(false)
  const requestedTail = useRef<OnePageQueueExercise | null>(null)
  const handledRefill = useRef(refill.data)
  const [checkpointVersion, setCheckpointVersion] = useState(0)
  const [nowMs, setNowMs] = useState(0)
  const { feedback, previousFeedback, recordAttempt } = useKeyboardFeedback()
  const sessionStartedAtMs = session?.startedAt.getTime()

  useEffect(() => {
    start(initialPath.queue)
    // A lesson whose completion failed earlier is retried in the background.
    if (initialPath.pendingLessonId && courseId && !retryQueued.current) {
      retryQueued.current = true
      pendingCheckpoints.current.push({
        intent: 'one-page-retry-completion',
        courseId,
        lessonId: initialPath.pendingLessonId,
      })
      setCheckpointVersion((version) => version + 1)
    }
  }, [courseId, initialPath, start])

  useEffect(() => {
    if (sessionStartedAtMs === undefined) return
    const updateNow = () => setNowMs(Date.now())
    updateNow()
    const intervalId = window.setInterval(updateNow, 1000)
    return () => window.clearInterval(intervalId)
  }, [sessionStartedAtMs])

  const handleKeyPress = useCallback(
    (code: string, shiftKey: boolean) => {
      const currentSession =
        useOnePagePlayerStore.getState().session?.currentSession
      recordAttempt(
        currentSession?.expectedKeys[currentSession.keyIndex],
        code,
        shiftKey,
      )
      const completed = pressKey(code, shiftKey)
      if (!completed || !courseId) return
      pendingCheckpoints.current.push({
        intent: 'one-page-exercise-completed',
        courseId,
        lessonId: completed.entry.lesson.id,
        result: completed.result,
      })
      setCheckpointVersion((version) => version + 1)
    },
    [courseId, pressKey, recordAttempt],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (!isTypingInputKey(event.code)) return
      event.preventDefault()
      handleKeyPress(event.code, event.shiftKey)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKeyPress])

  useEffect(() => {
    if (
      fetcher.state !== 'idle' ||
      !activeCheckpoint.current ||
      fetcher.data === completedCheckpointData.current
    )
      return
    completedCheckpointData.current = fetcher.data
    activeCheckpoint.current = null
    setCheckpointVersion((version) => version + 1)
  }, [fetcher.data, fetcher.state])

  useEffect(() => {
    if (fetcher.state !== 'idle' || activeCheckpoint.current) return
    const nextCheckpoint = pendingCheckpoints.current.shift()
    if (!nextCheckpoint) return
    activeCheckpoint.current = nextCheckpoint
    fetcher.submit(JSON.stringify(nextCheckpoint), {
      method: 'post',
      encType: 'application/json',
      defaultShouldRevalidate: false,
    })
  }, [checkpointVersion, fetcher, fetcher.state])

  const tail = entries.at(-1) ?? null
  useEffect(() => {
    if (
      exhausted ||
      !courseId ||
      !tail ||
      entries.length > REFILL_THRESHOLD ||
      refill.state !== 'idle' ||
      requestedTail.current === tail
    )
      return
    requestedTail.current = tail
    const params = new URLSearchParams({
      course: courseId,
      afterLesson: tail.lesson.id,
      afterExercise: tail.exercise.id,
    })
    refill.load(`/?${params}`)
  }, [courseId, entries.length, exhausted, refill, refill.state, tail])

  useEffect(() => {
    if (
      refill.state !== 'idle' ||
      !refill.data ||
      refill.data === handledRefill.current
    )
      return
    handledRefill.current = refill.data
    const requestedFor = requestedTail.current
    void refill.data.onePageLearningPath.then((path) => {
      // Each request is made for a specific tail entry; a response for an
      // older tail would duplicate words, so it is dropped.
      if (useOnePagePlayerStore.getState().entries.at(-1) !== requestedFor)
        return
      append(path?.selectedCourseId === courseId ? path.queue : [])
    })
  }, [append, courseId, refill.data, refill.state])

  if (initialPath.courses.length === 0) return null
  const active = entries[session?.currentIndex ?? 0]
  const finished = !session || (session.status === 'completed' && exhausted)
  const nextKey =
    session?.currentSession.expectedKeys[session.currentSession.keyIndex]
  const acceptedKeystrokes =
    completedAcceptedKeystrokes + (session?.currentSession.keyIndex ?? 0)
  const rejectedKeystrokes =
    completedRejectedKeystrokes + (session?.currentSession.mistakes.length ?? 0)
  const elapsedSeconds = session
    ? Math.max((nowMs - session.startedAt.getTime()) / 1000, 1)
    : 1
  const accuracy =
    acceptedKeystrokes + rejectedKeystrokes === 0
      ? 0
      : Math.round(
          (acceptedKeystrokes / (acceptedKeystrokes + rejectedKeystrokes)) *
            100,
        )
  const wpm = Math.round(acceptedKeystrokes / 5 / (elapsedSeconds / 60))
  const completedSteps = session?.currentSession.keyIndex ?? 0
  const totalSteps = session?.currentSession.expectedKeys.length ?? 0
  const progressPercent =
    totalSteps === 0 ? 0 : (completedSteps / totalSteps) * 100
  const meaning = [active?.exercise.meaningTh, active?.exercise.meaningEn]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' : ')

  return (
    <section
      className="mt-2 rounded-4xl border border-[#d9d1ed] bg-[#fffdf9] p-5 shadow-[0_20px_55px_-35px_rgba(87,65,45,0.45)] select-none! sm:p-7"
      aria-labelledby="one-page-player-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#7863a8]">
            TYPE, ONE STEP AT A TIME
          </p>
          <h2
            id="one-page-player-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-[#253247]"
          >
            Your practice room
          </h2>
        </div>
        <p className="rounded-full bg-[#f2edf9] px-3 py-1.5 text-sm font-semibold text-[#7863a8]">
          {completedCount} typed
        </p>
      </div>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Choose course">
        {learningPath.courses.map((course) => (
          <Link
            key={course.id}
            to={`/?course=${encodeURIComponent(course.id)}`}
            className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${course.id === courseId ? 'border-[#9d8bc8] bg-[#e9e1f8] text-[#5c4b88]' : 'border-[#eadfd4] bg-white text-[#667085] hover:border-[#c8b9e7]'}`}
          >
            {course.title}
          </Link>
        ))}
      </nav>

      {active && session && !finished ? (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#a85d4e]">
            {active.lesson.title}
          </p>
          <div className="mt-2 rounded-3xl bg-[#fffaf6] p-4 text-center shadow-[0_0_30px_-20px_rgba(87,65,45,0.35)]">
            <div className="flex h-5 justify-end gap-1.5">
              <span className="rounded-lg border border-[#eadfd4] bg-[#fffdf9] px-2 py-0.5 text-[10px] font-semibold text-[#98a2b3]">
                WPM <strong className="ml-0.5 text-[#667085]">{wpm}</strong>
              </span>
              <span className="rounded-lg border border-[#eadfd4] bg-[#fffdf9] px-2 py-0.5 text-[10px] font-semibold text-[#98a2b3]">
                ACC{' '}
                <strong className="ml-0.5 text-[#667085]">{accuracy}%</strong>
              </span>
            </div>
            <HangulTarget
              session={session.currentSession}
              className="mt-1 origin-center scale-120 text-4xl font-bold tracking-wide sm:text-5xl"
            />
            <div className="mx-auto mt-3 max-w-44">
              <p className="text-[10px] font-semibold text-[#98a2b3]">
                {completedSteps} / {totalSteps} steps
              </p>
              <div
                className="mt-1 h-1 overflow-hidden rounded-full bg-[#f2edf9]"
                role="progressbar"
                aria-label="Typing progress"
                aria-valuemin={0}
                aria-valuemax={totalSteps}
                aria-valuenow={completedSteps}
              >
                <div
                  className="h-full rounded-full bg-[#c84f82] transition-[width] duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
            <div className="mt-5 grid h-9 grid-rows-2">
              <div className="h-4 max-w-full truncate text-xs text-[#98a2b3]">
                {meaning || (
                  <span className="italic text-[#e4e2df]">No meaning</span>
                )}
              </div>
              <div className="h-4 max-w-full truncate text-xs italic text-[#a293bd]">
                {active.exercise.romanization || (
                  <span className="italic text-[#e4e2df]">No romanization</span>
                )}
              </div>
            </div>
            {/* <p className="mt-4 text-xs text-[#98a2b3]">Typed: {getComposedText(session.currentSession)}</p> */}
          </div>
          <VirtualKeyboard
            nextKey={nextKey}
            feedback={feedback}
            previousFeedback={previousFeedback}
            showEnglishKeys
            opacity={1}
            onKeyPress={(code, shiftKey) => {
              playVirtualKey(code)
              handleKeyPress(code, shiftKey)
            }}
            pressedCodes={pressedCodes}
          />
          <FingerPlacementGuide nextKey={nextKey} pressedCodes={pressedCodes} />
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-[#dfcfc0] bg-white/60 p-6 text-center text-sm text-[#667085]">
          This course is complete. Choose another course or revisit a lesson
          below.
        </div>
      )}
    </section>
  )
}
