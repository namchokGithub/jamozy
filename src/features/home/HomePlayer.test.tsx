import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HomePlayerData } from '../../application/get-home-player'
import type { HomeContent } from '../../domain/models/home-content'
import type { Progress } from '../../domain/models/progress'
import HomePlayer from './HomePlayer'
import { useHomePlayerStore } from './home-player-store'
import { HomeServicesProvider, type HomeServices } from './home-services'

const exercise = (id: string, targetText: string) => ({
  id,
  targetText,
  romanization: null,
  meaningTh: '',
  meaningEn: '',
  difficulty: 'easy' as const,
  hint: null,
})

const content: HomeContent = {
  schemaVersion: 1,
  exportedAt: '2026-10-06T00:00:00.000Z',
  course: { id: 'home', title: 'Home', description: '' },
  units: [
    {
      id: 'u1',
      title: 'Basics',
      description: '',
      order: 0,
      lessons: [
        {
          id: 'l1',
          title: 'First',
          type: 'character',
          order: 0,
          exercises: [exercise('e1', 'ㄱ')],
        },
        {
          id: 'l2',
          title: 'Second',
          type: 'character',
          order: 1,
          exercises: [exercise('e2', 'ㄴ')],
        },
      ],
    },
    {
      id: 'u2',
      title: 'More',
      description: '',
      order: 1,
      lessons: [
        {
          id: 'l3',
          title: 'Third',
          type: 'character',
          order: 0,
          exercises: [exercise('e3', 'ㄷ')],
        },
      ],
    },
  ],
}

const completed = (lessonId: string): Progress => ({
  lessonId,
  status: 'completed',
  bestAccuracy: 100,
  bestSpeedWpm: 10,
  attempts: 1,
  lastAttemptAt: null,
  completedAt: new Date('2026-10-01'),
  completedExerciseIds: [],
})

function setup(
  overrides: Partial<HomePlayerData> = {},
  liveProgress: Promise<Progress[] | null> = Promise.resolve(null),
) {
  const services: HomeServices = {
    recordExercise: vi.fn(),
    recordReplay: vi.fn(),
    saveResume: vi.fn(),
  }
  const data: HomePlayerData = {
    content,
    progress: [],
    pendingExerciseIds: {},
    resume: null,
    ...overrides,
  }
  const view = render(
    <HomeServicesProvider value={services}>
      <HomePlayer data={data} liveProgress={liveProgress} random={() => 0} />
    </HomeServicesProvider>,
  )
  return { services, view, data }
}

const type = (code: string) =>
  fireEvent.keyDown(window, { code, shiftKey: false })
const badge = (lessonTitle: string) =>
  screen.getByRole('button', { name: new RegExp(lessonTitle) }).textContent

describe('HomePlayer', () => {
  beforeEach(() => {
    useHomePlayerStore.setState({
      session: null,
      lesson: null,
      unitId: null,
      selectedUnitId: null,
      courseComplete: false,
      notice: null,
      isReplay: false,
      exercises: [],
    })
  })

  it('opens the resume lesson and saves it as the resume point', async () => {
    const { services } = setup({ resume: { unitId: 'u1', lessonId: 'l2' } })

    await waitFor(() =>
      expect(useHomePlayerStore.getState().lesson?.id).toBe('l2'),
    )
    expect(services.saveResume).toHaveBeenCalledWith({
      unitId: 'u1',
      lessonId: 'l2',
    })
  })

  it('records each exercise in the background and counts it at once', async () => {
    const { services } = setup()
    await waitFor(() =>
      expect(useHomePlayerStore.getState().lesson?.id).toBe('l1'),
    )

    type('KeyR')

    expect(services.recordExercise).toHaveBeenCalledWith({
      lesson: content.units[0].lessons[0],
      result: expect.objectContaining({ exerciseId: 'e1' }),
    })
    expect(badge('First')).toContain('1/1')
  })

  it('moves to the next lesson when a session ends, with a notice', async () => {
    const { services } = setup()
    await waitFor(() =>
      expect(useHomePlayerStore.getState().lesson?.id).toBe('l1'),
    )

    type('KeyR')

    await waitFor(() =>
      expect(useHomePlayerStore.getState().lesson?.id).toBe('l2'),
    )
    expect(services.saveResume).toHaveBeenLastCalledWith({
      unitId: 'u1',
      lessonId: 'l2',
    })
    expect(screen.getByRole('status').textContent).toContain('Next: Second')
    expect(services.recordReplay).not.toHaveBeenCalled()
  })

  it('crosses into the next unit and finishes the course after the last lesson', async () => {
    setup({ resume: { unitId: 'u1', lessonId: 'l2' } })
    await waitFor(() =>
      expect(useHomePlayerStore.getState().lesson?.id).toBe('l2'),
    )

    type('KeyS')
    await waitFor(() => expect(useHomePlayerStore.getState().unitId).toBe('u2'))
    type('KeyE')

    await waitFor(() =>
      expect(useHomePlayerStore.getState().courseComplete).toBe(true),
    )
    expect(screen.getByText(/finished every Home lesson/)).toBeInTheDocument()
  })

  it('submits a replay only for a lesson that was already completed', async () => {
    const { services } = setup({ progress: [completed('l1')] })
    await waitFor(() =>
      expect(useHomePlayerStore.getState().lesson?.id).toBe('l1'),
    )

    type('KeyR')

    expect(services.recordReplay).toHaveBeenCalledWith({
      lessonId: 'l1',
      totals: expect.objectContaining({
        exercisesAttempted: 1,
        acceptedKeystrokes: 1,
      }),
    })
  })

  it('applies live Progress without restarting the session', async () => {
    let resolveLive: (progress: Progress[]) => void = () => {}
    const live = new Promise<Progress[]>((resolve) => {
      resolveLive = resolve
    })
    setup({ resume: { unitId: 'u1', lessonId: 'l1' } }, live)
    await waitFor(() =>
      expect(useHomePlayerStore.getState().lesson?.id).toBe('l1'),
    )
    const session = useHomePlayerStore.getState().session

    await act(async () => resolveLive([completed('l2')]))

    expect(badge('Second')).toContain('1/1')
    expect(useHomePlayerStore.getState().session).toBe(session)
  })

  it('ignores new loader data after mount', async () => {
    const { view, services } = setup()
    await waitFor(() =>
      expect(useHomePlayerStore.getState().lesson?.id).toBe('l1'),
    )
    const session = useHomePlayerStore.getState().session

    view.rerender(
      <HomeServicesProvider value={services}>
        <HomePlayer
          data={{
            content,
            progress: [],
            pendingExerciseIds: {},
            resume: { unitId: 'u2', lessonId: 'l3' },
          }}
          liveProgress={Promise.resolve(null)}
        />
      </HomeServicesProvider>,
    )

    expect(useHomePlayerStore.getState().session).toBe(session)
  })
})
