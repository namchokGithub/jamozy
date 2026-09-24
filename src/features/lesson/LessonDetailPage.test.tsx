import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import LessonDetailPage from './LessonDetailPage'
import type { Lesson } from '../../domain/models/lesson'
import type { UserSettings } from '../../domain/models/user-profile'
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

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    soundEnabled: true,
    showKeyboard: true,
    showEnglishKeys: true,
    keyboardOpacity: 1,
    romanizationEnabled: true,
    meaningLanguage: 'both',
    theme: 'light',
    ...overrides,
  }
}

function renderPage(lesson: Lesson, settings: UserSettings = makeSettings()) {
  const router = createMemoryRouter(
    [{ path: '/', Component: LessonDetailPage, loader: async () => ({ lesson, settings }) }],
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
  it('renders each exercise, gated by settings', async () => {
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
      makeSettings({ romanizationEnabled: true, meaningLanguage: 'both' }),
    )

    expect(await screen.findByText('안녕')).toBeInTheDocument()
    expect(screen.getByText('annyeong')).toBeInTheDocument()
    expect(screen.getByText('สวัสดี / Hello')).toBeInTheDocument()
  })

  it('hides romanization when romanizationEnabled is false', async () => {
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
      makeSettings({ romanizationEnabled: false }),
    )

    await screen.findByText('안녕')
    expect(screen.queryByText('annyeong')).not.toBeInTheDocument()
  })

  it('shows only the Thai meaning when meaningLanguage is th', async () => {
    renderPage(
      makeLesson({
        exercises: [
          {
            id: 'e1',
            targetText: '안녕',
            romanization: null,
            meaningTh: 'สวัสดี',
            meaningEn: 'Hello',
            difficulty: 'easy',
            hint: null,
          },
        ],
      }),
      makeSettings({ meaningLanguage: 'th' }),
    )

    await screen.findByText('안녕')
    expect(screen.getByText('สวัสดี')).toBeInTheDocument()
    expect(screen.queryByText('Hello')).not.toBeInTheDocument()
    expect(screen.queryByText('สวัสดี / Hello')).not.toBeInTheDocument()
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
          loader: async () => ({ lesson: makeLesson(), settings: makeSettings() }),
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
          loader: async () => ({ lesson: makeLesson(), settings: makeSettings() }),
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
