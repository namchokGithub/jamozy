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
  const isPending = useAdminMutationPending()
  const handleSuccess = useCallback((data: { message?: string }) => {
    if (data.message === 'feedback.courseSaved') setEditingDetails(false)
  }, [])
  useAdminFeedback(fetcher, handleSuccess)
  const submit = (data: Record<string, string>) => {
    if (!isPending) fetcher.submit(data, { method: 'post' })
  }
  return (
    <PageSurface contentClassName="max-w-3xl">
      <AdminTopBar
        breadcrumb={[
          { label: t('breadcrumb.admin'), to: '/admin' },
          { label: course.title },
        ]}
      />
      <header className="mt-4 flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase text-[#a85d4e]">
            {t('kind.course')} · {t(statusKey(course.status))}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{t('course.title')}</h1>
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
              {t('field.title')}{' '}
              <span aria-hidden="true" className="text-[#a85d4e]">
                *
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
              {t('field.description')}{' '}
              <span aria-hidden="true" className="text-[#a85d4e]">
                *
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
          <Button
            variant="secondary"
            disabled={isPending}
            onClick={() => setEditingDetails(true)}
          >
            {t('action.editDetails')}
          </Button>
        </Card>
      )}
      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{t('course.unitsHeading')}</h2>
            <p className="text-sm text-[#667085]">{t('course.unitsHint')}</p>
          </div>
          <Button
            disabled={isPending}
            onClick={() => submit({ intent: 'create-unit' })}
          >
            {isPending ? t('action.saving') : t('action.createUnit')}
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
                  {t(statusKey(unit.status))}
                </p>
                <h3 className="font-bold">{unit.title}</h3>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  aria-label={t('action.moveItemUp', { name: unit.title })}
                  variant="ghost"
                  disabled={isPending || index === 0}
                  onClick={() =>
                    submit({ intent: 'move-up', kind: 'unit', id: unit.id })
                  }
                >
                  {t('action.moveUp')}
                </Button>
                <Button
                  aria-label={t('action.moveItemDown', { name: unit.title })}
                  variant="ghost"
                  disabled={isPending || index === units.length - 1}
                  onClick={() =>
                    submit({ intent: 'move-down', kind: 'unit', id: unit.id })
                  }
                >
                  {t('action.moveDown')}
                </Button>
                <Link
                  className="rounded-full px-3 py-2 text-sm font-semibold text-[#8d4c43] hover:bg-white"
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
            </Card>
          ))}
        </div>
      </section>
    </PageSurface>
  )
}
