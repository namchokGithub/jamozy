import { useState } from 'react'
import { Link, useFetcher, useLoaderData, useNavigate } from 'react-router'
import type { Course } from '../../domain/models/course'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import { AdminContentListToolbar } from './AdminContentListToolbar'
import { AdminStatusActions } from './AdminStatusActions'
import { AdminStatusBadge } from './AdminStatusBadge'
import { useAdminFeedback } from './useAdminFeedback'
import { useAdminMutationPending } from './useAdminMutationPending'
import { AdminTopBar } from './AdminTopBar'
import { useAdminTranslation } from './i18n/admin-i18n'

export default function AdminDashboardPage() {
  const { courses } = useLoaderData() as { courses: Course[] }
  const { locale, t } = useAdminTranslation()
  const create = useFetcher()
  const navigate = useNavigate()
  useAdminFeedback(create, (data) => {
    if (data.createdId)
      navigate(`/admin/courses/${data.createdId}`, { state: { created: true } })
  })
  const isCreating = useAdminMutationPending()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const normalizedSearch = search.trim().toLocaleLowerCase()
  const statusCounts = courses.reduce(
    (counts, course) => {
      if (course.status === 'draft') counts.draft += 1
      if (course.status === 'published') counts.published += 1
      if (course.status === 'archived') counts.archived += 1
      return counts
    },
    { draft: 0, published: 0, archived: 0 },
  )
  const visibleCourses = courses.filter(
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
        <Button
          disabled={isCreating}
          onClick={() =>
            !isCreating &&
            create.submit({ intent: 'create-course' }, { method: 'post' })
          }
        >
          {isCreating ? t('action.saving') : t('action.createCourse')}
        </Button>
      </header>
      <AdminContentListToolbar
        totalLabel={t('dashboard.totalCourses')}
        total={courses.length}
        counts={statusCounts}
        search={search}
        onSearch={setSearch}
        status={statusFilter}
        onStatusChange={setStatusFilter}
      />
      <div className="mt-4 grid gap-3">
        {visibleCourses.map((course) => (
          <Card
            key={course.id}
            role="link"
            tabIndex={0}
            onClick={() => navigate(`/admin/courses/${course.id}`)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                navigate(`/admin/courses/${course.id}`)
              }
            }}
            className="flex min-h-22 w-full cursor-pointer flex-wrap items-center justify-between gap-4 px-5 py-5 focus-visible:ring-2 focus-visible:ring-[#f2c5bb]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden="true"
                className="shrink-0 text-lg leading-none tracking-[-0.2em] text-[#c4a59a]"
              >
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
            <div
              className="flex gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <Link
                className="rounded-full border border-[#eadfd4] bg-white/90 px-4 py-2 text-sm font-semibold text-[#8d4c43] hover:border-[#d8b3a9] hover:bg-white"
                to={`/admin/courses/${course.id}`}
              >
                {t('action.edit')}
              </Link>
              <AdminStatusActions
                id={course.id}
                kind="course"
                status={course.status}
              />
            </div>
          </Card>
        ))}
      </div>
      {visibleCourses.length === 0 && (
        <Card className="mt-6 text-center text-sm text-[#667085]">
          {courses.length === 0
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
