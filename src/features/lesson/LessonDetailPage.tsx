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

const lessonTypeLabels: Record<LessonType, string> = {
  character: 'Characters',
  syllable: 'Syllables',
  word: 'Words',
  phrase: 'Phrases',
  sentence: 'Sentences',
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
  const [started, setStarted] = useState(false)
  const [completion, setCompletion] = useState<LessonCompletion | null>(null)

  const nav = <PageNav backTo={`/courses/${courseId}`} backLabel="Course map" />

  if (completion) {
    return (
      <PageSurface contentClassName="max-w-5xl">
        {nav}
        <LessonResult
          completion={completion}
          onRetry={() => {
            setCompletion(null)
            setStarted(true)
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
          onComplete={setCompletion}
          keyboardSettings={settings}
          onExit={() => setStarted(false)}
        />
      </PageSurface>
    )
  }

  return (
    <PageSurface contentClassName="max-w-5xl">
      {nav}
      <PageHeading eyebrow="LESSON" title={lesson.title}>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#667085]">
          <span className="rounded-full bg-[#f2edf9] px-3 py-1 text-xs font-semibold text-[#7863a8]">
            {lessonTypeLabels[lesson.type]}
          </span>
          {lesson.exercises.length}{' '}
          {lesson.exercises.length === 1 ? 'exercise' : 'exercises'}
        </p>
      </PageHeading>

      {lesson.exercises.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No exercises yet.</p>
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
                  className="rounded-3xl border border-[#eadfd4] bg-white/85 p-5 shadow-sm"
                >
                  <div className="text-xl text-slate-900">
                    {exercise.targetText}
                  </div>
                  {settings.romanizationEnabled && exercise.romanization && (
                    <div className="text-sm text-slate-500">
                      {exercise.romanization}
                    </div>
                  )}
                  {(meaning && (
                    <div className="mt-2 text-sm text-slate-700">{meaning}</div>
                  )) || (
                    <div className="mt-2 text-sm italic text-[#7c8795]">
                      No meaning yet
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <Button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-6"
          >
            Start Lesson
          </Button>
        </>
      )}
    </PageSurface>
  )
}
