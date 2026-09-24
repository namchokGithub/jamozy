import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ReviewTypingSession from './ReviewTypingSession'
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

function renderSession(
  onComplete: (outcome: SubmitReviewSessionOutcome) => void,
  items: ReviewItem[] = [makeItem('a')],
  action: (args: { request: Request }) => Promise<SubmitReviewSessionOutcome> = async () => fakeOutcome,
) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: () => <ReviewTypingSession items={items} onComplete={onComplete} />,
        action,
      },
    ],
    { initialEntries: ['/'] },
  )
  // Matches src/main.tsx, which wraps the whole app in StrictMode — the same
  // reasoning as LessonTypingSession.test.tsx.
  return render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

describe('ReviewTypingSession', () => {
  beforeEach(() => {
    useLessonSessionStore.setState({ session: null })
  })

  it('highlights the current character and updates the composed text on a correct keydown', async () => {
    renderSession(vi.fn())
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    expect(await screen.findByText('Typed: ㄱ')).toBeInTheDocument()
  })

  it('submits the result and calls onComplete once the review session finishes', async () => {
    const onComplete = vi.fn()
    renderSession(onComplete)
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(onComplete).toHaveBeenCalledWith(fakeOutcome)
  })

  it('submits wasCorrect:false for an item typed with at least one mistake, even once finished', async () => {
    const onComplete = vi.fn()
    const action = vi.fn(async ({ request }: { request: Request }) => {
      const body = (await request.json()) as { results: Array<{ itemId: string; wasCorrect: boolean }> }
      return {
        correctCount: body.results.filter((r) => r.wasCorrect).length,
        needsPracticeCount: body.results.filter((r) => !r.wasCorrect).length,
      }
    })
    renderSession(onComplete, [makeItem('a')], action)
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyT', shiftKey: false }) // wrong key first
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false }) // now correct
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(onComplete).toHaveBeenCalledWith({ correctCount: 0, needsPracticeCount: 1 })
  })

  it('stops handling keydowns after unmount', async () => {
    const { unmount } = renderSession(vi.fn())
    await screen.findByText('가')

    unmount()
    const sessionAfterUnmount = useLessonSessionStore.getState().session
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })

    expect(useLessonSessionStore.getState().session).toBe(sessionAfterUnmount)
  })

  it("does not auto-submit a previous review session's stale completed session when a new one mounts", async () => {
    const itemsA = [makeItem('a')]
    const onCompleteA = vi.fn()
    const { unmount } = renderSession(onCompleteA, itemsA)
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })
    await waitFor(() => expect(onCompleteA).toHaveBeenCalledOnce())
    unmount()

    const itemsB = [makeItem('b', { targetText: '나' })]
    const actionSpyB = vi.fn(async () => fakeOutcome)
    const onCompleteB = vi.fn()
    renderSession(onCompleteB, itemsB, actionSpyB)
    await screen.findByText('나')

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(actionSpyB).not.toHaveBeenCalled()
    expect(onCompleteB).not.toHaveBeenCalled()
  })
})
