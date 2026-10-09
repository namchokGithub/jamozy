import { describe, expect, it } from 'vitest'
import { submitWeakJamoSession } from './submit-weak-jamo-session'
import { FakeSessionSubmissionRepository } from '../test/fakes'

const input = {
  submissionId: 'wj-1',
  startedAtMs: 0,
  durationSeconds: 20,
  exercisesAttempted: 2,
  acceptedKeystrokes: 6,
  rejectedKeystrokes: 1,
  results: [
    { exerciseId: 'l1:e1', targetText: '거기', lessonType: 'word' as const, wasCorrect: true, mistakeCount: 0, typingSeconds: 2, elapsedSeconds: 3 },
    { exerciseId: 'l2:e1', targetText: '어 어', lessonType: 'sentence' as const, wasCorrect: false, mistakeCount: 1, typingSeconds: 3, elapsedSeconds: 4 },
  ],
}

describe('submitWeakJamoSession', () => {
  it('submits a weak-jamo session with stats and no learner-state effects', async () => {
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    const outcome = await submitWeakJamoSession(
      { sessionSubmissionRepo },
      'u1',
      { ...input, jamoCounts: { ㅓ: { accepted: 4, rejected: 1 } } },
      new Date('2026-10-09T01:00:00Z'),
    )
    expect(outcome).toEqual({ correctCount: 1, needsPracticeCount: 1 })
    const [submission] = sessionSubmissionRepo.submissions
    expect(submission.session).toMatchObject({
      id: 'wj-1',
      context: { mode: 'weak-jamo' },
      expGained: 0,
      charactersTyped: 4,
      wordsPracticed: 1,
      sentencesPracticed: 1,
      typingSeconds: 5,
      exerciseMistakes: [0, 1],
    })
    expect(submission.effects).toEqual({
      progress: [],
      reviewItems: [],
      jamoCounts: { ㅓ: { accepted: 4, rejected: 1 } },
    })
  })

  it('omits jamoCounts when absent', async () => {
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    await submitWeakJamoSession({ sessionSubmissionRepo }, 'u1', input)
    expect(sessionSubmissionRepo.submissions[0].effects).not.toHaveProperty('jamoCounts')
  })
})
