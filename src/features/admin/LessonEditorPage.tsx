import { useState } from 'react'
import { Link, useFetcher, useLoaderData } from 'react-router'
import { ArrowDown, ArrowUp, Plus } from 'lucide-react'
import type { Lesson, LessonExercise } from '../../domain/models/lesson'
import type { Unit } from '../../domain/models/unit'
import type { Course } from '../../domain/models/course'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Dropdown } from '../../components/ui/Dropdown'
import { PageSurface } from '../../components/ui/PageSurface'
import { AdminStatusActions } from './AdminStatusActions'
import { useAdminFeedback } from './useAdminFeedback'

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
  const fetcher = useFetcher()
  useAdminFeedback(fetcher)
  const [title, setTitle] = useState(lesson.title)
  const [type, setType] = useState(lesson.type)
  const [exercises, setExercises] = useState(lesson.exercises)
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
  return (
    <PageSurface contentClassName="max-w-3xl">
      <Link
        to={unit ? `/admin/units/${unit.id}` : '/admin'}
        className="text-sm font-semibold text-[#667085] hover:text-[#8d4c43]"
      >
        ← {unit?.title ?? course?.title ?? 'Admin'}
      </Link>
      <header className="mt-4 flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#a85d4e]">
            LESSON · {lesson.status ?? 'draft'}
          </p>
          <h1 className="mt-1 text-3xl font-bold">Edit Lesson</h1>
        </div>
        <AdminStatusActions
          id={lesson.id}
          kind="lesson"
          status={lesson.status}
        />
      </header>
      <Card className="mt-6 grid gap-4">
        <label className="grid gap-1 text-sm font-semibold">
          Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
          />
        </label>
        <Dropdown
          label="Lesson type"
          value={type}
          onChange={(value) => setType(value as Lesson['type'])}
          options={['character', 'syllable', 'word', 'phrase', 'sentence'].map(
            (value) => ({ value, label: value }),
          )}
        />
        <Button onClick={() => submit('save')}>Save Lesson</Button>
      </Card>
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Exercises</h2>
            <p className="text-sm text-[#667085]">
              Exercise IDs stay stable. To retire one, archive this Lesson.
            </p>
          </div>
          <Button
            onClick={() => setExercises((items) => [...items, newExercise()])}
          >
            <Plus size={16} aria-hidden="true" /> Add Exercise
          </Button>
        </div>
        <div className="mt-4 space-y-4">
          {exercises.map((exercise, index) => (
            <Card key={exercise.id} className="grid gap-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold">Exercise {index + 1}</p>
                <div className="flex gap-1">
                  <Button
                    aria-label={`Move exercise ${index + 1} up`}
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={16} />
                  </Button>
                  <Button
                    aria-label={`Move exercise ${index + 1} down`}
                    variant="ghost"
                    disabled={index === exercises.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={16} />
                  </Button>
                </div>
              </div>
              <label className="grid gap-1 text-sm font-semibold">
                Target text
                <input
                  value={exercise.targetText}
                  onChange={(event) =>
                    update(index, 'targetText', event.target.value)
                  }
                  className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Romanization
                <input
                  value={exercise.romanization ?? ''}
                  onChange={(event) =>
                    update(index, 'romanization', event.target.value)
                  }
                  className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                Thai meaning
                <input
                  value={exercise.meaningTh}
                  onChange={(event) =>
                    update(index, 'meaningTh', event.target.value)
                  }
                  className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                />
              </label>
              <label className="grid gap-1 text-sm font-semibold">
                English meaning
                <input
                  value={exercise.meaningEn}
                  onChange={(event) =>
                    update(index, 'meaningEn', event.target.value)
                  }
                  className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                />
              </label>
              <Dropdown
                label="Difficulty"
                value={exercise.difficulty}
                onChange={(value) => update(index, 'difficulty', value)}
                options={['easy', 'medium', 'hard'].map((value) => ({
                  value,
                  label: value,
                }))}
              />
              <label className="grid gap-1 text-sm font-semibold">
                Hint
                <input
                  value={exercise.hint ?? ''}
                  onChange={(event) =>
                    update(index, 'hint', event.target.value)
                  }
                  className="rounded-xl border border-[#eadfd4] bg-white px-3 py-2 font-normal"
                />
              </label>
            </Card>
          ))}
        </div>
      </section>
    </PageSurface>
  )
}
