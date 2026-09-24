import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import LessonDetailPage from './LessonDetailPage'
import type { Lesson } from '../../domain/models/lesson'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'l1',
    unitId: 'u1',
    title: 'Greetings',
    type: 'word',
    order: 1,
    exercises: [
      {
        id: 'e1',
        targetText: '가',
        romanization: null,
        meaningTh: '',
        meaningEn: '',
        difficulty: 'easy',
        hint: null,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function renderPage(lesson: Lesson) {
  const router = createMemoryRouter(
    [{ path: '/', Component: LessonDetailPage, loader: async () => ({ lesson }) }],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

const fakeOutcome: CompleteLessonOutcome = {
  progress: {
    lessonId: 'l1',
    status: 'completed',
    bestAccuracy: 100,
    bestSpeedWpm: 20,
    attempts: 1,
    lastAttemptAt: new Date(),
    completedAt: new Date(),
  },
  expGained: 100,
  level: 2,
  unlockedNextLessonId: 'l2',
}

describe('LessonDetailPage', () => {
  it('renders each exercise', async () => {
    renderPage(
      makeLesson({
        exercises: [
          {
            id: 'e1',
            targetText: '안녕',
            romanization: 'annyeong',
            meaningTh: 'สวัสดี',
            meaningEn: 'Hello',
            difficulty: 'easy',
            hint: null,
          },
        ],
      }),
    )

    expect(await screen.findByText('안녕')).toBeInTheDocument()
    expect(screen.getByText('สวัสดี / Hello')).toBeInTheDocument()
  })

  it('shows an empty-state message when there are no exercises yet', async () => {
    renderPage(makeLesson({ exercises: [] }))

    expect(await screen.findByText('No exercises yet.')).toBeInTheDocument()
  })

  it('shows a Start Lesson button, then switches to the typing session on click', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: LessonDetailPage,
          loader: async () => ({ lesson: makeLesson() }),
          action: async () => fakeOutcome,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start Lesson' }))

    expect(await screen.findByText('가')).toBeInTheDocument()
  })

  it('shows the inline completion block once the lesson finishes', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: LessonDetailPage,
          loader: async () => ({ lesson: makeLesson() }),
          action: async () => fakeOutcome,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start Lesson' }))
    await screen.findByText('가')
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    expect(await screen.findByText('Lesson complete!')).toBeInTheDocument()
    expect(screen.getByText(/\+100 EXP/)).toBeInTheDocument()
    expect(screen.getByText('Next lesson unlocked.')).toBeInTheDocument()
  })
})
