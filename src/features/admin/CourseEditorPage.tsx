import { useState } from 'react'
import { Link, useFetcher, useLoaderData } from 'react-router'
import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react'
import type { Course } from '../../domain/models/course'
import type { Unit } from '../../domain/models/unit'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import { AdminStatusActions } from './AdminStatusActions'
import { useAdminFeedback } from './useAdminFeedback'
import { AdminBreadcrumb } from './AdminBreadcrumb'

export default function CourseEditorPage() {
  const { course, units } = useLoaderData() as { course: Course; units: Unit[] }
  const fetcher = useFetcher()
  useAdminFeedback(fetcher)
  const [editingDetails, setEditingDetails] = useState(false)
  const submit = (data: Record<string, string>) =>
    fetcher.submit(data, { method: 'post' })
  return (
    <PageSurface contentClassName="max-w-3xl">
      <AdminBreadcrumb items={['Admin', course.title]} />
      <header className="mt-4 flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#a85d4e]">
            COURSE · {course.status ?? 'draft'}
          </p>
          <h1 className="mt-1 text-3xl font-bold">Course details</h1>
        </div>
        <AdminStatusActions
          id={course.id}
          kind="course"
          status={course.status}
        />
      </header>
      {editingDetails ? (
        <fetcher.Form method="post" className="mt-6">
          <input type="hidden" name="intent" value="save" />
          <input type="hidden" name="kind" value="course" />
          <input type="hidden" name="id" value={course.id} />
          <Card className="grid gap-4">
            <label className="grid gap-1 text-sm font-semibold">
              Title
              <input
                name="title"
                defaultValue={course.title}
                className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              Description
              <textarea
                name="description"
                defaultValue={course.description}
                className="min-h-24 rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit">Save Course</Button>
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
            <h2 className="text-xl font-bold">{course.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[#667085]">
              {course.description}
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
            <h2 className="text-xl font-bold">Units</h2>
            <p className="text-sm text-[#667085]">
              Order controls affect learner order when content is published.
            </p>
          </div>
          <Button onClick={() => submit({ intent: 'create-unit' })}>
            <Plus size={16} aria-hidden="true" /> Create Unit
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {units.map((unit, index) => (
            <Card
              key={unit.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="text-xs font-bold uppercase text-[#a85d4e]">
                  {unit.status ?? 'draft'}
                </p>
                <h3 className="font-bold">{unit.title}</h3>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  aria-label={`Move ${unit.title} up`}
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() =>
                    submit({ intent: 'move-up', kind: 'unit', id: unit.id })
                  }
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  aria-label={`Move ${unit.title} down`}
                  variant="ghost"
                  disabled={index === units.length - 1}
                  onClick={() =>
                    submit({ intent: 'move-down', kind: 'unit', id: unit.id })
                  }
                >
                  <ArrowDown size={16} />
                </Button>
                <Link
                  className="rounded-full px-3 py-2 text-sm font-semibold text-[#8d4c43] hover:bg-white"
                  to={`/admin/units/${unit.id}`}
                >
                  Edit
                </Link>
                <AdminStatusActions
                  id={unit.id}
                  kind="unit"
                  status={unit.status}
                />
              </div>
            </Card>
          ))}
        </div>
      </section>
    </PageSurface>
  )
}
