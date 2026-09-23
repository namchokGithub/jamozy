import { useLoaderData } from 'react-router'
import type { LessonDetailLoaderData } from './LessonDetailPage.loader'

export default function LessonDetailPage() {
  const { lesson } = useLoaderData() as LessonDetailLoaderData

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">{lesson.title}</h1>
      <p className="mt-1 text-sm text-slate-600">{lesson.type}</p>

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
    </main>
  )
}
