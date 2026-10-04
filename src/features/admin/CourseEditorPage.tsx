import { useCallback, useState } from 'react'
import { Link, useFetcher, useLoaderData, useNavigate } from 'react-router'
import type { Course } from '../../domain/models/course'
import type { Unit } from '../../domain/models/unit'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import { AdminStatusActions } from './AdminStatusActions'
import { AdminStatusBadge } from './AdminStatusBadge'
import { AdminContentListToolbar } from './AdminContentListToolbar'
import { useAdminFeedback } from './useAdminFeedback'
import { useAdminMutationPending } from './useAdminMutationPending'
import { useAdminUnsavedChanges } from './useAdminUnsavedChanges'
import { AdminTopBar } from './AdminTopBar'
import { useAdminTranslation } from './i18n/admin-i18n'
import { useCreatedHighlight } from './useCreatedHighlight'

export default function CourseEditorPage() {
  const { course, units } = useLoaderData() as { course: Course; units: Unit[] }
  const { t } = useAdminTranslation()
  const fetcher = useFetcher()
  const navigate = useNavigate()
  const createdHighlight = useCreatedHighlight()
  const [editingDetails, setEditingDetails] = useState(false)
  const [detailsDirty, setDetailsDirty] = useState(false)
  const [orderedUnits, setOrderedUnits] = useState(units)
  const [unitSearch, setUnitSearch] = useState('')
  const [unitStatusFilter, setUnitStatusFilter] = useState('all')
  const [draggedUnitId, setDraggedUnitId] = useState<string | null>(null)
  const isPending = useAdminMutationPending()
  useAdminUnsavedChanges(detailsDirty, t('feedback.unsavedChangesWarning'))
  const handleSuccess = useCallback(
    (data: { message?: string; createdId?: string }) => {
      if (data.message === 'feedback.changesSaved') {
        setEditingDetails(false)
        setDetailsDirty(false)
      }
      if (data.createdId)
        navigate(`/admin/units/${data.createdId}`, { state: { created: true } })
    },
    [navigate],
  )
  useAdminFeedback(fetcher, handleSuccess)
  const submit = (data: Record<string, string>) => {
    if (!isPending) fetcher.submit(data, { method: 'post' })
  }
  const moveUnitTo = (targetIndex: number) => {
    if (!draggedUnitId) return
    const currentIndex = orderedUnits.findIndex(
      (item) => item.id === draggedUnitId,
    )
    if (currentIndex < 0 || currentIndex === targetIndex) return
    const next = [...orderedUnits]
    const [dragged] = next.splice(currentIndex, 1)
    next.splice(targetIndex, 0, dragged)
    setOrderedUnits(next)
    submit({
      intent: 'save-unit-order',
      order: JSON.stringify(next.map((item) => item.id)),
    })
  }
  const unitStatusCounts = orderedUnits.reduce(
    (counts, item) => {
      if (item.status === 'draft') counts.draft += 1
      if (item.status === 'published') counts.published += 1
      if (item.status === 'archived') counts.archived += 1
      return counts
    },
    { draft: 0, published: 0, archived: 0 },
  )
  const visibleUnits = orderedUnits.filter(
    (item) =>
      (unitStatusFilter === 'all' || item.status === unitStatusFilter) &&
      `${item.title} ${item.description}`
        .toLocaleLowerCase()
        .includes(unitSearch.trim().toLocaleLowerCase()),
  )
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
          <h1
            className={
              createdHighlight
                ? 'rounded-xl bg-[#f5faed] px-3 py-2 text-3xl font-bold'
                : 'truncate text-3xl font-bold'
            }
          >
            {course.title}
          </h1>
          <AdminStatusBadge status={course.status} />
        </div>
        <AdminStatusActions
          id={course.id}
          kind="course"
          status={course.status}
        />
      </header>
      {detailsDirty && (
        <div className="mt-4 rounded-xl bg-[#fff1d8] px-4 py-3 text-sm font-semibold text-[#92703e]">
          {t('feedback.unsavedChanges')}
        </div>
      )}
      <Card className="mt-6 max-w-210">
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
                onChange={() => setDetailsDirty(true)}
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
                onChange={() => setDetailsDirty(true)}
                className="min-h-24 rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isPending || !detailsDirty}>
                {isPending ? t('action.saving') : t('action.saveCourse')}
              </Button>
              <Button
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  setEditingDetails(false)
                  setDetailsDirty(false)
                }}
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
            <Button
              disabled={isPending}
              onClick={() => submit({ intent: 'create-unit' })}
            >
              {isPending ? t('action.saving') : t('action.createUnit')}
            </Button>
          </div>
        </div>
        <AdminContentListToolbar
          totalLabel={t('course.unitsHeading')}
          total={orderedUnits.length}
          counts={unitStatusCounts}
          search={unitSearch}
          onSearch={setUnitSearch}
          status={unitStatusFilter}
          onStatusChange={setUnitStatusFilter}
        />
        <div className="mt-4 space-y-3">
          {visibleUnits.map((unit) => {
            const index = orderedUnits.findIndex((item) => item.id === unit.id)
            return (
              <div
                key={unit.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(`/admin/units/${unit.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/admin/units/${unit.id}`)
                  }
                }}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  moveUnitTo(index)
                  setDraggedUnitId(null)
                }}
                className="flex min-h-22 w-full cursor-pointer flex-wrap items-center justify-between gap-4 border-b border-[#eadfd4] py-5 last:border-b-0 focus-visible:ring-2 focus-visible:ring-[#f2c5bb]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    draggable
                    aria-label={t('action.dragHandle')}
                    disabled={isPending}
                    onClick={(event) => event.stopPropagation()}
                    onDragStart={() => setDraggedUnitId(unit.id)}
                    onDragEnd={() => setDraggedUnitId(null)}
                    className="shrink-0 cursor-grab px-1 py-2 text-lg leading-none tracking-[-0.2em] text-[#a85d4e] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    ⋮⋮
                  </button>
                  <h3 className="truncate font-bold">{unit.title}</h3>
                  <AdminStatusBadge status={unit.status} />
                </div>
                <div
                  className="flex items-center gap-1"
                  onClick={(event) => event.stopPropagation()}
                >
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
            )
          })}
        </div>
      </section>
    </PageSurface>
  )
}
