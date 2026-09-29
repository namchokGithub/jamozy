import { useState } from 'react'
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
  useAdminFeedback(fetcher)
  const [title, setTitle] = useState(lesson.title)
  const [type, setType] = useState(lesson.type)
  const [exercises, setExercises] = useState(lesson.exercises)
  const [editingDetails, setEditingDetails] = useState(false)
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null,
  )
  const submit = (intent: string) =>
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
          t('breadcrumb.admin'),
          course?.title ?? t('kind.course'),
          unit?.title ?? t('kind.unit'),
          lesson.title,
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
            {t('field.title')}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
            />
          </label>
          <Dropdown
            label={t('field.lessonType')}
            value={type}
            onChange={setType}
            options={lessonTypes.map((value) => ({
              value,
              label: t(`lessonType.${value}`),
            }))}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => submit('save')}>
              {t('action.saveLesson')}
            </Button>
            <Button
              variant="secondary"
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
          <Button variant="secondary" onClick={() => setEditingDetails(true)}>
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
            onClick={() => {
              const exercise = newExercise()
              setExercises((items) => [...items, exercise])
              setEditingExerciseId(exercise.id)
            }}
          >
            {t('action.addExercise')}
          </Button>
        </div>
        <div className="mt-4 space-y-4">
          {exercises.map((exercise, index) => (
            <Card key={exercise.id} className="grid gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">
                  {t('lesson.exerciseNumber', { number: index + 1 })}
                </p>
                {editingExerciseId === exercise.id ? (
                  <div className="flex gap-1">
                    <Button
                      aria-label={t('lesson.exerciseMoveUp', {
                        number: index + 1,
                      })}
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      {t('action.moveUp')}
                    </Button>
                    <Button
                      aria-label={t('lesson.exerciseMoveDown', {
                        number: index + 1,
                      })}
                      variant="ghost"
                      disabled={index === exercises.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      {t('action.moveDown')}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    onClick={() => setEditingExerciseId(exercise.id)}
                  >
                    {t('action.editExercise')}
                  </Button>
                )}
              </div>
              {editingExerciseId === exercise.id ? (
                <>
                  <label className="grid gap-1 text-sm font-semibold">
                    {t('field.targetText')}
                    <input
                      value={exercise.targetText}
                      onChange={(event) =>
                        update(index, 'targetText', event.target.value)
                      }
                      className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold">
                    {t('field.romanization')}
                    <input
                      value={exercise.romanization ?? ''}
                      onChange={(event) =>
                        update(index, 'romanization', event.target.value)
                      }
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
                      className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                    />
                  </label>
                  <Dropdown
                    label={t('field.difficulty')}
                    value={exercise.difficulty}
                    onChange={(value) => update(index, 'difficulty', value)}
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
                      className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => submit('save')}>
                      {t('action.saveChanges')}
                    </Button>
                    <Button
                      variant="secondary"
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
