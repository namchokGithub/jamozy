import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import ReviewPage from './ReviewPage'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import type { ReviewItem } from '../../domain/models/review-item'
import type { SubmitReviewSessionOutcome } from '../../application/submit-review-session'
import type { ReviewPreview } from '../../application/get-review-previews'
import type { UserSettings } from '../../domain/models/user-profile'

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

function makePreview(id: string, overrides: Partial<ReviewPreview> = {}): ReviewPreview {
  return {
    item: makeItem(id),
    exercise: {
      id: 'e1',
      targetText: '가',
      romanization: 'ga',
      meaningTh: 'ไป',
      meaningEn: 'Go',
      difficulty: 'easy',
      hint: null,
    },
    ...overrides,
  }
}

function makeSettings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    soundEnabled: true,
    showKeyboard: true,
    showEnglishKeys: true,
    keyboardOpacity: 0.7,
    romanizationEnabled: true,
    meaningLanguage: 'both',
    theme: 'light',
    ...overrides,
  }
}

describe('ReviewPage', () => {
  beforeEach(() => {
    useLessonSessionStore.setState({ session: null })
  })

  it('shows an empty state when nothing is due', async () => {
    const router = createMemoryRouter(
      [{ path: '/', Component: ReviewPage, loader: async () => ({ previews: [], settings: makeSettings() }) }],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('Nothing due right now.')).toBeInTheDocument()
  })

  it('shows preference-aware metadata in the preview list', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: ReviewPage,
          loader: async () => ({ previews: [makePreview('a')], settings: makeSettings() }),
          action: async () => fakeOutcome,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('가')).toBeInTheDocument()
    expect(screen.getByText('ga')).toBeInTheDocument()
    expect(screen.getByText('ไป / Go')).toBeInTheDocument()
  })

  it('hides disabled metadata and keeps a preview without source metadata Korean-only', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: ReviewPage,
          loader: async () => ({
            previews: [
              makePreview('a'),
              makePreview('missing', { item: makeItem('missing', { targetText: '안녕' }), exercise: null }),
            ],
            settings: makeSettings({ romanizationEnabled: false, meaningLanguage: 'th' }),
          }),
          action: async () => fakeOutcome,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    expect(await screen.findByText('가')).toBeInTheDocument()
    expect(screen.getByText('ไป')).toBeInTheDocument()
    expect(screen.queryByText('ga')).not.toBeInTheDocument()
    expect(screen.queryByText('Go')).not.toBeInTheDocument()
    expect(screen.getByText('안녕')).toBeInTheDocument()
  })

  it('starts the typing session with raw items and its keyboard settings', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: ReviewPage,
          loader: async () => ({
            previews: [makePreview('a')],
            settings: makeSettings({ showKeyboard: false }),
          }),
          action: async () => fakeOutcome,
        },
      ],
      { initialEntries: ['/'] },
    )
    render(<RouterProvider router={router} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Start Review' }))

    expect(await screen.findByText('0 / 1')).toBeInTheDocument()
    expect(screen.queryByText('ㅂ')).not.toBeInTheDocument()
  })

  it('shows the summary once the review session finishes', async () => {
    const router = createMemoryRouter(
      [
        {
          path: '/',
          Component: ReviewPage,
          loader: async () => ({ previews: [makePreview('a')], settings: makeSettings() }),
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
