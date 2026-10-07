import { useCallback, useState } from 'react'
import { useFetcher, useLoaderData } from 'react-router'
import type { Lesson, LessonExercise } from '../../domain/models/lesson'
import type { Unit } from '../../domain/models/unit'
import type { Course } from '../../domain/models/course'
import { makeExercise } from '../../application/admin-content'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dropdown } from '../../components/ui/Dropdown'
import { PageSurface } from '../../components/ui/PageSurface'
import { AdminStatusActions } from './AdminStatusActions'
import { AdminStatusBadge } from './AdminStatusBadge'
import { useAdminFeedback } from './useAdminFeedback'
import { useAdminMutationPending } from './useAdminMutationPending'
import { AdminUnsavedChangesDialog } from './AdminUnsavedChangesDialog'
import { useAdminUnsavedChanges } from './useAdminUnsavedChanges'
import { AdminTopBar } from './AdminTopBar'
import { useAdminTranslation } from './i18n/admin-i18n'
import { useCreatedHighlight } from './useCreatedHighlight'
import { AdminSortableList } from './AdminSortableList'

const lessonTypes: Lesson['type'][] = [
  'character',
  'syllable',
  'word',
  'phrase',
  'sentence',
]
const difficulties: LessonExercise['difficulty'][] = ['easy', 'medium', 'hard']

export default function LessonEditorPage() {
  const { lesson, unit, course } = useLoaderData() as {
    lesson: Lesson
    unit: Unit | null
    course: Course | null
  }
  const { t } = useAdminTranslation()
  const fetcher = useFetcher()
  const createdHighlight = useCreatedHighlight()
  const [title, setTitle] = useState(lesson.title)
  const [type, setType] = useState(lesson.type)
  const [exercises, setExercises] = useState(lesson.exercises)
  const [exerciseSearch, setExerciseSearch] = useState('')
  const [difficultyFilter, setDifficultyFilter] = useState('all')
  const [editingDetails, setEditingDetails] = useState(false)
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null,
  )
  const [hasPendingExerciseOrder, setHasPendingExerciseOrder] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [exerciseErrors, setExerciseErrors] = useState<Record<string, string>>(
    {},
  )
  const isPending = useAdminMutationPending()
  const hasUnsavedChanges =
    title !== lesson.title ||
    type !== lesson.type ||
    JSON.stringify(exercises) !== JSON.stringify(lesson.exercises)
  const unsavedChangesBlocker = useAdminUnsavedChanges(
    hasUnsavedChanges,
    t('feedback.unsavedChangesWarning'),
  )
  const handleSuccess = useCallback(
    (data: { message?: string }) => {
      if (data.message === 'feedback.changesSaved') {
        // Adopt the revalidated Lesson: the server trims and normalizes text,
        // so keeping the typed values would leave the editor marked dirty.
        setTitle(lesson.title)
        setType(lesson.type)
        setExercises(lesson.exercises)
        setEditingDetails(false)
        setEditingExerciseId(null)
        setHasPendingExerciseOrder(false)
      }
    },
    [lesson],
  )
  useAdminFeedback(fetcher, handleSuccess)
  const validate = () => {
    const firstInvalidExercise = exercises.find(
      (exercise) => !exercise.targetText.trim(),
    )
    const nextExerciseErrors = Object.fromEntries(
      exercises
        .filter((exercise) => !exercise.targetText.trim())
        .map((exercise) => [exercise.id, t('error.fieldRequired')]),
    )
    const nextTitleError = title.trim() ? null : t('error.fieldRequired')
    setTitleError(nextTitleError)
    setExerciseErrors(nextExerciseErrors)
    if (firstInvalidExercise) setEditingExerciseId(firstInvalidExercise.id)
    return !nextTitleError && Object.keys(nextExerciseErrors).length === 0
  }
  const submit = (intent: string) => {
    if (isPending || (intent === 'save' && !validate())) return
    fetcher.submit(
      {
        intent,
        kind: 'lesson',
        id: lesson.id,
        title,
        type,
        exercises: JSON.stringify(exercises),
      },
      { method: 'post' },
    )
  }
  const update = (index: number, field: keyof LessonExercise, value: string) =>
    setExercises((items) =>
      items.map((item, current) =>
        current === index
          ? {
              ...item,
              [field]:
                value ||
                (field === 'romanization' || field === 'hint' ? null : value),
            }
          : item,
      ),
    )
  const moveExercise = (activeId: string, targetId: string) => {
    setExercises((items) => {
      const currentIndex = items.findIndex(
        (exercise) => exercise.id === activeId,
      )
      const targetIndex = items.findIndex(
        (exercise) => exercise.id === targetId,
      )
      if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex)
        return items
      const next = [...items]
      const [dragged] = next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, dragged)
      setHasPendingExerciseOrder(true)
      return next
    })
  }
  const cancelExercise = (exerciseId: string) => {
    const original = lesson.exercises.find(
      (exercise) => exercise.id === exerciseId,
    )
    setExercises((items) =>
      original
        ? items.map((exercise) =>
            exercise.id === exerciseId ? original : exercise,
          )
        : items.filter((exercise) => exercise.id !== exerciseId),
    )
    setEditingExerciseId(null)
  }
  const difficultyCounts = exercises.reduce(
    (counts, exercise) => {
      counts[exercise.difficulty] += 1
      return counts
    },
    { easy: 0, medium: 0, hard: 0 },
  )
  const visibleExercises = exercises.filter(
    (exercise) =>
      (difficultyFilter === 'all' ||
        exercise.difficulty === difficultyFilter) &&
      `${exercise.targetText} ${exercise.romanization ?? ''} ${exercise.meaningTh} ${exercise.meaningEn}`
        .toLocaleLowerCase()
        .includes(exerciseSearch.trim().toLocaleLowerCase()),
  )
  return (
    <PageSurface className="px-6 lg:px-8" contentClassName="max-w-[1200px]">
      <AdminUnsavedChangesDialog blocker={unsavedChangesBlocker} />
      <AdminTopBar
        breadcrumb={[
          { label: t('breadcrumb.admin'), to: '/admin' },
          {
            label: course?.title ?? t('kind.course'),
            to: unit ? `/admin/courses/${unit.courseId}` : undefined,
          },
          {
            label: unit?.title ?? t('kind.unit'),
            to: unit ? `/admin/units/${unit.id}` : undefined,
          },
          { label: lesson.title },
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
            {title}
          </h1>
          <AdminStatusBadge status={lesson.status} />
        </div>
        <div className="flex items-center gap-2">
          <AdminStatusActions
            id={lesson.id}
            kind="lesson"
            status={lesson.status}
            hasUnsavedChanges={hasUnsavedChanges}
            parents={[
              course && {
                kind: 'course',
                title: course.title,
                status: course.status,
              },
              unit && { kind: 'unit', title: unit.title, status: unit.status },
            ]}
          />
        </div>
      </header>
      {hasUnsavedChanges && (
        <div className="mt-4 rounded-xl bg-[#fff1d8] px-4 py-3 text-sm font-semibold text-[#92703e]">
          {t('feedback.unsavedChanges')}
        </div>
      )}
      {editingDetails ? (
        <Card className="mt-6 max-w-210 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold">
            <span>
              {t('field.title')}{' '}
              <span aria-hidden="true" className="text-[#a85d4e]">
                *
              </span>
            </span>
            <input
              value={title}
              aria-invalid={Boolean(titleError)}
              aria-required="true"
              onChange={(event) => {
                setTitle(event.target.value)
                setTitleError(null)
              }}
              disabled={isPending}
              className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
            />
            {titleError && (
              <p className="text-sm font-normal text-[#a85d4e]">{titleError}</p>
            )}
          </label>
          <Dropdown
            label={t('field.lessonType')}
            value={type}
            onChange={setType}
            disabled={isPending}
            options={lessonTypes.map((value) => ({
              value,
              label: t(`lessonType.${value}`),
            }))}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={isPending || !hasUnsavedChanges}
              onClick={() => submit('save')}
            >
              {isPending ? t('action.saving') : t('action.saveLesson')}
            </Button>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => {
                setTitle(lesson.title)
                setType(lesson.type)
                setEditingDetails(false)
              }}
            >
              {t('action.cancel')}
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mt-6 max-w-210 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-2 text-sm text-[#667085]">
              {t('lesson.typeValue', { type: t(`lessonType.${type}`) })}
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
        <p className="text-sm font-semibold uppercase text-[#a85d4e]">
          {t('lesson.exercisesEyebrow')}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">
              {t('lesson.exercisesHeading')}
            </h2>
            <p className="text-sm text-[#667085]">
              {t('lesson.exercisesHint')}
            </p>
          </div>
          <Button
            disabled={isPending}
            onClick={() => {
              const exercise = makeExercise(crypto.randomUUID())
              setExercises((items) => [...items, exercise])
              setEditingExerciseId(exercise.id)
            }}
          >
            {t('action.addExercise')}
          </Button>
        </div>
        <section className="mt-4 rounded-2xl border border-[#eadfd4] bg-white/70 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: t('lesson.totalExercises'), value: exercises.length },
              { label: t('difficulty.easy'), value: difficultyCounts.easy },
              { label: t('difficulty.medium'), value: difficultyCounts.medium },
              { label: t('difficulty.hard'), value: difficultyCounts.hard },
            ].map((metric) => (
              <div
                key={metric.label}
                className="rounded-xl bg-[#fffaf5] px-3 py-2"
              >
                <p className="text-xs font-semibold uppercase text-[#8b7d72]">
                  {metric.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-[#3f3029]">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="grid gap-2 text-sm font-semibold text-[#39465b]">
              {t('dashboard.search')}
              <input
                className="block h-10.75 w-full rounded-2xl border border-[#eadfd4] bg-white/90 px-3 py-2.5 text-sm font-medium text-[#253247] shadow-sm outline-none placeholder:text-[#a99a90] hover:border-[#d8b3a9] focus:border-[#d8b3a9] focus:ring-2 focus:ring-[#f2c5bb]"
                value={exerciseSearch}
                onChange={(event) => setExerciseSearch(event.target.value)}
                placeholder={t('lesson.searchExercisesPlaceholder')}
              />
            </label>
            <Dropdown
              label={t('field.difficulty')}
              value={difficultyFilter}
              onChange={setDifficultyFilter}
              options={[
                { value: 'all', label: t('lesson.allDifficulties') },
                ...difficulties.map((value) => ({
                  value,
                  label: t(`difficulty.${value}`),
                })),
              ]}
            />
          </div>
        </section>
        {hasPendingExerciseOrder && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={isPending} onClick={() => submit('save')}>
              {isPending ? t('action.saving') : t('action.saveChanges')}
            </Button>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => {
                setExercises(lesson.exercises)
                setEditingExerciseId(null)
                setHasPendingExerciseOrder(false)
              }}
            >
              {t('action.cancel')}
            </Button>
          </div>
        )}
        <AdminSortableList
          className="mt-4 space-y-4"
          items={visibleExercises}
          getId={(exercise) => exercise.id}
          disabled={isPending}
          onMove={moveExercise}
          renderItem={(exercise, { handleRef, isDragging, ref }) => {
            const index = exercises.findIndex((item) => item.id === exercise.id)
            return (
              <div
                ref={ref}
                className={`grid min-h-22 w-full gap-3 border-b border-[#eadfd4] py-5 last:border-b-0 ${isDragging ? 'opacity-50' : ''}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <button
                      ref={handleRef}
                      type="button"
                      aria-label={t('action.dragHandle')}
                      disabled={isPending}
                      className="shrink-0 cursor-grab px-1 py-2 text-lg leading-none tracking-[-0.2em] text-[#a85d4e] active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      ⋮⋮
                    </button>
                    <p className="truncate text-sm font-bold">
                      {exercise.targetText ||
                        t('lesson.exerciseNumber', { number: index + 1 })}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => setEditingExerciseId(exercise.id)}
                    >
                      {t('action.editExercise')}
                    </Button>
                  </div>
                </div>
                {editingExerciseId === exercise.id ? (
                  <div className="grid gap-5">
                    <fieldset className="grid gap-3">
                      <legend className="text-sm font-bold text-[#39465b]">
                        {t('lesson.exerciseContent')}
                      </legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-semibold">
                          <span>
                            {t('field.targetText')}{' '}
                            <span aria-hidden="true" className="text-[#a85d4e]">
                              *
                            </span>
                          </span>
                          <input
                            value={exercise.targetText}
                            aria-invalid={Boolean(exerciseErrors[exercise.id])}
                            aria-required="true"
                            onChange={(event) => {
                              update(index, 'targetText', event.target.value)
                              setExerciseErrors((errors) => {
                                const next = { ...errors }
                                delete next[exercise.id]
                                return next
                              })
                            }}
                            disabled={isPending}
                            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                          />
                          {exerciseErrors[exercise.id] && (
                            <p className="text-sm font-normal text-[#a85d4e]">
                              {exerciseErrors[exercise.id]}
                            </p>
                          )}
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                          {t('field.romanization')}
                          <input
                            value={exercise.romanization ?? ''}
                            onChange={(event) =>
                              update(index, 'romanization', event.target.value)
                            }
                            disabled={isPending}
                            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                      </div>
                    </fieldset>
                    <fieldset className="grid gap-3">
                      <legend className="text-sm font-bold text-[#39465b]">
                        {t('lesson.exerciseTranslation')}
                      </legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-semibold">
                          {t('field.meaningTh')}
                          <input
                            value={exercise.meaningTh}
                            onChange={(event) =>
                              update(index, 'meaningTh', event.target.value)
                            }
                            disabled={isPending}
                            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                          {t('field.meaningEn')}
                          <input
                            value={exercise.meaningEn}
                            onChange={(event) =>
                              update(index, 'meaningEn', event.target.value)
                            }
                            disabled={isPending}
                            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                      </div>
                    </fieldset>
                    <fieldset className="grid gap-3">
                      <legend className="text-sm font-bold text-[#39465b]">
                        {t('lesson.exerciseMetadata')}
                      </legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Dropdown
                          label={t('field.difficulty')}
                          value={exercise.difficulty}
                          onChange={(value) =>
                            update(index, 'difficulty', value)
                          }
                          disabled={isPending}
                          options={difficulties.map((value) => ({
                            value,
                            label: t(`difficulty.${value}`),
                          }))}
                        />
                        <label className="grid gap-1 text-sm font-semibold">
                          {t('field.hint')}
                          <input
                            value={exercise.hint ?? ''}
                            onChange={(event) =>
                              update(index, 'hint', event.target.value)
                            }
                            disabled={isPending}
                            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                      </div>
                    </fieldset>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        disabled={isPending || !hasUnsavedChanges}
                        onClick={() => submit('save')}
                      >
                        {isPending
                          ? t('action.saving')
                          : t('action.saveChanges')}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={isPending}
                        onClick={() => cancelExercise(exercise.id)}
                      >
                        {t('action.cancel')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm text-[#667085]">
                    <p className="font-semibold text-[#39465b]">
                      {exercise.targetText || t('lesson.untitledExercise')}
                    </p>
                    <p>
                      {exercise.romanization ?? t('lesson.noRomanization')} ·{' '}
                      {t(`difficulty.${exercise.difficulty}`)}
                    </p>
                    <p>
                      {exercise.meaningTh ||
                        exercise.meaningEn ||
                        t('lesson.noMeaning')}
                    </p>
                  </div>
                )}
              </div>
            )
          }}
          renderOverlay={(exercise) => {
            const index = exercises.findIndex((item) => item.id === exercise.id)
            return (
              <div className="grid min-h-22 w-full gap-3 border border-[#eadfd4] px-4 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 px-1 py-2 text-lg leading-none tracking-[-0.2em] text-[#a85d4e]">
                      ⋮⋮
                    </span>
                    <p className="truncate text-sm font-bold">
                      {exercise.targetText ||
                        t('lesson.exerciseNumber', { number: index + 1 })}
                    </p>
                  </div>
                  <span className="rounded-full border border-[#eadfd4] bg-white/90 px-3 py-2 text-sm font-semibold text-[#8d4c43]">
                    {t('action.editExercise')}
                  </span>
                </div>
                {editingExerciseId === exercise.id ? (
                  <div className="grid gap-5">
                    <fieldset className="grid gap-3">
                      <legend className="text-sm font-bold text-[#39465b]">
                        {t('lesson.exerciseContent')}
                      </legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-semibold">
                          {t('field.targetText')}
                          <input
                            value={exercise.targetText}
                            readOnly
                            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                          {t('field.romanization')}
                          <input
                            value={exercise.romanization ?? ''}
                            readOnly
                            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                      </div>
                    </fieldset>
                    <fieldset className="grid gap-3">
                      <legend className="text-sm font-bold text-[#39465b]">
                        {t('lesson.exerciseTranslation')}
                      </legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-semibold">
                          {t('field.meaningTh')}
                          <input
                            value={exercise.meaningTh}
                            readOnly
                            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                          {t('field.meaningEn')}
                          <input
                            value={exercise.meaningEn}
                            readOnly
                            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                      </div>
                    </fieldset>
                    <fieldset className="grid gap-3">
                      <legend className="text-sm font-bold text-[#39465b]">
                        {t('lesson.exerciseMetadata')}
                      </legend>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-semibold">
                          {t('field.difficulty')}
                          <input
                            value={t(`difficulty.${exercise.difficulty}`)}
                            readOnly
                            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                          {t('field.hint')}
                          <input
                            value={exercise.hint ?? ''}
                            readOnly
                            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                          />
                        </label>
                      </div>
                    </fieldset>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center justify-center rounded-full border border-[#a85d4e] bg-[#a85d4e] px-4 py-2 text-sm font-semibold text-white">
                        {t('action.saveChanges')}
                      </span>
                      <span className="inline-flex items-center justify-center rounded-full border border-[#eadfd4] bg-white/90 px-4 py-2 text-sm font-semibold text-[#39465b]">
                        {t('action.cancel')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 text-sm text-[#667085]">
                    <p className="font-semibold text-[#39465b]">
                      {exercise.targetText || t('lesson.untitledExercise')}
                    </p>
                    <p>
                      {exercise.romanization ?? t('lesson.noRomanization')} ·{' '}
                      {t(`difficulty.${exercise.difficulty}`)}
                    </p>
                    <p>
                      {exercise.meaningTh ||
                        exercise.meaningEn ||
                        t('lesson.noMeaning')}
                    </p>
                  </div>
                )}
              </div>
            )
          }}
        />
      </section>
    </PageSurface>
  )
}
