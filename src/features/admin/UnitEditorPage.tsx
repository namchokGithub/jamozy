import { useState } from 'react'
import { Link, useFetcher, useLoaderData } from 'react-router'
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react'
import type { Course } from '../../domain/models/course'
import type { Lesson } from '../../domain/models/lesson'
import type { Unit } from '../../domain/models/unit'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import { AdminStatusActions } from './AdminStatusActions'
import { useAdminFeedback } from './useAdminFeedback'
import { AdminBreadcrumb } from './AdminBreadcrumb'

export default function UnitEditorPage() {
  const { unit, course, lessons } = useLoaderData() as {
    unit: Unit
    course: Course | null
    lessons: Lesson[]
  }
  const fetcher = useFetcher()
  useAdminFeedback(fetcher)
  const [editingDetails, setEditingDetails] = useState(false)
  const submit = (data: Record<string, string>) =>
    fetcher.submit(data, { method: 'post' })
  return (
    <PageSurface contentClassName="max-w-3xl">
      <AdminBreadcrumb
        items={['Admin', course?.title ?? 'Course', unit.title]}
      />
      <header className="mt-4 flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#a85d4e]">
            UNIT · {unit.status ?? 'draft'}
          </p>
          <h1 className="mt-1 text-3xl font-bold">Unit details</h1>
        </div>
        <AdminStatusActions id={unit.id} kind="unit" status={unit.status} />
      </header>
      {editingDetails ? (
        <fetcher.Form method="post" className="mt-6">
          <input type="hidden" name="intent" value="save" />
          <input type="hidden" name="kind" value="unit" />
          <input type="hidden" name="id" value={unit.id} />
          <Card className="grid gap-4">
            <label className="grid gap-1 text-sm font-semibold">
              Title
              <input
                name="title"
                defaultValue={unit.title}
                className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Description
              <textarea
                name="description"
                defaultValue={unit.description}
                className="min-h-24 rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save Unit</Button>
              <Button
                variant="secondary"
                onClick={() => setEditingDetails(false)}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </fetcher.Form>
      ) : (
        <Card className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{unit.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#667085]">
              {unit.description}
            </p>
          </div>
          <Button variant="secondary" onClick={() => setEditingDetails(true)}>
            <Pencil size={16} aria-hidden="true" /> Edit details
          </Button>
        </Card>
      )}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Lessons</h2>
            <p className="text-sm text-[#667085]">
              Publish each Lesson independently after its parents.
            </p>
          </div>
          <Button onClick={() => submit({ intent: 'create-lesson' })}>
            <Plus size={16} aria-hidden="true" /> Create Lesson
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {lessons.map((lesson, index) => (
            <Card
              key={lesson.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="text-xs font-bold uppercase text-[#a85d4e]">
                  {lesson.status ?? 'draft'}
                </p>
                <h3 className="font-bold">{lesson.title}</h3>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  aria-label={`Move ${lesson.title} up`}
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() =>
                    submit({ intent: 'move-up', kind: 'lesson', id: lesson.id })
                  }
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  aria-label={`Move ${lesson.title} down`}
                  variant="ghost"
                  disabled={index === lessons.length - 1}
                  onClick={() =>
                    submit({
                      intent: 'move-down',
                      kind: 'lesson',
                      id: lesson.id,
                    })
                  }
                >
                  <ArrowDown size={16} />
                </Button>
                <Link
                  className="rounded-full px-3 py-2 text-sm font-semibold text-[#8d4c43] hover:bg-white"
                  to={`/admin/lessons/${lesson.id}`}
                >
                  Edit
                </Link>
                <AdminStatusActions
                  id={lesson.id}
                  kind="lesson"
                  status={lesson.status}
                />
              </div>
            </Card>
          ))}
        </div>
      </section>
    </PageSurface>
  )
}
