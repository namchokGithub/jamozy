import { useState } from 'react'
import { Link, useFetcher, useLoaderData } from 'react-router'
import type { Course } from '../../domain/models/course'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import { Dropdown } from '../../components/ui/Dropdown'
import { AdminStatusActions } from './AdminStatusActions'
import { useAdminFeedback } from './useAdminFeedback'
import { AdminTopBar } from './AdminTopBar'
import { statusKey, useAdminTranslation } from './i18n/admin-i18n'

export default function AdminDashboardPage() {
  const { courses } = useLoaderData() as { courses: Course[] }
  const { t } = useAdminTranslation()
  const create = useFetcher()
  useAdminFeedback(create)
  const [statusFilter, setStatusFilter] = useState('all')
  const visibleCourses = courses.filter(
    (course) => statusFilter === 'all' || course.status === statusFilter,
  )
  return (
    <PageSurface contentClassName="max-w-4xl">
      <AdminTopBar />
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
          onClick={() =>
            create.submit({ intent: 'create-course' }, { method: 'post' })
          }
        >
          {t('action.createCourse')}
        </Button>
      </header>
      <div className="mt-6 max-w-48">
        <Dropdown
          label={t('dashboard.statusFilter')}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: t('dashboard.allStatuses') },
            { value: 'draft', label: t('status.draft') },
            { value: 'published', label: t('status.published') },
            { value: 'archived', label: t('status.archived') },
          ]}
        />
      </div>
      <div className="mt-4 grid gap-3">
        {visibleCourses.map((course) => (
          <Card
            key={course.id}
            className="flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <p className="text-xs font-bold uppercase text-[#a85d4e]">
                {t(statusKey(course.status))}
              </p>
              <h2 className="mt-1 text-lg font-bold">{course.title}</h2>
              <p className="mt-1 text-sm text-[#667085]">
                {course.description}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                className="rounded-full px-4 py-2 text-sm font-semibold text-[#8d4c43] hover:bg-white"
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
