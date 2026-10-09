import { useState } from 'react'
import { Check, ChevronDown, LockKeyhole, Sparkles } from 'lucide-react'
import { Link, useLoaderData } from 'react-router'
import type { CourseMapLoaderData } from './CourseMapPage.loader'
import type { CourseMapUnit } from '../../application/get-course'
import type { LessonProgressStatus } from '../../domain/models/progress'
import { Card } from '../../components/ui/Card'
import { PageHeading } from '../../components/ui/PageHeading'
import { PageNav } from '../../components/ui/PageNav'
import { PageSurface } from '../../components/ui/PageSurface'

function statusLabel(status: LessonProgressStatus | undefined): string {
  return status === 'completed'
    ? 'Completed'
    : status === 'unlocked'
      ? 'Unlocked'
      : 'Locked'
}
function StatusPill({ status }: { status: LessonProgressStatus | undefined }) {
  const label = statusLabel(status)
  const classes =
    label === 'Completed'
      ? 'bg-[#e7f1d8] text-[#58733f]'
      : label === 'Unlocked'
        ? 'bg-[#fff0d8] text-[#8b6035]'
        : 'bg-[#eeeaf5] text-[#7863a8]'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}
    >
      {label === 'Completed' ? (
        <Check aria-hidden="true" size={13} />
      ) : label === 'Locked' ? (
        <LockKeyhole aria-hidden="true" size={13} />
      ) : (
        <Sparkles aria-hidden="true" size={13} />
      )}
      {label}
    </span>
  )
}
// The unit the learner is on: the first with an unlocked lesson, else the
// first with any lesson not yet completed.
function currentUnitId(units: CourseMapUnit[]): string | undefined {
  const current =
    units.find(({ lessons }) =>
      lessons.some(({ progress }) => progress?.status === 'unlocked'),
    ) ??
    units.find(({ lessons }) =>
      lessons.some(({ progress }) => progress?.status !== 'completed'),
    )
  return current?.unit.id
}
function UnitSection({
  mapUnit,
  defaultOpen,
}: {
  mapUnit: CourseMapUnit
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <li>
      <Card className="p-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-4 p-5 text-left"
        >
          <div>
            <p className="font-bold">{mapUnit.unit.title}</p>
            <p className="mt-1 text-sm text-[#667085]">
              {mapUnit.unit.description}
            </p>
          </div>
          <ChevronDown
            aria-hidden="true"
            className={`shrink-0 text-[#a85d4e] ${open ? 'rotate-180' : ''}`}
            size={20}
          />
        </button>
        {open && (
          <div className="border-t border-[#f0dfd1] p-4">
            {mapUnit.lessons.length === 0 ? (
              <p className="text-sm text-[#667085]">No lessons yet.</p>
            ) : (
              <ul className="space-y-2">
                {mapUnit.lessons.map(({ lesson, progress }) => (
                  <li key={lesson.id}>
                    <Link
                      to={`/lessons/${lesson.id}`}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-[#fffaf5] px-4 py-3 transition hover:bg-[#fff1e8]"
                    >
                      <span className="font-semibold text-[#39465b]">
                        {lesson.title}
                      </span>
                      <StatusPill status={progress?.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </li>
  )
}
export default function CourseMapPage() {
  const { courseMap } = useLoaderData() as CourseMapLoaderData
  const openUnitId = currentUnitId(courseMap.units)
  return (
    <PageSurface contentClassName="max-w-3xl">
      <PageNav backTo="/" backLabel="Home" />
      <PageHeading eyebrow="YOUR LEARNING PATH" title={courseMap.course.title}>
        <p className="mt-2 text-[#667085]">{courseMap.course.description}</p>
      </PageHeading>
      {courseMap.units.length === 0 ? (
        <Card className="mt-6 text-center">
          <p className="font-bold">Your next unit will bloom here.</p>
          <p className="mt-1 text-sm text-[#667085]">No units yet.</p>
        </Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {courseMap.units.map((unit) => (
            <UnitSection
              key={unit.unit.id}
              mapUnit={unit}
              defaultOpen={unit.unit.id === openUnitId}
            />
          ))}
        </ul>
      )}
    </PageSurface>
  )
}
