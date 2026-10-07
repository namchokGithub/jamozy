import { useCallback, useState } from 'react'
import { Link, useFetcher, useLoaderData, useNavigate } from 'react-router'
import type { Course } from '../../domain/models/course'
import type { Lesson } from '../../domain/models/lesson'
import type { Unit } from '../../domain/models/unit'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import {
  AdminStatusActions,
  AdminStatusActionsPreview,
} from './AdminStatusActions'
import { AdminStatusBadge } from './AdminStatusBadge'
import { AdminHomeDeployNotice } from './AdminHomeDeployNotice'
import { AdminContentListToolbar } from './AdminContentListToolbar'
import { useAdminFeedback } from './useAdminFeedback'
import { useAdminMutationPending } from './useAdminMutationPending'
import { AdminUnsavedChangesDialog } from './AdminUnsavedChangesDialog'
import { useAdminUnsavedChanges } from './useAdminUnsavedChanges'
import { AdminTopBar } from './AdminTopBar'
import { useAdminTranslation } from './i18n/admin-i18n'
import { useCreatedHighlight } from './useCreatedHighlight'
import { AdminSortableList } from './AdminSortableList'
import { withPendingOrder } from './pending-order'

export default function UnitEditorPage() {
  const { unit, course, lessons } = useLoaderData() as {
    unit: Unit
    course: Course | null
    lessons: Lesson[]
  }
  const { t } = useAdminTranslation()
  const fetcher = useFetcher()
  const navigate = useNavigate()
  const createdHighlight = useCreatedHighlight()
  const [editingDetails, setEditingDetails] = useState(false)
  const [detailsDirty, setDetailsDirty] = useState(false)
  const orderedLessons = withPendingOrder(
    lessons,
    fetcher.formData,
    'save-lesson-order',
  )
  const [lessonSearch, setLessonSearch] = useState('')
  const [lessonStatusFilter, setLessonStatusFilter] = useState('all')
  const isPending = useAdminMutationPending()
  const unsavedChangesBlocker = useAdminUnsavedChanges(
    detailsDirty,
    t('feedback.unsavedChangesWarning'),
  )
  const handleSuccess = useCallback(
    (data: { message?: string; createdId?: string }) => {
      if (data.message === 'feedback.changesSaved') {
        setEditingDetails(false)
        setDetailsDirty(false)
      }
      if (data.createdId)
        navigate(`/admin/lessons/${data.createdId}`, {
          state: { created: true },
        })
    },
    [navigate],
  )
  useAdminFeedback(fetcher, handleSuccess)
  const submit = (data: Record<string, string>) => {
    if (!isPending) fetcher.submit(data, { method: 'post' })
  }
  const moveLesson = (activeId: string, targetId: string) => {
    const currentIndex = orderedLessons.findIndex(
      (item) => item.id === activeId,
    )
    const targetIndex = orderedLessons.findIndex((item) => item.id === targetId)
    if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex)
      return
    const next = [...orderedLessons]
    const [dragged] = next.splice(currentIndex, 1)
    next.splice(targetIndex, 0, dragged)
    submit({
      intent: 'save-lesson-order',
      order: JSON.stringify(next.map((item) => item.id)),
    })
  }
  const lessonStatusCounts = orderedLessons.reduce(
    (counts, item) => {
      if (item.status === 'draft') counts.draft += 1
      if (item.status === 'published') counts.published += 1
      if (item.status === 'archived') counts.archived += 1
      return counts
    },
    { draft: 0, published: 0, archived: 0 },
  )
  const visibleLessons = orderedLessons.filter(
    (item) =>
      (lessonStatusFilter === 'all' || item.status === lessonStatusFilter) &&
      item.title
        .toLocaleLowerCase()
        .includes(lessonSearch.trim().toLocaleLowerCase()),
  )
  return (
    <PageSurface className="px-6 lg:px-8" contentClassName="max-w-[1200px]">
      <AdminUnsavedChangesDialog blocker={unsavedChangesBlocker} />
      <AdminTopBar
        breadcrumb={[
          { label: t('breadcrumb.admin'), to: '/admin' },
          {
            label: course?.title ?? t('kind.course'),
            to: `/admin/courses/${unit.courseId}`,
          },
          { label: unit.title },
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
            {unit.title}
          </h1>
          <AdminStatusBadge status={unit.status} />
        </div>
        <div className="flex items-center gap-2">
          <AdminStatusActions
            id={unit.id}
            kind="unit"
            status={unit.status}
            hasUnsavedChanges={detailsDirty}
            parents={[
              course && {
                kind: 'course',
                title: course.title,
                status: course.status,
              },
            ]}
          />
        </div>
      </header>
      <AdminHomeDeployNotice course={course} />
      {detailsDirty && (
        <div className="mt-4 rounded-xl bg-[#fff1d8] px-4 py-3 text-sm font-semibold text-[#92703e]">
          {t('feedback.unsavedChanges')}
        </div>
      )}
      <Card className="mt-6 max-w-210">
        {editingDetails ? (
          <fetcher.Form method="post" className="grid gap-4">
            <input type="hidden" name="intent" value="save" />
            <input type="hidden" name="kind" value="unit" />
            <input type="hidden" name="id" value={unit.id} />
            <label className="grid gap-1 text-sm font-semibold">
              <span>
                {t('field.title')}{' '}
                <span aria-hidden="true" className="text-[#a85d4e]">
                  *
                </span>
              </span>
              <input
                name="title"
                defaultValue={unit.title}
                required
                disabled={isPending}
                onChange={() => setDetailsDirty(true)}
                className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold">
              <span>
                {t('field.description')}{' '}
                <span className="text-[#a85d4e]">*</span>
              </span>
              <textarea
                name="description"
                defaultValue={unit.description}
                required
                disabled={isPending}
                onChange={() => setDetailsDirty(true)}
                className="min-h-24 rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={isPending || !detailsDirty}>
                {isPending ? t('action.saving') : t('action.saveUnit')}
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
              {/* <h2 className="text-xl font-bold">{unit.title}</h2> */}
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#667085]">
                {unit.description}
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
            <h2 className="text-xl font-bold">{t('unit.lessonsHeading')}</h2>
            <p className="text-sm text-[#667085]">{t('unit.lessonsHint')}</p>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={isPending}
              onClick={() =>
                submit({
                  intent: 'create-lesson',
                  title: t('draft.lessonTitle'),
                })
              }
            >
              {isPending ? t('action.saving') : t('action.createLesson')}
            </Button>
          </div>
        </div>
        <AdminContentListToolbar
          totalLabel={t('unit.lessonsHeading')}
          total={orderedLessons.length}
          counts={lessonStatusCounts}
          search={lessonSearch}
          onSearch={setLessonSearch}
          status={lessonStatusFilter}
          onStatusChange={setLessonStatusFilter}
        />
        <AdminSortableList
          className="mt-4 space-y-3"
          items={visibleLessons}
          getId={(lesson) => lesson.id}
          disabled={isPending}
          onMove={moveLesson}
          renderItem={(lesson, { handleRef, isDragging, ref }) => (
            <div
              ref={ref}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/admin/lessons/${lesson.id}`)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(`/admin/lessons/${lesson.id}`)
                }
              }}
              className={`flex min-h-22 w-full cursor-pointer flex-wrap items-center justify-between gap-4 border-b border-[#eadfd4] py-5 last:border-b-0 focus-visible:ring-2 focus-visible:ring-[#f2c5bb] ${isDragging ? 'opacity-50' : ''}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <button
                  ref={handleRef}
                  type="button"
                  aria-label={t('action.dragHandle')}
                  disabled={isPending}
                  onClick={(event) => event.stopPropagation()}
                  className="shrink-0 cursor-grab px-1 py-2 text-lg leading-none tracking-[-0.2em] text-[#a85d4e] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ⋮⋮
                </button>
                <h3 className="truncate font-bold">{lesson.title}</h3>
                <AdminStatusBadge status={lesson.status} />
              </div>
              <div
                className="flex items-center gap-1"
                onClick={(event) => event.stopPropagation()}
              >
                <Link
                  className="rounded-full border border-[#eadfd4] bg-white/90 px-3 py-2 text-sm font-semibold text-[#8d4c43] hover:border-[#d8b3a9] hover:bg-white"
                  to={`/admin/lessons/${lesson.id}`}
                >
                  {t('action.edit')}
                </Link>
                <AdminStatusActions
                  id={lesson.id}
                  kind="lesson"
                  status={lesson.status}
                  parents={[
                    course && {
                      kind: 'course',
                      title: course.title,
                      status: course.status,
                    },
                    { kind: 'unit', title: unit.title, status: unit.status },
                  ]}
                />
              </div>
            </div>
          )}
          renderOverlay={(lesson) => (
            <div className="flex min-h-22 w-full flex-wrap items-center justify-between gap-4 border border-[#eadfd4] px-4 py-5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 px-1 py-2 text-lg leading-none tracking-[-0.2em] text-[#a85d4e]">
                  ⋮⋮
                </span>
                <h3 className="truncate font-bold">{lesson.title}</h3>
                <AdminStatusBadge status={lesson.status} />
              </div>
              <div className="flex items-center gap-1">
                <span className="rounded-full border border-[#eadfd4] bg-white/90 px-3 py-2 text-sm font-semibold text-[#8d4c43]">
                  {t('action.edit')}
                </span>
                <AdminStatusActionsPreview status={lesson.status} />
              </div>
            </div>
          )}
        />
      </section>
    </PageSurface>
  )
}
