import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, runTransaction, type Firestore } from 'firebase/firestore'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { LearningSession } from '../../../domain/models/learning-session'
import { FirebaseSessionSubmissionRepository } from './firebase-session-submission-repository'
import { FirebaseJamoStatsRepository } from './firestore-jamo-stats'
import firestoreRules from '../../../../firestore.rules?raw'

const emulatorHost = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.FIRESTORE_EMULATOR_HOST
const describeWithFirestoreEmulator = emulatorHost ? describe : describe.skip
let testEnvironment: RulesTestEnvironment

function learnerRepository(uid = 'learner-1') {
  const firestore = testEnvironment.authenticatedContext(uid).firestore() as unknown as Firestore
  return { firestore, repo: new FirebaseSessionSubmissionRepository({ db: firestore, doc, runTransaction }) }
}

const session: LearningSession = {
  id: 'session-1', context: { mode: 'learning-path', lessonId: 'lesson-1' }, startedAt: new Date('2026-10-09T01:00:00Z'), completedAt: new Date('2026-10-09T01:05:00Z'), durationSeconds: 300, exercisesAttempted: 2, acceptedKeystrokes: 20, rejectedKeystrokes: 0, expGained: 25, localDate: '2026-10-09', timeZone: 'Asia/Bangkok', typingSeconds: 60, charactersTyped: 4, wordsPracticed: 2, sentencesPracticed: 0, exerciseMistakes: [0, 0],
}
const noEffects = { progress: [], reviewItems: [] }

describeWithFirestoreEmulator('FirebaseSessionSubmissionRepository player stats', () => {
  beforeAll(async () => {
    testEnvironment = await initializeTestEnvironment({ projectId: 'jamozy-stats-test', firestore: { rules: firestoreRules } })
  })
  afterEach(async () => { await testEnvironment.clearFirestore() })
  afterAll(async () => { await testEnvironment.cleanup() })

  it('writes daily, monthly, and profile stats once per session ID', async () => {
    const { firestore, repo } = learnerRepository()
    await repo.submit('learner-1', session, noEffects)
    await repo.submit('learner-1', session, noEffects)
    const daily = (await getDoc(doc(firestore, 'users/learner-1/dailyStats/2026-10-09'))).data()
    const monthly = (await getDoc(doc(firestore, 'users/learner-1/monthlyStats/2026-10'))).data()
    const profile = (await getDoc(doc(firestore, 'users/learner-1'))).data()
    expect(daily).toMatchObject({ expEarned: 25, lessonsCompleted: 1, perfectLessons: 1, typingSeconds: 60 })
    expect(monthly).toMatchObject({ expEarned: 25 })
    expect(profile).toMatchObject({ timezone: 'Asia/Bangkok', playerStats: { activeDays: 1, streak: { current: 1, lastActiveDate: '2026-10-09' } }, sessionAggregate: { lessonsCompleted: 1, typingSeconds: 60 } })
  })

  it('adds a second session on the same day into the same docs', async () => {
    const { firestore, repo } = learnerRepository()
    await repo.submit('learner-1', session, noEffects)
    await repo.submit('learner-1', { ...session, id: 'session-2' }, noEffects)
    const daily = (await getDoc(doc(firestore, 'users/learner-1/dailyStats/2026-10-09'))).data()
    expect(daily).toMatchObject({ expEarned: 50, lessonsCompleted: 2 })
  })

  it('lets only the owner read stats docs', async () => {
    const { repo } = learnerRepository()
    await repo.submit('learner-1', session, noEffects)
    const other = testEnvironment.authenticatedContext('learner-2').firestore() as unknown as Firestore
    await assertFails(getDoc(doc(other, 'users/learner-1/dailyStats/2026-10-09')))
    await assertFails(getDoc(doc(other, 'users/learner-1/monthlyStats/2026-10')))
  })

  const jamoEffects = {
    progress: [],
    reviewItems: [],
    jamoCounts: { ㄱ: { accepted: 2, rejected: 1 }, ㅏ: { accepted: 2, rejected: 0 } },
  }

  it('writes jamo stats once per session ID and keeps firstPracticedAt', async () => {
    const { firestore, repo } = learnerRepository()
    await repo.submit('learner-1', session, jamoEffects)
    await repo.submit('learner-1', session, jamoEffects) // retry: no double count
    const later = { ...session, id: 'session-2', completedAt: new Date('2026-10-10T01:00:00Z') }
    await repo.submit('learner-1', later, jamoEffects) // reads stored Timestamps back

    const data = (await getDoc(doc(firestore, 'users/learner-1/learnerStats/jamo'))).data()
    expect(data?.jamo.ㄱ).toMatchObject({ acceptedKeystrokes: 4, rejectedKeystrokes: 2 })
    expect(data?.jamo.ㄱ.firstPracticedAt.toDate()).toEqual(session.completedAt)
    expect(data?.jamo.ㄱ.lastPracticedAt.toDate()).toEqual(later.completedAt)
  })

  it('does not create the jamo doc without counts', async () => {
    const { firestore, repo } = learnerRepository()
    await repo.submit('learner-1', session, noEffects)
    expect((await getDoc(doc(firestore, 'users/learner-1/learnerStats/jamo'))).exists()).toBe(false)
  })

  it('lets only the owner read learnerStats', async () => {
    const { repo } = learnerRepository()
    await repo.submit('learner-1', session, jamoEffects)
    const other = testEnvironment.authenticatedContext('learner-2').firestore() as unknown as Firestore
    await assertFails(getDoc(doc(other, 'users/learner-1/learnerStats/jamo')))
  })

  it('reads jamo stats back as Dates, and {} without a doc', async () => {
    const { firestore, repo } = learnerRepository()
    const reader = new FirebaseJamoStatsRepository(firestore)
    expect(await reader.getJamoStats('learner-1')).toEqual({})
    await repo.submit('learner-1', session, jamoEffects)
    const stats = await reader.getJamoStats('learner-1')
    expect(stats.ㄱ).toMatchObject({ acceptedKeystrokes: 2, rejectedKeystrokes: 1 })
    expect(stats.ㄱ.firstPracticedAt).toBeInstanceOf(Date)
  })
})
