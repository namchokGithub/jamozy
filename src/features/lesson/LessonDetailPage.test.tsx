import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import LessonDetailPage from './LessonDetailPage'
import type { Lesson } from '../../domain/models/lesson'

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'l1',
    unitId: 'u1',
    title: 'Lesson 1',
    type: 'word',
    order: 1,
    exercises: [],
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
})
