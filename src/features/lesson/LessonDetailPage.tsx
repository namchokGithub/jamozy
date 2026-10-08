import { useState } from 'react'
import { useLoaderData, useNavigate } from 'react-router'
import type { LessonDetailLoaderData } from './LessonDetailPage.loader'
import LessonTypingSession, {
  type LessonCompletion,
} from './LessonTypingSession'
import LessonResult from './LessonResult'
import { formatExerciseMeaning } from './format-exercise-meaning'
import { Button } from '../../components/ui/Button'
import { PageSurface } from '../../components/ui/PageSurface'

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

  if (completion) {
    return (
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
    )
  }

  if (started) {
    return (
      <PageSurface contentClassName="max-w-2xl">
        <h1 className="text-2xl font-medium text-slate-900">{lesson.title}</h1>
        <LessonTypingSession
          lesson={lesson}
          onComplete={setCompletion}
          keyboardSettings={settings}
        />
      </PageSurface>
    )
  }

  return (
    <PageSurface contentClassName="max-w-2xl">
      <h1 className="text-2xl font-medium text-slate-900">{lesson.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{lesson.type}</p>

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
                    <span className="italic text-[#e4e2df]">No meaning</span>
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
