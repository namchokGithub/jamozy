import { StrictMode, useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLoaderData } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OnePageLearningPath } from '../../application/get-one-page-learning-path'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import OnePageLearningPlayer from './OnePageLearningPlayer'

const initialPath: OnePageLearningPath = {
  courses: [{ id: 'course-1', title: 'Starter course', description: 'Learn Hangul' }],
  selectedCourseId: 'course-1',
  queue: [
    {
      course: {
        id: 'course-1',
        title: 'Starter course',
        description: 'Learn Hangul',
        order: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      unit: {
        id: 'unit-1',
        courseId: 'course-1',
        title: 'Basics',
        description: 'Basics',
        order: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      lesson: {
        id: 'lesson-1',
        unitId: 'unit-1',
        title: 'First syllables',
        type: 'syllable',
        order: 1,
        exercises: [
          {
            id: 'exercise-1',
            targetText: '가',
            romanization: 'ga',
            meaningTh: 'ไป',
            meaningEn: 'go',
            difficulty: 'easy',
            hint: null,
          },
        ],
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
      },
      exercise: {
        id: 'exercise-1',
        targetText: '가',
        romanization: 'ga',
        meaningTh: 'ไป',
        meaningEn: 'go',
        difficulty: 'easy',
        hint: null,
      },
    },
  ],
  checkpoint: null,
  pendingLessonId: null,
}

function PlayerHarness() {
  const [learningPath, setLearningPath] = useState(initialPath)

  return (
    <>
      <button
        type="button"
        onClick={() => setLearningPath((path) => ({ ...path, queue: [...path.queue] }))}
      >
        Revalidate
      </button>
      <OnePageLearningPlayer learningPath={learningPath} />
    </>
  )
}

function renderPlayer() {
  const router = createMemoryRouter(
    [{ path: '/', Component: PlayerHarness }],
    { initialEntries: ['/'] },
  )
  return render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

function PlayerRoute() {
  return <OnePageLearningPlayer learningPath={useLoaderData() as OnePageLearningPath} />
}

function threeExercisePath(): OnePageLearningPath {
  const first = initialPath.queue[0]
  const exercises = [
    first.exercise,
    { ...first.exercise, id: 'exercise-2', targetText: '나', romanization: 'na' },
    { ...first.exercise, id: 'exercise-3', targetText: '다', romanization: 'da' },
  ]
  const lesson = { ...first.lesson, exercises }
  return {
    ...initialPath,
    queue: exercises.map((exercise) => ({ ...first, lesson, exercise })),
  }
}

function renderPlayerWithPendingSaves() {
  const saveResolvers: Array<() => void> = []
  const savedExerciseIds: string[] = []
  const action = vi.fn(
    async ({ request }: { request: Request }) => {
      const response = new Promise<{ onePageCheckpointed: boolean }>((resolve) => {
        saveResolvers.push(() => resolve({ onePageCheckpointed: true }))
      })
      const body = (await request.json()) as { result: { exerciseId: string } }
      savedExerciseIds.push(body.result.exerciseId)
      return response
    },
  )
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: PlayerRoute,
        loader: async () => threeExercisePath(),
        action,
      },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
  return { action, savedExerciseIds, resolveNextSave: () => saveResolvers.shift()?.() }
}

describe('OnePageLearningPlayer', () => {
  beforeEach(() => {
    useLessonSessionStore.setState({ session: null, generation: 0 })
  })

  it('keeps partially typed progress when revalidation returns an equivalent queue', async () => {
    renderPlayer()
    await screen.findByRole('img', { name: '가' })

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    await waitFor(() => {
      expect(useLessonSessionStore.getState().session?.currentSession.keyIndex).toBe(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Revalidate' }))

    await waitFor(() => {
      expect(useLessonSessionStore.getState().session?.currentSession.keyIndex).toBe(1)
    })
  })

  it('serializes completed exercises while the learner continues typing', async () => {
    const { action, savedExerciseIds, resolveNextSave } = renderPlayerWithPendingSaves()
    await screen.findByRole('img', { name: '가' })

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => expect(action).toHaveBeenCalledOnce())

    fireEvent.keyDown(window, { code: 'KeyS', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => {
      expect(useLessonSessionStore.getState().session?.currentIndex).toBe(2)
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    fireEvent.keyDown(window, { code: 'KeyE', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    expect(action).toHaveBeenCalledOnce()

    resolveNextSave()
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2))

    resolveNextSave()
    await waitFor(() => expect(action).toHaveBeenCalledTimes(3))
    expect(savedExerciseIds).toEqual(['exercise-1', 'exercise-2', 'exercise-3'])

    resolveNextSave()
  })
})
