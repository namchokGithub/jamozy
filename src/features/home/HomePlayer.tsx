import { useCallback, useEffect, useState } from 'react'
import type { HomePlayerData } from '../../application/get-home-player'
import {
  homeLessonProgress,
  homeReplayTotals,
  nextHomeLesson,
  resolveHomeResume,
  type HomeLessonRef,
} from '../../domain/home/home-session'
import { isKoreanJamoKey } from '../../domain/korean/keymap'
import type { Progress } from '../../domain/models/progress'
import VirtualKeyboard from '../typing/VirtualKeyboard'
import HangulTarget from '../typing/HangulTarget'
import { useSnackbar } from '../../components/ui/SnackbarProvider'
import FingerPlacementGuide from './FingerPlacementGuide'
import { useKeyboardFeedback } from '../typing/keyboard-feedback'
import { useHomePlayerStore } from './home-player-store'
import { useHomeServices } from './home-services'

interface HomePlayerProps {
  data: HomePlayerData
  // Live Progress read in the background; null keeps the cached Progress.
  liveProgress: Promise<Progress[] | null>
  random?: () => number
}

const toProgressMap = (progress: Progress[]) =>
  new Map(progress.map((entry) => [entry.lessonId, entry]))

// Plays the static Home course (DEC-043). The player owns its session from
// mount on: later loader data never restarts it (DEC-042), and every write
// goes to the background outbox through HomeServices.
export default function HomePlayer({
  data,
  liveProgress,
  random,
}: HomePlayerProps) {
  const services = useHomeServices()
  const {
    unitId,
    lesson,
    exercises,
    session,
    selectedUnitId,
    startLesson,
    pressKey,
    selectUnit,
  } = useHomePlayerStore()
  const { showSuccess } = useSnackbar()
  const [{ content, initialProgress, initialPending, resume }] = useState(
    () => ({
      content: data.content,
      initialProgress: toProgressMap(data.progress),
      initialPending: new Map(
        Object.entries(data.pendingExerciseIds).map(([lessonId, ids]) => [
          lessonId,
          new Set(ids),
        ]),
      ),
      resume: data.resume,
    }),
  )
  const [progressByLesson, setProgressByLesson] = useState(initialProgress)
  // Exercises completed on this device that the outbox may not have written.
  const [localDone, setLocalDone] = useState(initialPending)
  const [nowMs, setNowMs] = useState(0)
  const { feedback, previousFeedback, recordAttempt } = useKeyboardFeedback()

  useEffect(() => {
    let active = true
    void liveProgress.then((progress) => {
      if (active && progress) setProgressByLesson(toProgressMap(progress))
    })
    return () => {
      active = false
    }
  }, [liveProgress])

  const lessonById = useCallback(
    (lessonId: string) =>
      content.units
        .flatMap(({ lessons }) => lessons)
        .find(({ id }) => id === lessonId) ?? null,
    [content],
  )

  const isCompleted = useCallback(
    (lessonId: string) => {
      const target = lessonById(lessonId)
      if (!target) return false
      const { done, total } = homeLessonProgress(
        target,
        progressByLesson.get(lessonId) ?? null,
        localDone.get(lessonId),
      )
      return done === total
    },
    [lessonById, localDone, progressByLesson],
  )

  const open = useCallback(
    (ref: HomeLessonRef) => {
      const target = lessonById(ref.lessonId)
      if (!target) return
      startLesson(ref.unitId, target, {
        isReplay: isCompleted(ref.lessonId),
        random,
      })
      services.saveResume(ref)
    },
    [isCompleted, lessonById, random, services, startLesson],
  )

  useEffect(() => {
    const target = resolveHomeResume(content.units, resume)
    if (target) open(target)
    // Opens once on mount; later data must not restart the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sessionStartedAtMs = session?.startedAt.getTime()
  useEffect(() => {
    if (sessionStartedAtMs === undefined) return
    const updateNow = () => setNowMs(Date.now())
    updateNow()
    const intervalId = window.setInterval(updateNow, 1000)
    return () => window.clearInterval(intervalId)
  }, [sessionStartedAtMs])

  const handleKeyPress = useCallback(
    (code: string, shiftKey: boolean) => {
      const current = useHomePlayerStore.getState()
      const currentSession = current.session?.currentSession
      recordAttempt(
        currentSession?.expectedKeys[currentSession.keyIndex],
        code,
        shiftKey,
      )
      const { result, finished } = pressKey(code, shiftKey)
      if (!result || !current.lesson) return
      const played = current.lesson
      services.recordExercise({ lesson: played, result })
      setLocalDone((previous) => {
        const next = new Map(previous)
        next.set(
          played.id,
          new Set([...(previous.get(played.id) ?? []), result.exerciseId]),
        )
        return next
      })
      if (!finished) return
      const finishedSession = useHomePlayerStore.getState().session
      if (current.isReplay && finishedSession)
        services.recordReplay({
          lessonId: played.id,
          totals: homeReplayTotals(finishedSession),
        })
      // After the last lesson, Home loops back to the first one.
      const next = nextHomeLesson(content.units, played.id)
      const target = next ?? resolveHomeResume(content.units, null)
      if (!target) return
      open(target)
      const title = lessonById(target.lessonId)?.title ?? ''
      showSuccess(
        next
          ? `Lesson complete · Next: ${title}`
          : `Home course complete · Starting again: ${title}`,
      )
    },
    [content, lessonById, open, pressKey, recordAttempt, services, showSuccess],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (!isKoreanJamoKey(event.code)) {
        if (event.code === 'Space') event.preventDefault()
        return
      }
      event.preventDefault()
      handleKeyPress(event.code, event.shiftKey)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKeyPress])

  const visibleUnitId = selectedUnitId ?? unitId ?? content.units[0]?.id
  const visibleUnit =
    content.units.find(({ id }) => id === visibleUnitId) ?? content.units[0]
  const active = session ? exercises[session.currentIndex] : undefined
  const nextKey =
    session?.currentSession.expectedKeys[session.currentSession.keyIndex]
  const acceptedKeystrokes = session
    ? session.completedResults.reduce(
        (total, entry) => total + entry.correctKeyCount,
        0,
      ) + session.currentSession.keyIndex
    : 0
  const rejectedKeystrokes = session
    ? session.completedResults.reduce(
        (total, entry) => total + entry.mistakes.length,
        0,
      ) + session.currentSession.mistakes.length
    : 0
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
  const meaning = active
    ? [active.meaningTh, active.meaningEn].filter(Boolean).join(' : ')
    : ''

  return (
    <section
      className="mt-5 rounded-4xl border border-[#d9d1ed] bg-[#fffdf9] p-5 shadow-[0_20px_55px_-35px_rgba(87,65,45,0.45)] sm:p-7 select-none!"
      aria-labelledby="home-player-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#7863a8]">
            TYPE, ONE STEP AT A TIME
          </p>
          <h2
            id="home-player-heading"
            className="mt-1 text-2xl font-bold tracking-tight text-[#253247]"
          >
            {content.course.title}
          </h2>
        </div>
      </div>

      {active && session && lesson ? (
        <div className="mt-1">
          <div className="mt-2 rounded-3xl bg-[#fffaf6] p-4 text-center shadow-[0_0_30px_-20px_rgba(87,65,45,0.35)]">
            <div className="flex h-5 justify-end gap-1.5">
              <span className="rounded-lg border border-[#eadfd4] bg-[#fffdf9] px-2 py-0.5 text-[10px] font-semibold text-[#98a2b3]">
                WPM <strong className="ml-0.5 text-[#667085]">{wpm}</strong>
              </span>
              <span className="rounded-lg border border-[#eadfd4] bg-[#fffdf9] px-2 py-0.5 text-[10px] font-semibold text-[#98a2b3]">
                ACC{' '}
                <strong className="ml-0.5 text-[#667085]">{accuracy}%</strong>
              </span>

              {session && lesson && (
                <span className="rounded-lg border border-[#eadfd4] bg-[#f2edf9] px-2 py-0.5 text-[10px] font-semibold text-[#7863a8]!">
                  {Math.min(session.currentIndex + 1, exercises.length)} /{' '}
                  {exercises.length}
                </span>
              )}
            </div>
            <HangulTarget
              session={session.currentSession}
              className="mt-3 origin-center scale-160 text-6xl font-bold tracking-wide sm:text-7xl"
            />
            <div className="mx-auto mt-10 max-w-44">
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
                {active.romanization || (
                  <span className="italic text-[#e4e2df]">No meaning</span>
                )}
              </div>
            </div>
          </div>
          <VirtualKeyboard
            nextKey={nextKey}
            feedback={feedback}
            previousFeedback={previousFeedback}
            showEnglishKeys
            opacity={1}
            onKeyPress={handleKeyPress}
          />
          <FingerPlacementGuide nextKey={nextKey} />
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-dashed border-[#dfcfc0] bg-white/60 p-6 text-center text-sm text-[#667085]">
          Pick a lesson above to start.
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <nav className="mt-5 flex flex-wrap gap-2" aria-label="Choose unit">
          {content.units.map((unit) => (
            <button
              key={unit.id}
              type="button"
              aria-pressed={unit.id === visibleUnit?.id}
              onClick={() => selectUnit(unit.id)}
              className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${unit.id === visibleUnit?.id ? 'border-[#9d8bc8] bg-[#e9e1f8] text-[#5c4b88]' : 'border-[#eadfd4] bg-white text-[#667085] hover:border-[#c8b9e7]'}`}
            >
              {unit.title}
            </button>
          ))}
        </nav>
      </div>

      {visibleUnit && (
        <nav
          className="mt-3 flex flex-wrap gap-2"
          aria-label={`Lessons in ${visibleUnit.title}`}
        >
          {visibleUnit.lessons.map((entry) => {
            const { done, total } = homeLessonProgress(
              entry,
              progressByLesson.get(entry.id) ?? null,
              localDone.get(entry.id),
            )
            const current = entry.id === lesson?.id
            return (
              <button
                key={entry.id}
                type="button"
                aria-current={current ? 'true' : undefined}
                onClick={() =>
                  open({ unitId: visibleUnit.id, lessonId: entry.id })
                }
                className={`flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-sm font-semibold transition ${current ? 'border-[#c84f82] bg-[#fdf0f5] text-[#a8396a]' : 'border-[#eadfd4] bg-white text-[#667085] hover:border-[#e3b3c7]'}`}
              >
                {entry.title}
                <span
                  className={`rounded-full px-1.5 text-[11px] ${done === total ? 'bg-[#fdf0f5] text-[#a8396a]' : 'bg-[#f2edf9] text-[#7863a8]'}`}
                >
                  {done}/{total}
                </span>
              </button>
            )
          })}
        </nav>
      )}
    </section>
  )
}
