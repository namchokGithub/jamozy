import { describe, expect, it } from 'vitest'
import { defaultUserProfile } from './user-profile'
import type { Progress } from './progress'
import type { ReviewItem } from './review-item'
import { mergeProfile, mergeProgress, mergeReviewItem } from './guest-migration'

const guestProfile = {
  ...defaultUserProfile('guest-1', new Date('2026-01-01'), 'Guest#0042'),
  exp: 250,
  stats: { lessonsCompleted: 4, wordsPracticed: 12, averageAccuracy: 90, bestAccuracy: 96, averageSpeedWpm: 20, totalTypingTimeSeconds: 500 },
  updatedAt: new Date('2026-01-03'),
}

const progress = (status: Progress['status'], overrides: Partial<Progress> = {}): Progress => ({
  lessonId: 'lesson-1', status, bestAccuracy: 80, bestSpeedWpm: 15, attempts: 2,
  lastAttemptAt: new Date('2026-01-01'), completedAt: null, ...overrides,
})

const review = (overrides: Partial<ReviewItem> = {}): ReviewItem => ({
  id: 'exercise-1', sourceLessonId: 'lesson-1', sourceExerciseId: 'exercise-1', targetText: '가', reason: 'mistake', mistakeCount: 2,
  lastMistakeAt: new Date('2026-01-02'), resolved: false, box: 2, nextReviewAt: new Date('2026-01-05'), ...overrides,
})

describe('guest migration merge rules', () => {
  it('keeps a Cloud baseline and display name even when Guest values are larger', () => {
    const cloud = {
      ...defaultUserProfile('account-1', new Date('2026-01-02'), 'Cloud name'),
      exp: 10,
      legacyBaseline: { exp: 10, stats: defaultUserProfile('x', new Date()).stats },
      updatedAt: new Date('2026-01-04'),
    }

    const merged = mergeProfile(cloud, guestProfile)

    expect(merged).not.toBeNull()
    if (!merged) throw new Error('Expected merged profile')
    expect(merged.displayName).toBe('Cloud name')
    expect(merged.legacyBaseline?.exp).toBe(10)
    expect(merged.exp).toBe(10)
    expect(merged.settings).toEqual(cloud.settings)
  })

  it('uses a Guest baseline when Cloud has no baseline and Guest settings are newer', () => {
    const cloud = { ...defaultUserProfile('account-1', new Date('2026-01-01'), 'Learner'), updatedAt: new Date('2026-01-02') }

    const merged = mergeProfile(cloud, guestProfile)

    expect(merged).not.toBeNull()
    if (!merged) throw new Error('Expected merged profile')
    expect(merged.legacyBaseline?.exp).toBe(250)
    expect(merged.exp).toBe(250)
    expect(merged.settings).toEqual(guestProfile.settings)
  })

  it('keeps the furthest progress and its best results', () => {
    const merged = mergeProgress(
      progress('unlocked', { bestAccuracy: 91, attempts: 3 }),
      progress('completed', { bestSpeedWpm: 21, attempts: 2, completedAt: new Date('2026-01-03') }),
    )

    expect(merged.status).toBe('completed')
    expect(merged.bestAccuracy).toBe(91)
    expect(merged.bestSpeedWpm).toBe(21)
    expect(merged.attempts).toBe(3)
  })

  it('unions Home exercises and keeps Cloud\'s partial result for an incomplete lesson (DEC-043)', () => {
    const cloudPartial = { submissionId: 'cloud', startedAtMs: 1, acceptedKeystrokes: 4, rejectedKeystrokes: 0 }
    const merged = mergeProgress(
      progress('unlocked', { completedExerciseIds: ['e1', 'e2'], homePartialResult: cloudPartial }),
      progress('unlocked', { completedExerciseIds: ['e2', 'e3'], homePartialResult: { ...cloudPartial, submissionId: 'guest' } }),
    )

    expect(merged.completedExerciseIds).toEqual(['e1', 'e2', 'e3'])
    expect(merged.homePartialResult?.submissionId).toBe('cloud')
  })

  it('uses the Guest partial result when Cloud has none (DEC-043)', () => {
    const merged = mergeProgress(
      progress('unlocked'),
      progress('unlocked', { completedExerciseIds: ['e1'], homePartialResult: { submissionId: 'guest', startedAtMs: 1, acceptedKeystrokes: 2, rejectedKeystrokes: 1 } }),
    )

    expect(merged.completedExerciseIds).toEqual(['e1'])
    expect(merged.homePartialResult?.submissionId).toBe('guest')
  })

  it('drops the partial result when either side completed the Home lesson (DEC-043)', () => {
    const merged = mergeProgress(
      progress('unlocked', { completedExerciseIds: ['e1'], homePartialResult: { submissionId: 'cloud', startedAtMs: 1, acceptedKeystrokes: 2, rejectedKeystrokes: 0 } }),
      progress('completed', { completedExerciseIds: ['e1', 'e2'] }),
    )

    expect(merged.status).toBe('completed')
    expect(merged).not.toHaveProperty('homePartialResult')
    expect(merged.completedExerciseIds).toEqual(['e1', 'e2'])
  })

  it('adds no Home fields to Learning Path progress', () => {
    const merged = mergeProgress(progress('unlocked'), progress('completed'))
    expect(merged).not.toHaveProperty('completedExerciseIds')
    expect(merged).not.toHaveProperty('homePartialResult')
  })

  it('never delays review when the Guest item is due sooner', () => {
    const merged = mergeReviewItem(
      review({ nextReviewAt: new Date('2026-01-10'), box: 4, resolved: true }),
      review({ nextReviewAt: new Date('2026-01-05'), box: 2, resolved: false, mistakeCount: 5 }),
    )

    expect(merged.nextReviewAt).toEqual(new Date('2026-01-05'))
    expect(merged.box).toBe(2)
    expect(merged.resolved).toBe(false)
    expect(merged.mistakeCount).toBe(5)
  })
})
