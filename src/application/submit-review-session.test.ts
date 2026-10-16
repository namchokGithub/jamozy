import { describe, expect, it, vi } from 'vitest'
import { submitReviewSession, type SubmitReviewSessionResult } from './submit-review-session'
import { FakeLessonRepository, FakeReviewRepository, FakeSessionSubmissionRepository } from '../test/fakes'
import { FakeUserProfileRepository } from '../test/fakes'
import type { ReviewItem } from '../domain/models/review-item'
import type { Lesson } from '../domain/models/lesson'

function makeLesson(id: string, exercises: Array<[string, Lesson['exercises'][number]['difficulty']]>): Lesson {
  return {
    id,
    unitId: 'u1',
    title: id,
    type: 'word',
    order: 1,
    exercises: exercises.map(([exerciseId, difficulty]) => ({ id: exerciseId, targetText: '가', romanization: null, meaningTh: '', meaningEn: '', difficulty, hint: null })),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeItem(id: string, overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id,
    sourceLessonId: 'l1',
    sourceExerciseId: 'e1',
    targetText: '안녕',
    reason: 'mistake',
    mistakeCount: 1,
    lastMistakeAt: new Date('2026-01-01'),
    resolved: false,
    box: 1,
    nextReviewAt: new Date('2026-01-02'),
    ...overrides,
  }
}

describe('submitReviewSession', () => {
  const now = new Date('2026-01-05')
  const input = (results: SubmitReviewSessionResult[]) => ({ submissionId: 'review-1', startedAtMs: now.getTime(), durationSeconds: 30, exercisesAttempted: results.length, acceptedKeystrokes: results.length, rejectedKeystrokes: 0, results })

  it('advances a correct item and resets an incorrect one, counting each', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await repo.addReviewItem('u1', makeItem('a', { box: 2 }))
    await repo.addReviewItem('u1', makeItem('b', { box: 3 }))

    const outcome = await submitReviewSession(
      { reviewRepo: repo, lessonRepo: new FakeLessonRepository(), sessionSubmissionRepo },
      'u1',
      input([
        { itemId: 'a', wasCorrect: true },
        { itemId: 'b', wasCorrect: false },
      ]),
      now,
    )

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 1 })
    expect(sessionSubmissionRepo.submissions[0]?.effects.reviewItems.map((item) => item.box)).toEqual([3, 1])
  })

  it('marks an item resolved once a correct answer pushes its box to 5, still counting it correct', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await repo.addReviewItem('u1', makeItem('a', { box: 4 }))

    const outcome = await submitReviewSession({ reviewRepo: repo, lessonRepo: new FakeLessonRepository(), sessionSubmissionRepo }, 'u1', input([{ itemId: 'a', wasCorrect: true }]), now)

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 0 })
    expect(sessionSubmissionRepo.submissions[0]?.effects.reviewItems[0]?.resolved).toBe(true)
  })

  it('skips an itemId that does not resolve to a ReviewItem under this uid, without throwing', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await repo.addReviewItem('u1', makeItem('a'))

    const outcome = await submitReviewSession(
      { reviewRepo: repo, lessonRepo: new FakeLessonRepository(), sessionSubmissionRepo },
      'u1',
      input([
        { itemId: 'a', wasCorrect: true },
        { itemId: 'does-not-exist', wasCorrect: true },
      ]),
      now,
    )

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 0 })
  })

  it('never resolves an itemId that belongs to a different user', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await repo.addReviewItem('otherUser', makeItem('a'))

    const outcome = await submitReviewSession({ reviewRepo: repo, lessonRepo: new FakeLessonRepository(), sessionSubmissionRepo }, 'u1', input([{ itemId: 'a', wasCorrect: true }]), now)

    expect(outcome).toEqual({ correctCount: 0, needsPracticeCount: 0 })
    expect(sessionSubmissionRepo.submissions[0]?.effects.reviewItems).toEqual([])
  })

  it("submits stats using each review item's lesson type", async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    const userProfileRepo = new FakeUserProfileRepository()
    await repo.addReviewItem('u1', makeItem('a', { targetText: '안녕 하세요', sourceLessonType: 'sentence' }))
    await repo.addReviewItem('u1', makeItem('b', { targetText: '가' }))
    await submitReviewSession({ reviewRepo: repo, lessonRepo: new FakeLessonRepository(), sessionSubmissionRepo, userProfileRepo }, 'u1', input([{ itemId: 'a', wasCorrect: true, mistakeCount: 0, typingSeconds: 3, elapsedSeconds: 4 }, { itemId: 'b', wasCorrect: false, mistakeCount: 2, typingSeconds: 1, elapsedSeconds: 1 }]), new Date('2026-10-09T01:00:00Z'))
    expect(sessionSubmissionRepo.submissions[0]?.session).toMatchObject({ context: { mode: 'review' }, charactersTyped: 6, sentencesPracticed: 1, wordsPracticed: 0, typingSeconds: 4, exerciseMistakes: [0, 2] })
  })

  it('passes jamo counts to the submission effects', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await repo.addReviewItem('u1', makeItem('a'))
    await submitReviewSession({ reviewRepo: repo, lessonRepo: new FakeLessonRepository(), sessionSubmissionRepo }, 'u1', { ...input([{ itemId: 'a', wasCorrect: true }]), jamoCounts: { ㄱ: { accepted: 1, rejected: 0 } } })
    expect(sessionSubmissionRepo.submissions[0]?.effects.jamoCounts).toEqual({ ㄱ: { accepted: 1, rejected: 0 } })
  })

  it('awards practice EXP for correct items by their source difficulty', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    const lessonRepo = new FakeLessonRepository([makeLesson('L', [['x', 'hard'], ['y', 'medium']])])
    await repo.addReviewItem('u1', makeItem('x', { sourceLessonId: 'L', sourceExerciseId: 'x' }))
    await repo.addReviewItem('u1', makeItem('y', { sourceLessonId: 'L', sourceExerciseId: 'y' }))

    await submitReviewSession({ reviewRepo: repo, lessonRepo, sessionSubmissionRepo }, 'u1', input([{ itemId: 'x', wasCorrect: true }, { itemId: 'y', wasCorrect: false }]), now)

    expect(sessionSubmissionRepo.submissions[0]?.session.expGained).toBe(10)
  })

  it('counts a missing source lesson or exercise as easy', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    const lessonRepo = new FakeLessonRepository([makeLesson('L', [['x', 'hard']])])
    await repo.addReviewItem('u1', makeItem('gone-lesson', { sourceLessonId: 'missing' }))
    await repo.addReviewItem('u1', makeItem('gone-exercise', { sourceLessonId: 'L', sourceExerciseId: 'missing' }))

    await submitReviewSession({ reviewRepo: repo, lessonRepo, sessionSubmissionRepo }, 'u1', input([{ itemId: 'gone-lesson', wasCorrect: true }, { itemId: 'gone-exercise', wasCorrect: true }]), now)

    expect(sessionSubmissionRepo.submissions[0]?.session.expGained).toBe(6)
  })

  it('reads each source lesson once', async () => {
    const repo = new FakeReviewRepository()
    const lessonRepo = new FakeLessonRepository([makeLesson('L', [['x', 'easy'], ['y', 'easy']])])
    const read = vi.spyOn(lessonRepo, 'getLessonById')
    await repo.addReviewItem('u1', makeItem('x', { sourceLessonId: 'L', sourceExerciseId: 'x' }))
    await repo.addReviewItem('u1', makeItem('y', { sourceLessonId: 'L', sourceExerciseId: 'y' }))

    await submitReviewSession({ reviewRepo: repo, lessonRepo, sessionSubmissionRepo: new FakeSessionSubmissionRepository() }, 'u1', input([{ itemId: 'x', wasCorrect: true }, { itemId: 'y', wasCorrect: true }]), now)

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('still saves the review, counting easy, when a source lesson read fails', async () => {
    const repo = new FakeReviewRepository()
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    const lessonRepo = new FakeLessonRepository()
    vi.spyOn(lessonRepo, 'getLessonById').mockRejectedValue(new Error('offline'))
    await repo.addReviewItem('u1', makeItem('a'))

    const outcome = await submitReviewSession({ reviewRepo: repo, lessonRepo, sessionSubmissionRepo }, 'u1', input([{ itemId: 'a', wasCorrect: true }]), now)

    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 0 })
    expect(sessionSubmissionRepo.submissions[0]?.session.expGained).toBe(3)
  })
})
