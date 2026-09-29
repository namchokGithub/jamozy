import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LessonResult from './LessonResult'
import type { LessonCompletion } from './LessonTypingSession'

const completion: LessonCompletion = {
  outcome: {
    progress: { lessonId: 'l1', status: 'completed', bestAccuracy: 100, bestSpeedWpm: 20, attempts: 1, lastAttemptAt: new Date(), completedAt: new Date() },
    expGained: 120,
    level: 2,
    unlockedNextLessonId: 'l2',
  },
  result: { accuracy: 92.5, speedWpm: 24.7, durationSeconds: 18.4, startedAtMs: 0, exercisesAttempted: 2, acceptedKeystrokes: 10, rejectedKeystrokes: 2, mistakes: [{ sourceExerciseId: 'e1', targetText: '가' }, { sourceExerciseId: 'e2', targetText: '가' }] },
}

describe('LessonResult', () => {
  it('summarizes completion and delegates retry, review, and continue actions', () => {
    const onRetry = vi.fn()
    const onReview = vi.fn()
    const onContinue = vi.fn()
    render(<LessonResult completion={completion} onRetry={onRetry} onReview={onReview} onContinue={onContinue} />)

    expect(screen.getByText('Lesson complete!')).toBeInTheDocument()
    expect(screen.getByText('+120 EXP — now level 2')).toBeInTheDocument()
    const summary = screen.getByLabelText('Lesson results')
    expect(summary).toHaveTextContent('Accuracy 93%')
    expect(within(summary).getAllByText('가')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next Lesson' }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(onReview).toHaveBeenCalledOnce()
    expect(onContinue).toHaveBeenCalledOnce()
  })
})
