import { useCallback, useState } from 'react'
import { Link, useFetcher, useLoaderData } from 'react-router'
import type { Course } from '../../domain/models/course'
import type { Unit } from '../../domain/models/unit'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import { AdminStatusActions } from './AdminStatusActions'
import { useAdminFeedback } from './useAdminFeedback'
import { useAdminMutationPending } from './useAdminMutationPending'
import { AdminTopBar } from './AdminTopBar'
import { statusKey, useAdminTranslation } from './i18n/admin-i18n'

export default function CourseEditorPage() {
  const { course, units } = useLoaderData() as { course: Course; units: Unit[] }
  const { t } = useAdminTranslation()
  const fetcher = useFetcher()
  const [editingDetails, setEditingDetails] = useState(false)
  const [orderedUnits, setOrderedUnits] = useState(units)
  const [draggedUnitId, setDraggedUnitId] = useState<string | null>(null)
  const [hasPendingUnitOrder, setHasPendingUnitOrder] = useState(false)
  const isPending = useAdminMutationPending()
  const handleSuccess = useCallback((data: { message?: string }) => {
    if (data.message === 'feedback.courseSaved') setEditingDetails(false)
    if (data.message === 'feedback.unitReordered') setHasPendingUnitOrder(false)
  }, [])
  useAdminFeedback(fetcher, handleSuccess)
  const submit = (data: Record<string, string>) => {
    if (!isPending) fetcher.submit(data, { method: 'post' })
  }
  const moveUnitTo = (targetIndex: number) => {
    if (!draggedUnitId) return
    setOrderedUnits((items) => {
      const currentIndex = items.findIndex((item) => item.id === draggedUnitId)
      if (currentIndex < 0 || currentIndex === targetIndex) return items
      const next = [...items]
      const [dragged] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, dragged)
      return next
    })
    setHasPendingUnitOrder(true)
  }
  return (
    <PageSurface className="px-6 lg:px-8" contentClassName="max-w-[1200px]">
      <AdminTopBar
        breadcrumb={[
          { label: t('breadcrumb.admin'), to: '/admin' },
          { label: course.title },
        ]}
      />
      <header className="mt-4 flex flex-wrap justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="truncate text-3xl font-bold">{course.title}</h1>
          <span className="shrink-0 rounded-full bg-[#f8e5df] px-3 py-1 text-xs font-bold uppercase text-[#8d4c43]">
            {t(statusKey(course.status))}
          </span>
        </div>
        <AdminStatusActions
          id={course.id}
          kind="course"
          status={course.status}
        />
      </header>
      <Card className="mt-6 max-w-[840px]">
        {editingDetails ? (
          <fetcher.Form method="post" className="grid gap-4">
            <input type="hidden" name="intent" value="save" />
            <input type="hidden" name="kind" value="course" />
            <input type="hidden" name="id" value={course.id} />
            <label className="grid gap-1 text-sm font-semibold">
              <span>
                {t('field.title')}{' '}
                <span aria-hidden="true" className="text-[#a85d4e]">
                  *
                </span>
              </span>
              <input
                name="title"
                defaultValue={course.title}
                required
                disabled={isPending}
                className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              <span>
                {t('field.description')}{' '}
                <span aria-hidden="true" className="text-[#a85d4e]">
                  *
                </span>
              </span>
              <textarea
                name="description"
                defaultValue={course.description}
                required
                disabled={isPending}
                className="min-h-24 rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isPending}>
                {isPending ? t('action.saving') : t('action.saveCourse')}
              </Button>
              <Button
                variant="secondary"
                disabled={isPending}
                onClick={() => setEditingDetails(false)}
              >
                {t('action.cancel')}
              </Button>
            </div>
          </fetcher.Form>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">{course.title}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#667085]">
                {course.description}
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => setEditingDetails(true)}
            >
              {t('action.editDetails')}
            </Button>
          </div>
        )}
      </Card>
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{t('course.unitsHeading')}</h2>
            <p className="text-sm text-[#667085]">{t('course.unitsHint')}</p>
          </div>
          <div className="flex gap-2">
            {hasPendingUnitOrder && (
              <>
                <Button
                  variant="secondary"
                  disabled={isPending}
                  onClick={() => {
                    setOrderedUnits(units)
                    setHasPendingUnitOrder(false)
                  }}
                >
                  {t('action.cancel')}
                </Button>
                <Button
                  disabled={isPending}
                  onClick={() => {
                    submit({
                      intent: 'save-unit-order',
                      order: JSON.stringify(
                        orderedUnits.map((item) => item.id),
                      ),
                    })
                  }}
                >
                  {isPending ? t('action.saving') : t('action.saveChanges')}
                </Button>
              </>
            )}
            <Button
              disabled={isPending}
              onClick={() => submit({ intent: 'create-unit' })}
            >
              {isPending ? t('action.saving') : t('action.createUnit')}
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {orderedUnits.map((unit, index) => (
            <div
              key={unit.id}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                moveUnitTo(index)
                setDraggedUnitId(null)
              }}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eadfd4] py-4 last:border-b-0"
            >
              <div>
                <p className="text-xs font-bold uppercase text-[#a85d4e]">
                  {t(statusKey(unit.status))}
                </p>
                <h3 className="font-bold">{unit.title}</h3>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  draggable
                  aria-label={t('action.dragHandle')}
                  disabled={isPending}
                  onDragStart={() => setDraggedUnitId(unit.id)}
                  onDragEnd={() => setDraggedUnitId(null)}
                  className="cursor-grab px-2 py-2 text-lg leading-none tracking-[-0.2em] text-[#a85d4e] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ⋮⋮
                </button>
                <Link
                  className="rounded-full border border-[#eadfd4] bg-white/90 px-3 py-2 text-sm font-semibold text-[#8d4c43] hover:border-[#d8b3a9] hover:bg-white"
                  to={`/admin/units/${unit.id}`}
                >
                  {t('action.edit')}
                </Link>
                <AdminStatusActions
                  id={unit.id}
                  kind="unit"
                  status={unit.status}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageSurface>
  )
}
