import { useState } from 'react'
import { Link, useFetcher, useLoaderData, useNavigate } from 'react-router'
import { courseCounts, type Course } from '../../domain/models/course'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import { AdminContentListToolbar } from './AdminContentListToolbar'
import {
  AdminStatusActions,
  AdminStatusActionsPreview,
} from './AdminStatusActions'
import { AdminStatusBadge } from './AdminStatusBadge'
import { useAdminFeedback } from './useAdminFeedback'
import { useAdminMutationPending } from './useAdminMutationPending'
import { AdminTopBar } from './AdminTopBar'
import { useAdminTranslation } from './i18n/admin-i18n'
import { AdminSortableList } from './AdminSortableList'
import { AdminCreateButton } from './AdminCreateButton'
import { AdminRenameField } from './AdminRenameField'
import { withPendingOrder } from './pending-order'

export default function AdminDashboardPage() {
  const { courses } = useLoaderData() as { courses: Course[] }
  const { locale, t } = useAdminTranslation()
  const create = useFetcher()
  const navigate = useNavigate()
  useAdminFeedback(create)
  const isCreating = useAdminMutationPending()
  const [statusFilter, setStatusFilter] = useState('all')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const orderedCourses = withPendingOrder(
    courses,
    create.formData,
    'save-course-order',
  )
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const totals = courses.reduce(
    (sum, course) => {
      const counts = courseCounts(course)
      return {
        units: sum.units + counts.units,
        lessons: sum.lessons + counts.lessons,
        exercises: sum.exercises + counts.exercises,
      }
    },
    { units: 0, lessons: 0, exercises: 0 },
  )
  const statusCounts = orderedCourses.reduce(
    (counts, course) => {
      if (course.status === 'draft') counts.draft += 1
      if (course.status === 'published') counts.published += 1
      if (course.status === 'archived') counts.archived += 1
      return counts
    },
    { draft: 0, published: 0, archived: 0 },
  )
  const visibleCourses = orderedCourses.filter(
    (course) =>
      (statusFilter === 'all' || course.status === statusFilter) &&
      (!normalizedSearch ||
        `${course.title} ${course.description}`
          .toLocaleLowerCase()
          .includes(normalizedSearch)),
  )
  const formatUpdatedAt = (date: Date) =>
    new Intl.DateTimeFormat(locale === 'th' ? 'th-TH' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  const moveCourse = (activeId: string, targetId: string) => {
    const currentIndex = orderedCourses.findIndex(
      (course) => course.id === activeId,
    )
    const targetIndex = orderedCourses.findIndex(
      (course) => course.id === targetId,
    )
    if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex)
      return
    const next = [...orderedCourses]
    const [dragged] = next.splice(currentIndex, 1)
    next.splice(targetIndex, 0, dragged)
    create.submit(
      {
        intent: 'save-course-order',
        order: JSON.stringify(next.map((course) => course.id)),
      },
      { method: 'post' },
    )
  }
  return (
    <PageSurface className="px-6 lg:px-8" contentClassName="max-w-[1200px]">
      <AdminTopBar breadcrumb={[{ label: t('breadcrumb.admin') }]} />
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-[#a85d4e]">
            {t('dashboard.eyebrow')}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{t('dashboard.title')}</h1>
          <p className="mt-2 text-sm text-[#667085]">
            {t('dashboard.subtitle')}
          </p>
        </div>
        <AdminCreateButton kind="course" />
      </header>
      <AdminContentListToolbar
        totalLabel={t('dashboard.totalCourses')}
        total={orderedCourses.length}
        descendants={[
          { label: t('count.units'), value: totals.units },
          { label: t('count.lessons'), value: totals.lessons },
          { label: t('count.exercises'), value: totals.exercises },
        ]}
        counts={statusCounts}
        search={search}
        onSearch={setSearch}
        status={statusFilter}
        onStatusChange={setStatusFilter}
      />
      <AdminSortableList
        className="mt-4 grid gap-3"
        items={visibleCourses}
        getId={(course) => course.id}
        disabled={isCreating || renamingId !== null}
        onMove={moveCourse}
        renderItem={(course, { handleRef, isDragging, ref }) => (
          <div ref={ref} className={isDragging ? 'opacity-50' : undefined}>
            <Card
              role="link"
              tabIndex={0}
              onClick={() =>
                renamingId !== course.id &&
                navigate(`/admin/courses/${course.id}`)
              }
              onKeyDown={(event) => {
                if (
                  event.target !== event.currentTarget ||
                  renamingId === course.id
                )
                  return
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(`/admin/courses/${course.id}`)
                }
              }}
              className="flex min-h-22 w-full cursor-pointer flex-wrap items-center justify-between gap-4 px-5 py-5 focus-visible:ring-2 focus-visible:ring-[#f2c5bb]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <button
                  ref={handleRef}
                  type="button"
                  aria-label={t('action.dragHandle')}
                  disabled={isCreating}
                  onClick={(event) => event.stopPropagation()}
                  className="shrink-0 cursor-grab px-1 py-2 text-lg leading-none tracking-[-0.2em] text-[#a85d4e] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ⋮⋮
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {renamingId === course.id ? (
                      <AdminRenameField
                        id={course.id}
                        kind="course"
                        title={course.title}
                        onDone={() => setRenamingId(null)}
                      />
                    ) : (
                      <h2 className="truncate text-lg font-bold">
                        {course.title}
                      </h2>
                    )}
                    <AdminStatusBadge status={course.status} />
                  </div>
                  <p className="mt-1 text-sm text-[#667085]">
                    {course.description}
                  </p>
                  <p className="mt-2 text-xs text-[#8b7d72]">
                    {t('dashboard.lastUpdated', {
                      date: formatUpdatedAt(course.updatedAt),
                    })}
                  </p>
                </div>
              </div>
              <div
                className="flex gap-2"
                onClick={(event) => event.stopPropagation()}
              >
                <Button
                  variant="secondary"
                  disabled={isCreating}
                  onClick={() => setRenamingId(course.id)}
                >
                  {t('action.edit')}
                </Button>
                <AdminStatusActions
                  id={course.id}
                  kind="course"
                  status={course.status}
                />
              </div>
            </Card>
          </div>
        )}
        renderOverlay={(course) => (
          <Card className="flex min-h-22 w-full flex-wrap items-center justify-between gap-4 px-5 py-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="shrink-0 px-1 py-2 text-lg leading-none tracking-[-0.2em] text-[#a85d4e]">
                ⋮⋮
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="truncate text-lg font-bold">{course.title}</h2>
                  <AdminStatusBadge status={course.status} />
                </div>
                <p className="mt-1 text-sm text-[#667085]">
                  {course.description}
                </p>
                <p className="mt-2 text-xs text-[#8b7d72]">
                  {t('dashboard.lastUpdated', {
                    date: formatUpdatedAt(course.updatedAt),
                  })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full border border-[#eadfd4] bg-white/90 px-4 py-2 text-sm font-semibold text-[#8d4c43]">
                {t('action.edit')}
              </span>
              <AdminStatusActionsPreview status={course.status} />
            </div>
          </Card>
        )}
      />
      {visibleCourses.length === 0 && (
        <Card className="mt-6 text-center text-sm text-[#667085]">
          {orderedCourses.length === 0
            ? t('dashboard.emptyNoCourses')
            : t('dashboard.emptyNoMatch')}
        </Card>
      )}
      <Link
        to="/"
        className="mt-6 inline-block text-sm font-semibold text-[#667085] hover:text-[#8d4c43]"
      >
        {t('dashboard.backToLearner')}
      </Link>
    </PageSurface>
  )
}
