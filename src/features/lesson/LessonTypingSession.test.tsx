import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import LessonTypingSession, { type LessonCompletion } from './LessonTypingSession'
import { useLessonSessionStore } from '../typing/lesson-session-store'
import type { Lesson } from '../../domain/models/lesson'
import type { CompleteLessonOutcome } from '../../application/complete-lesson'
import type { UserSettings } from '../../domain/models/user-profile'

const { playSound, loadSound, unlockSound } = vi.hoisted(() => ({
  playSound: vi.fn(),
  loadSound: vi.fn(async () => undefined),
  unlockSound: vi.fn(async () => undefined),
}))
vi.mock('../../infrastructure/audio/keyboard-sound-player', () => ({
  keyboardSoundPlayer: { play: playSound, load: loadSound, unlock: unlockSound },
}))

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

function makeKeyboardSettings(
  overrides: Partial<Pick<UserSettings, 'showKeyboard' | 'showEnglishKeys' | 'keyboardOpacity' | 'soundEnabled' | 'keyboardSoundPack'>> = {},
) {
  return { showKeyboard: true, showEnglishKeys: true, keyboardOpacity: 1, soundEnabled: false, keyboardSoundPack: 'turquoise' as const, ...overrides }
}

function renderSession(
  onComplete: (completion: LessonCompletion) => void,
  lesson: Lesson = makeLesson(),
  action: () => Promise<CompleteLessonOutcome | { error: string }> = async () =>
    fakeOutcome,
  keyboardSettings = makeKeyboardSettings(),
) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        Component: () => (
          <LessonTypingSession lesson={lesson} onComplete={onComplete} keyboardSettings={keyboardSettings} />
        ),
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

function waitForTypingTarget(target: string) {
  return screen.findByRole('img', { name: target })
}

describe('LessonTypingSession', () => {
  beforeEach(() => {
    useLessonSessionStore.setState({ session: null })
    playSound.mockClear()
  })

  it('plays the selected pack when a virtual key records an attempt', async () => {
    renderSession(
      vi.fn(),
      makeLesson(),
      undefined,
      makeKeyboardSettings({ soundEnabled: true, keyboardSoundPack: 'mxblack' }),
    )
    await waitForTypingTarget('가')

    fireEvent.click(screen.getByRole('button', { name: 'r' }))

    expect(playSound).toHaveBeenCalledWith('press/GENERIC_R2')
    expect(useLessonSessionStore.getState().session?.currentSession.keyIndex).toBe(1)
  })

  /* it('highlights the current character and updates the composed text on a correct keydown', async () => {
    renderSession(vi.fn())
    await waitForTypingTarget('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    expect(await screen.findByText('Typed: ㄱ')).toBeInTheDocument()
  }) */

  it('hides the keyboard guide when showKeyboard is false', async () => {
    renderSession(vi.fn(), makeLesson(), undefined, makeKeyboardSettings({ showKeyboard: false }))

    await waitForTypingTarget('가')
    expect(screen.queryByText('ㅂ')).not.toBeInTheDocument()
  })

  it('passes the English-label setting and ignores the held opacity setting', async () => {
    renderSession(
      vi.fn(),
      makeLesson(),
      undefined,
      makeKeyboardSettings({ showEnglishKeys: false, keyboardOpacity: 0 }),
    )

    await waitForTypingTarget('가')
    expect(screen.queryByText('r')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Virtual Korean keyboard')).toHaveStyle({ opacity: '1' })
  })

  it('prevents Space scrolling without recording a typing mistake', async () => {
    renderSession(vi.fn())
    await waitForTypingTarget('가')
    const spaceEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      code: 'Space',
    })

    const wasNotPrevented = window.dispatchEvent(spaceEvent)

    expect(wasNotPrevented).toBe(false)
    expect(useLessonSessionStore.getState().session?.currentSession).toMatchObject({
      keyIndex: 0,
      mistakes: [],
    })
  })

  it('submits the aggregated result and calls onComplete once the lesson finishes', async () => {
    const onComplete = vi.fn()
    renderSession(onComplete)
    await waitForTypingTarget('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      outcome: expect.objectContaining({ expGained: 100, level: 2 }),
      result: expect.objectContaining({ accuracy: 100, mistakes: [] }),
    }))
  })

  it('offers a retry when saving fails, then completes with the same submission', async () => {
    const onComplete = vi.fn()
    const action = vi
      .fn<() => Promise<CompleteLessonOutcome | { error: string }>>()
      .mockResolvedValueOnce({ error: 'Your result could not be saved.' })
      .mockResolvedValue(fakeOutcome)
    renderSession(onComplete, makeLesson(), action)
    await waitForTypingTarget('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be saved')
    expect(onComplete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(action).toHaveBeenCalledTimes(2)
  })

  it('submits the action exactly once even if extra keydowns fire after completion', async () => {
    const actionSpy = vi.fn(async () => fakeOutcome)
    renderSession(vi.fn(), makeLesson(), actionSpy)
    await waitForTypingTarget('가')

    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })
    // pressKey already no-ops once the exercise/lesson is complete — these must not cause a second submit
    fireEvent.keyDown(window, { code: 'KeyR', shiftKey: false })
    fireEvent.keyDown(window, { code: 'KeyK', shiftKey: false })

    await waitFor(() => expect(actionSpy).toHaveBeenCalledTimes(1))
  })

  it('stops handling keydowns after unmount', async () => {
    const { unmount } = renderSession(vi.fn())
    await waitForTypingTarget('가')

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
    await waitForTypingTarget('가')

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
    await waitForTypingTarget('나')

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
