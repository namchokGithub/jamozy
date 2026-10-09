import { describe, expect, it } from 'vitest'
import { createSubmitWeakJamoSessionAction } from './WeakJamoPage.action'
import { FakeSessionSubmissionRepository } from '../../test/fakes'

const request = (body: unknown) =>
  new Request('http://localhost/review/weak-jamo', {
    method: 'POST',
    body: JSON.stringify(body),
  })
const body = {
  submissionId: 's1',
  startedAtMs: 0,
  durationSeconds: 1,
  exercisesAttempted: 0,
  acceptedKeystrokes: 0,
  rejectedKeystrokes: 0,
  results: [],
  jamoCounts: { x: { accepted: -1, rejected: 0 } },
}

describe('createSubmitWeakJamoSessionAction', () => {
  it('drops invalid jamo counts and still submits', async () => {
    const sessionSubmissionRepo = new FakeSessionSubmissionRepository()
    const action = createSubmitWeakJamoSessionAction({ sessionSubmissionRepo, ensureUser: async () => ({ uid: 'u1' }) })
    expect(await action({ request: request(body) } as never)).toEqual({ correctCount: 0, needsPracticeCount: 0 })
    expect(sessionSubmissionRepo.submissions[0].effects).not.toHaveProperty('jamoCounts')
  })

  it('returns an error object when saving fails', async () => {
    const action = createSubmitWeakJamoSessionAction({
      sessionSubmissionRepo: { submit: async () => { throw new Error('offline') } },
      ensureUser: async () => ({ uid: 'u1' }),
    })
    expect(await action({ request: request(body) } as never)).toHaveProperty('error')
  })

  it('rejects a malformed body', async () => {
    const action = createSubmitWeakJamoSessionAction({ sessionSubmissionRepo: new FakeSessionSubmissionRepository(), ensureUser: async () => ({ uid: 'u1' }) })
    await expect(action({ request: request({ submissionId: 1 }) } as never)).rejects.toThrow()
  })
})
