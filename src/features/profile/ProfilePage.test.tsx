import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import ProfilePage from './ProfilePage'
import type { ProfileSummary } from '../../application/get-profile-summary'

function makeSummary(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
  return {
    exp: 250,
    level: 3,
    stats: {
      lessonsCompleted: 12,
      wordsPracticed: 84,
      averageAccuracy: 98.68421,
      bestAccuracy: 100,
      averageSpeedWpm: 23.84729,
      totalTypingTimeSeconds: 3665,
    },
    ...overrides,
  }
}

function renderPage(summary: ProfileSummary) {
  const router = createMemoryRouter(
    [{ path: '/', Component: ProfilePage, loader: async () => ({ summary }) }],
    { initialEntries: ['/'] },
  )
  return render(<RouterProvider router={router} />)
}

describe('ProfilePage', () => {
  it('renders level, partial EXP progress, and all six stats', async () => {
    renderPage(makeSummary())

    expect(await screen.findByText('Level 3')).toBeInTheDocument()
    expect(screen.getByText('50 / 100 EXP')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('84')).toBeInTheDocument()
    expect(screen.getByText('99%')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('24 WPM')).toBeInTheDocument()
    expect(screen.getByText('1h 1m')).toBeInTheDocument()
  })

  it('rounds fractional accuracy/speed stats for display without rescaling them', async () => {
    renderPage(
      makeSummary({
        stats: {
          lessonsCompleted: 3,
          wordsPracticed: 9,
          averageAccuracy: 33.33333,
          bestAccuracy: 66.66667,
          averageSpeedWpm: 9.99,
          totalTypingTimeSeconds: 60,
        },
      }),
    )

    expect(await screen.findByText('33%')).toBeInTheDocument()
    expect(screen.getByText('67%')).toBeInTheDocument()
    expect(screen.getByText('10 WPM')).toBeInTheDocument()
  })

  it('renders an EXP progress bar reflecting progress into the current level', async () => {
    renderPage(makeSummary({ exp: 250, level: 3 }))

    const progressbar = (await screen.findByRole('progressbar')) as HTMLProgressElement
    expect(progressbar.value).toBe(50)
    expect(progressbar.max).toBe(100)
  })

  it('renders zeroed stats for a brand-new user without NaN or blank values', async () => {
    renderPage(
      makeSummary({
        exp: 0,
        level: 1,
        stats: {
          lessonsCompleted: 0,
          wordsPracticed: 0,
          averageAccuracy: 0,
          bestAccuracy: 0,
          averageSpeedWpm: 0,
          totalTypingTimeSeconds: 0,
        },
      }),
    )

    expect(await screen.findByText('Level 1')).toBeInTheDocument()
    expect(screen.getByText('0 / 100 EXP')).toBeInTheDocument()
    expect(screen.getAllByText('0%')).toHaveLength(2)
    expect(screen.getByText('0 WPM')).toBeInTheDocument()
    expect(screen.getByText('0 min')).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()
    expect(screen.queryByText('undefined')).not.toBeInTheDocument()
  })
})
