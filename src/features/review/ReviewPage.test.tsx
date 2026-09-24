import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import ReviewPage from './ReviewPage'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import type { ReviewItem } from '../../domain/models/review-item'
import type { SubmitReviewSessionOutcome } from '../../application/submit-review-session'

function makeItem(id: string, overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id,
    sourceLessonId: 'l1',
    sourceExerciseId: 'e1',
    targetText: '가',
    reason: 'mistake',
    mistakeCount: 1,
    lastMistakeAt: new Date('2026-01-01'),
    resolved: false,
    box: 1,
    nextReviewAt: new Date('2026-01-01'),
    ...overrides,
  }
}

const fakeOutcome: SubmitReviewSessionOutcome = { correctCount: 1, needsPracticeCount: 0 }

describe('ReviewPage', () => {
  beforeEach(() => {
    useLessonSessionStore.setState({ session: null })
  })

  it('shows an empty state when nothing is due', async () => {
    const router = createMemoryRouter(
      [{ path: '/', Component: ReviewPage, loader: async () => ({ items: [] }) }],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Nothing due right now.')).toBeInTheDocument()
  })

  it('shows a preview list and Start Review button, then switches to the typing session on click', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: ReviewPage,
          loader: async () => ({ items: [makeItem('a')] }),
          action: async () => fakeOutcome,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('가')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Start Review' }))

    expect(await screen.findByText('0 / 1')).toBeInTheDocument()
  })

  it('shows the summary once the review session finishes', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: ReviewPage,
          loader: async () => ({ items: [makeItem('a')] }),
          action: async () => fakeOutcome,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start Review' }))
    await screen.findByText('0 / 1')
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    expect(await screen.findByText('Review complete!')).toBeInTheDocument()
    expect(screen.getByText('1 correct, 0 need more practice')).toBeInTheDocument()
  })
})
