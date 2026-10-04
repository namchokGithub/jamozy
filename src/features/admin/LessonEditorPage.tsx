import { useCallback, useState } from 'react'
import { useFetcher, useLoaderData } from 'react-router'
import type { Lesson, LessonExercise } from '../../domain/models/lesson'
import type { Unit } from '../../domain/models/unit'
import type { Course } from '../../domain/models/course'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dropdown } from '../../components/ui/Dropdown'
import { PageSurface } from '../../components/ui/PageSurface'
import { AdminStatusActions } from './AdminStatusActions'
import { useAdminFeedback } from './useAdminFeedback'
import { useAdminMutationPending } from './useAdminMutationPending'
import { AdminTopBar } from './AdminTopBar'
import { statusKey, useAdminTranslation } from './i18n/admin-i18n'

const lessonTypes: Lesson['type'][] = [
  'character',
  'syllable',
  'word',
  'phrase',
  'sentence',
]
const difficulties: LessonExercise['difficulty'][] = ['easy', 'medium', 'hard']

function newExercise(): LessonExercise {
  return {
    id: crypto.randomUUID(),
    targetText: '',
    romanization: null,
    meaningTh: '',
    meaningEn: '',
    difficulty: 'easy',
    hint: null,
  }
}

export default function LessonEditorPage() {
  const { lesson, unit, course } = useLoaderData() as {
    lesson: Lesson
    unit: Unit | null
    course: Course | null
  }
  const { t } = useAdminTranslation()
  const fetcher = useFetcher()
  const [title, setTitle] = useState(lesson.title)
  const [type, setType] = useState(lesson.type)
  const [exercises, setExercises] = useState(lesson.exercises)
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
  const handleSuccess = useCallback((data: { message?: string }) => {
    if (data.message === 'feedback.lessonSaved') {
      setEditingDetails(false)
      setEditingExerciseId(null)
      setHasPendingExerciseOrder(false)
    }
  }, [])
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
  const move = (index: number, direction: -1 | 1) =>
    setExercises((items) => {
      const next = [...items]
      const target = index + direction
      if (!next[target]) return items
      ;[next[index], next[target]] = [next[target], next[index]]
      setHasPendingExerciseOrder(true)
      return next
    })
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
  return (
    <PageSurface contentClassName="max-w-3xl">
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
        <div>
          <p className="text-sm font-semibold uppercase text-[#a85d4e]">
            {t('kind.lesson')} · {t(statusKey(lesson.status))}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{t('lesson.title')}</h1>
        </div>
        <AdminStatusActions
          id={lesson.id}
          kind="lesson"
          status={lesson.status}
        />
      </header>
      {editingDetails ? (
        <Card className="mt-6 grid gap-4">
          <label className="grid gap-1 text-sm font-semibold">
            {t('field.title')}{' '}
            <span aria-hidden="true" className="text-[#a85d4e]">
              *
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
            <Button disabled={isPending} onClick={() => submit('save')}>
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
        <Card className="mt-6 flex flex-wrap items-start justify-between gap-4">
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
              const exercise = newExercise()
              setExercises((items) => [...items, exercise])
              setEditingExerciseId(exercise.id)
            }}
          >
            {t('action.addExercise')}
          </Button>
        </div>
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
        <div className="mt-4 space-y-4">
          {exercises.map((exercise, index) => (
            <Card key={exercise.id} className="grid gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">
                  {t('lesson.exerciseNumber', { number: index + 1 })}
                </p>
                <div className="flex flex-wrap justify-end gap-1">
                  <Button
                    aria-label={t('lesson.exerciseMoveUp', {
                      number: index + 1,
                    })}
                    variant="ghost"
                    disabled={isPending || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    {t('action.moveUp')}
                  </Button>
                  <Button
                    aria-label={t('lesson.exerciseMoveDown', {
                      number: index + 1,
                    })}
                    variant="ghost"
                    disabled={isPending || index === exercises.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    {t('action.moveDown')}
                  </Button>
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
                <>
                  <label className="grid gap-1 text-sm font-semibold">
                    {t('field.targetText')}{' '}
                    <span aria-hidden="true" className="text-[#a85d4e]">
                      *
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
                  <Dropdown
                    label={t('field.difficulty')}
                    value={exercise.difficulty}
                    onChange={(value) => update(index, 'difficulty', value)}
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
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={isPending} onClick={() => submit('save')}>
                      {isPending ? t('action.saving') : t('action.saveChanges')}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={isPending}
                      onClick={() => cancelExercise(exercise.id)}
                    >
                      {t('action.cancel')}
                    </Button>
                  </div>
                </>
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
            </Card>
          ))}
        </div>
      </section>
    </PageSurface>
  )
}
