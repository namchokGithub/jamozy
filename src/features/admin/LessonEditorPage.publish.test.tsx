import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test, vi } from 'vitest'
import type { Course } from '../../domain/models/course'
import type { Lesson, LessonExercise } from '../../domain/models/lesson'
import type { Unit } from '../../domain/models/unit'
import { FakeAdminContentRepository } from '../../test/fakes'
import { createAdminAction } from './admin-action'
import { createLessonEditorLoader } from './LessonEditorPage.loader'
import LessonEditorPage from './LessonEditorPage'

vi.mock('./AdminSortableList', () => ({
  AdminSortableList: ({
    items,
    renderItem,
  }: {
    items: LessonExercise[]
    renderItem: (
      item: LessonExercise,
      props: { handleRef: () => void; isDragging: boolean; ref: () => void },
    ) => ReactNode
  }) => (
    <div>
      {items.map((item) => (
        <div key={item.id}>
          {renderItem(item, {
            handleRef: () => undefined,
            isDragging: false,
            ref: () => undefined,
          })}
        </div>
      ))}
    </div>
  ),
}))

test('publishing a saved exercise does not report unsaved changes when field order changes', async () => {
  const now = new Date('2026-10-12')
  const course: Course = {
    id: 'course-1',
    title: 'Course',
    description: '',
    order: 0,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  }
  const unit: Unit = {
    id: 'unit-1',
    courseId: course.id,
    title: 'Unit',
    description: '',
    order: 0,
    status: 'published',
    createdAt: now,
    updatedAt: now,
  }
  const lesson: Lesson = {
    id: 'lesson-1',
    unitId: unit.id,
    title: 'Lesson',
    type: 'character',
    order: 0,
    status: 'draft',
    exercises: [],
    createdAt: now,
    updatedAt: now,
  }
  const repo = new FakeAdminContentRepository([course], [unit], [lesson])
  const getLessonById = repo.getLessonById.bind(repo)
  repo.getLessonById = async (id) => {
    const saved = await getLessonById(id)
    if (!saved || saved.status !== 'published') return saved
    return {
      ...saved,
      exercises: saved.exercises.map(
        (exercise) =>
          Object.fromEntries(
            Object.entries(exercise).reverse(),
          ) as unknown as LessonExercise,
      ),
    }
  }

  const router = createMemoryRouter(
    [
      {
        path: '/admin/lessons/:lessonId',
        Component: LessonEditorPage,
        loader: createLessonEditorLoader(repo),
        action: createAdminAction(repo),
      },
    ],
    { initialEntries: ['/admin/lessons/lesson-1'] },
  )
  render(<RouterProvider router={router} />)

  fireEvent.click(await screen.findByRole('button', { name: 'Add Exercise' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Target text' }), {
    target: { value: '가' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save all changes' }))
  await waitFor(() =>
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument(),
  )
  const savedExercises = repo.lessons[0].exercises

  fireEvent.click(screen.getByRole('button', { name: 'Publish' }))
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }))
  await waitFor(() => expect(repo.lessons[0].status).toBe('published'))
  expect(repo.lessons[0].exercises).toEqual(savedExercises)
  await waitFor(() =>
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument(),
  )

  fireEvent.click(screen.getByRole('button', { name: 'Edit exercise' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Target text' }), {
    target: { value: '나' },
  })
  expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
})
