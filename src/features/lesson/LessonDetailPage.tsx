import { useState } from 'react'
import { useLoaderData } from 'react-router'
import type { LessonDetailLoaderData } from './LessonDetailPage.loader'
import LessonTypingSession from './LessonTypingSession'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'

export default function LessonDetailPage() {
  const { lesson } = useLoaderData() as LessonDetailLoaderData
  const [started, setStarted] = useState(false)
  const [outcome, setOutcome] = useState<CompleteLessonOutcome | null>(null)

  if (outcome) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-medium text-slate-900">Lesson complete!</h1>
        <p className="mt-2 text-slate-700">
          +{outcome.expGained} EXP — now level {outcome.level}
        </p>
        {outcome.unlockedNextLessonId && (
          <p className="mt-1 text-sm text-slate-600">Next lesson unlocked.</p>
        )}
      </main>
    )
  }

  if (started) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-medium text-slate-900">{lesson.title}</h1>
        <LessonTypingSession lesson={lesson} onComplete={setOutcome} />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">{lesson.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{lesson.type}</p>

      {lesson.exercises.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No exercises yet.</p>
      ) : (
        <>
          <ul className="mt-6 space-y-4">
            {lesson.exercises.map((exercise) => (
              <li key={exercise.id} className="rounded-lg border border-slate-200 p-4">
                <div className="text-xl text-slate-900">{exercise.targetText}</div>
                {exercise.romanization && (
                  <div className="text-sm text-slate-500">{exercise.romanization}</div>
                )}
                <div className="mt-2 text-sm text-slate-700">
                  {exercise.meaningTh} / {exercise.meaningEn}
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-white"
          >
            Start Lesson
          </button>
        </>
      )}
    </main>
  )
}
