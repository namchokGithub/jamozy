import { useState } from 'react'
import { useLoaderData, useNavigate } from 'react-router'
import type { LessonDetailLoaderData } from './LessonDetailPage.loader'
import LessonTypingSession, {
  type LessonCompletion,
} from './LessonTypingSession'
import LessonResult from './LessonResult'
import { formatExerciseMeaning } from './format-exercise-meaning'
import { Button } from '../../components/ui/Button'
import { PageHeading } from '../../components/ui/PageHeading'
import { PageNav } from '../../components/ui/PageNav'
import { PageSurface } from '../../components/ui/PageSurface'
import type { LessonType } from '../../domain/models/lesson'
import {
  clearLessonResume,
  getLessonResume,
  saveLessonResume,
} from './lesson-resume'

const lessonTypeLabels: Record<LessonType, string> = {
  character: 'Characters',
  syllable: 'Syllables',
  word: 'Words',
  phrase: 'Phrases',
  sentence: 'Sentences',
}

function navigationType(): string {
  const entry = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined
  return entry?.type ?? 'navigate'
}

export default function LessonDetailPage() {
  const { lesson, settings, courseId } =
    useLoaderData() as LessonDetailLoaderData

  return (
    <LessonDetailContent
      key={lesson.id}
      lesson={lesson}
      settings={settings}
      courseId={courseId}
    />
  )
}

function LessonDetailContent({
  lesson,
  settings,
  courseId,
}: LessonDetailLoaderData) {
  const navigate = useNavigate()
  const [started, setStarted] = useState(() => {
    const nowMs = Date.now()
    const resume = getLessonResume(
      window.sessionStorage,
      lesson.id,
      navigationType(),
      nowMs,
    )
    if (!resume) return false
    saveLessonResume(window.sessionStorage, lesson.id, nowMs)
    return true
  })
  const [completion, setCompletion] = useState<LessonCompletion | null>(null)

  const startLesson = () => {
    saveLessonResume(window.sessionStorage, lesson.id, Date.now())
    setCompletion(null)
    setStarted(true)
  }

  const exitLesson = () => {
    clearLessonResume(window.sessionStorage)
    setStarted(false)
  }

  const completeLesson = (value: LessonCompletion) => {
    clearLessonResume(window.sessionStorage)
    setCompletion(value)
  }

  const nav = <PageNav backTo={`/courses/${courseId}`} backLabel="Course map" />

  if (completion) {
    return (
      <PageSurface contentClassName="max-w-5xl">
        {nav}
        <LessonResult
          completion={completion}
          onRetry={() => {
            startLesson()
          }}
          onReview={() => navigate('/review')}
          onContinue={() =>
            navigate(
              completion.outcome.unlockedNextLessonId
                ? `/lessons/${completion.outcome.unlockedNextLessonId}`
                : `/courses/${courseId}`,
            )
          }
        />
      </PageSurface>
    )
  }

  if (started) {
    return (
      <PageSurface contentClassName="max-w-5xl">
        {nav}
        <PageHeading eyebrow="TYPING NOW" title={lesson.title} />
        <LessonTypingSession
          lesson={lesson}
          onComplete={completeLesson}
          keyboardSettings={settings}
          onExit={exitLesson}
        />
      </PageSurface>
    )
  }

  return (
    <PageSurface contentClassName="max-w-5xl">
      {nav}
      <PageHeading eyebrow="LESSON" title={lesson.title}>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="rounded-full bg-lavender-100 px-3 py-1 text-xs font-semibold text-lavender-600">
            {lessonTypeLabels[lesson.type]}
          </span>
          {lesson.exercises.length}{' '}
          {lesson.exercises.length === 1 ? 'exercise' : 'exercises'}
        </p>
      </PageHeading>

      {lesson.exercises.length === 0 ? (
        <p className="mt-6 text-sm text-subtle">No exercises yet.</p>
      ) : (
        <>
          <ul className="mt-6 space-y-4">
            {lesson.exercises.map((exercise) => {
              const meaning = formatExerciseMeaning(
                exercise,
                settings.meaningLanguage,
              )
              return (
                <li
                  key={exercise.id}
                  className="rounded-3xl border border-line bg-card/85 p-5 shadow-sm"
                >
                  <div className="text-xl text-ink">{exercise.targetText}</div>
                  {settings.romanizationEnabled && exercise.romanization && (
                    <div className="text-sm text-subtle">
                      {exercise.romanization}
                    </div>
                  )}
                  {(meaning && (
                    <div className="mt-2 text-sm text-ink-soft">{meaning}</div>
                  )) || (
                    <div className="mt-2 text-sm italic text-subtle">
                      No meaning yet
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <Button type="button" onClick={startLesson} className="mt-6">
            Start Lesson
          </Button>
        </>
      )}
    </PageSurface>
  )
}
