import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import CourseMapPage from './CourseMapPage'
import type { CourseMap } from '../../application/get-course'
import type { Course } from '../../domain/models/course'
import type { Unit } from '../../domain/models/unit'
import type { Lesson } from '../../domain/models/lesson'

function makeCourse(): Course {
  return {
    id: 'c1',
    title: 'Hangul Basics',
    description: 'desc',
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeUnit(id: string, order: number): Unit {
  return {
    id,
    courseId: 'c1',
    title: `Unit ${id}`,
    description: '',
    order,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeLesson(id: string, unitId: string): Lesson {
  return {
    id,
    unitId,
    title: `Lesson ${id}`,
    type: 'word',
    order: 1,
    exercises: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function renderPage(courseMap: CourseMap) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: CourseMapPage,
        loader: async () => ({ courseMap }),
      },
    ],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('CourseMapPage', () => {
  it('shows a Locked badge but keeps the lesson link clickable when there is no progress yet', async () => {
    const courseMap: CourseMap = {
      course: makeCourse(),
      units: [
        {
          unit: makeUnit('u1', 1),
          lessons: [{ lesson: makeLesson('l1', 'u1'), progress: null }],
        },
      ],
    }
    renderPage(courseMap)

    // u1 opens on its own: it is the first unit with an unfinished lesson.
    const link = await screen.findByRole('link', { name: /Lesson l1/i })
    expect(link).toHaveAttribute('href', '/lessons/l1')
    expect(screen.getByText('Locked')).toBeInTheDocument()
  })

  it('shows an empty-state message for a unit with no lessons, without crashing', async () => {
    const courseMap: CourseMap = {
      course: makeCourse(),
      units: [{ unit: makeUnit('u1', 1), lessons: [] }],
    }
    renderPage(courseMap)

    fireEvent.click(await screen.findByRole('button', { name: /Unit u1/i }))

    expect(
      screen.queryByRole('link', { name: /Lesson /i }),
    ).not.toBeInTheDocument()
    expect(await screen.findByText('No lessons yet.')).toBeInTheDocument()
  })

  it('opens only the unit holding the unlocked lesson', async () => {
    const progress = (lessonId: string, status: 'completed' | 'unlocked') => ({
      lessonId,
      status,
      bestAccuracy: 0,
      bestSpeedWpm: 0,
      attempts: 0,
      lastAttemptAt: null,
      completedAt: null,
    })
    const courseMap: CourseMap = {
      course: makeCourse(),
      units: [
        {
          unit: makeUnit('u1', 1),
          lessons: [
            {
              lesson: makeLesson('l1', 'u1'),
              progress: progress('l1', 'completed'),
            },
          ],
        },
        {
          unit: makeUnit('u2', 2),
          lessons: [
            {
              lesson: makeLesson('l2', 'u2'),
              progress: progress('l2', 'unlocked'),
            },
          ],
        },
      ],
    }
    renderPage(courseMap)

    expect(
      await screen.findByRole('button', { name: /Unit u2/i }),
    ).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /Unit u1/i })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('shows an empty-state message for a course with no units, without crashing', async () => {
    const courseMap: CourseMap = { course: makeCourse(), units: [] }
    renderPage(courseMap)

    expect(await screen.findByText('No units yet.')).toBeInTheDocument()
  })
})
