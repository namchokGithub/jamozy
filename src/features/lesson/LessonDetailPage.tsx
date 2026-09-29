import { useState } from 'react'
import { useLoaderData, useNavigate } from 'react-router'
import type { LessonDetailLoaderData } from './LessonDetailPage.loader'
import LessonTypingSession, {
  type LessonCompletion,
} from './LessonTypingSession'
import { formatExerciseMeaning } from './format-exercise-meaning'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
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
    const { outcome, result } = completion
    const mistypedWords = [...new Set(result.mistakes.map((mistake) => mistake.targetText))]
    return (
      <PageSurface contentClassName="max-w-2xl">
        <h1 className="text-2xl font-medium text-slate-900">
          Lesson complete!
        </h1>
        <p className="mt-2 text-slate-700">
          +{outcome.expGained} EXP — now level {outcome.level}
        </p>
        <Card aria-label="Lesson results" className="mt-4" role="region">
          <ul className="space-y-1 text-sm text-slate-700">
            <li>Accuracy {Math.round(result.accuracy)}%</li>
            <li>Typing speed {Math.round(result.speedWpm)} WPM</li>
            <li>Time {Math.round(result.durationSeconds)}s</li>
            <li>Mistakes {result.rejectedKeystrokes}</li>
          </ul>
          {result.mistakes.length === 0 ? (
            <p className="mt-3 text-sm text-emerald-700">No mistakes — nice work!</p>
          ) : (
            <>
              <h2 className="mt-3 text-sm font-medium text-slate-900">Words to review</h2>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                {mistypedWords.map((targetText) => (
                  <li key={targetText}>{targetText}</li>
                ))}
              </ul>
            </>
          )}
        </Card>
        {outcome.unlockedNextLessonId && (
          <p className="mt-1 text-sm text-slate-600">Next lesson unlocked.</p>
        )}
        <Button
          type="button"
          onClick={() => {
            setCompletion(null)
            setStarted(true)
          }}
          className="mt-6"
          variant="secondary"
        >
          Retry
        </Button>
        <Button
          type="button"
          onClick={() => navigate('/review')}
          className="ml-3"
          variant="secondary"
        >
          Go to Review
        </Button>
        <Button
          type="button"
          onClick={() =>
            navigate(
              outcome.unlockedNextLessonId
                ? `/lessons/${outcome.unlockedNextLessonId}`
                : `/courses/${courseId}`,
            )
          }
          className="ml-3"
        >
          {outcome.unlockedNextLessonId ? 'Next Lesson' : 'Course Map'}
        </Button>
      </PageSurface>
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
                  {meaning && (
                    <div className="mt-2 text-sm text-slate-700">{meaning}</div>
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
