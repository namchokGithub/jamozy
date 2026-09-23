import { useState } from 'react'
import { Link, useLoaderData } from 'react-router'
import type { CourseMapLoaderData } from './CourseMapPage.loader'
import type { CourseMapUnit } from '../../application/get-course'
import type { LessonProgressStatus } from '../../domain/models/progress'

function statusLabel(status: LessonProgressStatus | undefined): string {
  if (status === 'completed') return 'Completed'
  if (status === 'unlocked') return 'Unlocked'
  return 'Locked'
}

function UnitSection({ mapUnit }: { mapUnit: CourseMapUnit }) {
  const [open, setOpen] = useState(false)

  return (
    <li className="rounded-lg border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <div className="font-medium text-slate-900">{mapUnit.unit.title}</div>
          <div className="text-sm text-slate-600">{mapUnit.unit.description}</div>
        </div>
        <span className="text-sm text-slate-500">
          {open ? 'Hide lessons' : 'Show lessons'}
        </span>
      </button>

      {open && (
        <ul className="space-y-2 border-t border-slate-100 p-4">
          {mapUnit.lessons.map(({ lesson, progress }) => (
            <li key={lesson.id}>
              <Link
                to={`/lessons/${lesson.id}`}
                className="flex items-center justify-between rounded-md p-2 hover:bg-slate-50"
              >
                <span>{lesson.title}</span>
                <span className="text-xs text-slate-500">
                  {statusLabel(progress?.status)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function CourseMapPage() {
  const { courseMap } = useLoaderData() as CourseMapLoaderData

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">{courseMap.course.title}</h1>
      <p className="mt-1 text-slate-600">{courseMap.course.description}</p>

      <ul className="mt-6 space-y-3">
        {courseMap.units.map((mapUnit) => (
          <UnitSection key={mapUnit.unit.id} mapUnit={mapUnit} />
        ))}
      </ul>
    </main>
  )
}
