import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import WeakJamoPage from './WeakJamoPage'
import {
  weakJamoShouldRevalidate,
  type WeakJamoLoaderData,
} from './WeakJamoPage.loader'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import { defaultUserProfile } from '../../domain/models/user-profile'

const settings = defaultUserProfile('u1', new Date(0)).settings
const target = { jamo: 'ㄱ', mistakeRate: 0.2, attempts: 50 }

// Each load draws the two exercises in the other order, as a real random
// draw would, so a remount keyed on exercise ids would show up.
function renderPage(action: () => Promise<unknown>) {
  let loads = 0
  const loader = vi.fn(async (): Promise<WeakJamoLoaderData> => {
    loads += 1
    const exercises = [
      { id: 'l:a', targetText: '가', lessonType: 'word' as const },
      { id: 'l:b', targetText: '가', lessonType: 'word' as const },
    ]
    return {
      targets: [target],
      exercises: loads % 2 === 0 ? exercises.reverse() : exercises,
      settings,
    }
  })
  const router = createMemoryRouter(
    [
      {
        path: '/review/weak-jamo',
        Component: WeakJamoPage,
        loader,
        action,
        shouldRevalidate: weakJamoShouldRevalidate,
      },
      { path: '/review', Component: () => <p>Review page</p> },
    ],
    { initialEntries: ['/review/weak-jamo'] },
  )
  render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
  return { loader }
}

async function typeBothExercises() {
  for (let index = 0; index < 2; index += 1) {
    await screen.findByRole('img', { name: '가' })
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })
  }
}

describe('WeakJamoPage', () => {
  beforeEach(() => {
    useLessonSessionStore.setState({ session: null })
  })

  it('shows the results after saving, without reloading the practice set', async () => {
    const { loader } = renderPage(async () => ({
      correctCount: 2,
      needsPracticeCount: 0,
    }))
    await typeBothExercises()

    expect(await screen.findByText('Practice complete!')).toBeInTheDocument()
    expect(screen.getByText('100% accuracy')).toBeInTheDocument()
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('offers a retry when saving fails, instead of leaving the page', async () => {
    renderPage(async () => ({ error: 'Your practice could not be saved.' }))
    await typeBothExercises()

    expect(
      await screen.findByRole('button', { name: 'Try again' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Your practice could not be saved.')).toBeInTheDocument()
  })

  it('starts one new round with a newly drawn set on "Practice again"', async () => {
    const { loader } = renderPage(async () => ({
      correctCount: 2,
      needsPracticeCount: 0,
    }))
    await typeBothExercises()
    fireEvent.click(await screen.findByRole('button', { name: 'Practice again' }))

    await screen.findByRole('img', { name: '가' })
    await waitFor(() => expect(loader).toHaveBeenCalledTimes(2))
    expect(screen.queryByText('Practice complete!')).not.toBeInTheDocument()
    expect(useLessonSessionStore.getState().session?.exercises.map((e) => e.id)).toEqual(['l:b', 'l:a'])
  })
})
