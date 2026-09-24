import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LessonTypingSession from './LessonTypingSession'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import type { Lesson } from '../../domain/models/lesson'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: 'l1',
    unitId: 'u1',
    title: 'Lesson',
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
  unlockedNextLessonId: null,
}

function renderSession(
  onComplete: (outcome: CompleteLessonOutcome) => void,
  lesson: Lesson = makeLesson(),
  action: () => Promise<CompleteLessonOutcome> = async () => fakeOutcome,
) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: () => <LessonTypingSession lesson={lesson} onComplete={onComplete} />,
        action,
      },
    ],
    { initialEntries: ['/'] },
  )
  // Matches src/main.tsx, which wraps the whole app in StrictMode — its
  // dev-mode double-invoke of effects on mount is exactly what exposed the
  // cross-mount stale-session bug below; rendering without it would miss
  // that whole class of bug.
  return render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

describe('LessonTypingSession', () => {
  beforeEach(() => {
    useLessonSessionStore.setState({ session: null })
  })

  it('highlights the current character and updates the composed text on a correct keydown', async () => {
    renderSession(vi.fn())
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    expect(await screen.findByText('Typed: ㄱ')).toBeInTheDocument()
  })

  it('submits the aggregated result and calls onComplete once the lesson finishes', async () => {
    const onComplete = vi.fn()
    renderSession(onComplete)
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ expGained: 100, level: 2 }))
  })

  it('submits the action exactly once even if extra keydowns fire after completion', async () => {
    const actionSpy = vi.fn(async () => fakeOutcome)
    renderSession(vi.fn(), makeLesson(), actionSpy)
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })
    // pressKey already no-ops once the exercise/lesson is complete — these must not cause a second submit
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => expect(actionSpy).toHaveBeenCalledTimes(1))
  })

  it('stops handling keydowns after unmount', async () => {
    const { unmount } = renderSession(vi.fn())
    await screen.findByText('가')

    unmount()
    const sessionAfterUnmount = useLessonSessionStore.getState().session
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })

    expect(useLessonSessionStore.getState().session).toBe(sessionAfterUnmount)
  })

  it("does not auto-submit a previous lesson's stale completed session when a new lesson mounts", async () => {
    const lessonA = makeLesson({
      id: 'a',
      exercises: [
        {
          id: 'a1',
          targetText: '가',
          romanization: null,
          meaningTh: '',
          meaningEn: '',
          difficulty: 'easy',
          hint: null,
        },
      ],
    })
    const onCompleteA = vi.fn()
    const { unmount } = renderSession(onCompleteA, lessonA)
    await screen.findByText('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })
    await waitFor(() => expect(onCompleteA).toHaveBeenCalledOnce())
    unmount()

    const lessonB = makeLesson({
      id: 'b',
      exercises: [
        {
          id: 'b1',
          targetText: '나',
          romanization: null,
          meaningTh: '',
          meaningEn: '',
          difficulty: 'easy',
          hint: null,
        },
      ],
    })
    const actionSpyB = vi.fn(async () => fakeOutcome)
    const onCompleteB = vi.fn()
    renderSession(onCompleteB, lessonB, actionSpyB)
    await screen.findByText('나')

    // Give any stray effect a tick to fire before asserting it never did.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(actionSpyB).not.toHaveBeenCalled()
    expect(onCompleteB).not.toHaveBeenCalled()
  })

  it('handles a lesson with zero exercises without crashing, submitting immediately', async () => {
    const onComplete = vi.fn()
    renderSession(onComplete, makeLesson({ exercises: [] }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
  })
})
