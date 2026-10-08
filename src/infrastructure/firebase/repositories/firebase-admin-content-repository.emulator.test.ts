import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, setDoc, type Firestore } from 'firebase/firestore'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { courseCounts } from '../../../domain/models/course'
import { FirebaseAdminContentRepository } from './firebase-admin-content-repository'
import firestoreRules from '../../../../firestore.rules?raw'

// Runs only inside `pnpm test:rules`, which starts the Firestore Emulator.
// `src` has no Node types, so read the variable through globalThis.
const emulatorHost = (
  globalThis as { process?: { env: Record<string, string | undefined> } }
).process?.env.FIRESTORE_EMULATOR_HOST
const describeWithFirestoreEmulator = emulatorHost ? describe : describe.skip

const now = new Date('2026-10-08T00:00:00.000Z')
let testEnvironment: RulesTestEnvironment

function adminRepository() {
  // Typed as the compat instance; modular functions unwrap it at runtime.
  const firestore = testEnvironment
    .authenticatedContext('admin-1', { admin: true })
    .firestore() as unknown as Firestore
  return { firestore, repo: new FirebaseAdminContentRepository(firestore) }
}

describeWithFirestoreEmulator('FirebaseAdminContentRepository counters', () => {
  beforeAll(async () => {
    testEnvironment = await initializeTestEnvironment({
      // Separate from firestore.rules.test.ts, which runs in parallel and
      // seeds and clears its own project.
      projectId: 'jamozy-repository-test',
      firestore: { rules: firestoreRules },
    })
  })

  afterEach(async () => {
    await testEnvironment.clearFirestore()
  })

  afterAll(async () => {
    await testEnvironment.cleanup()
  })

  it('reads a Course without counters as zero and keeps stored counters', async () => {
    const { firestore, repo } = adminRepository()
    const course = {
      description: 'Description',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(doc(firestore, 'courses', 'legacy'), {
      ...course,
      title: 'Legacy',
      order: 0,
    })
    await setDoc(doc(firestore, 'courses', 'counted'), {
      ...course,
      title: 'Counted',
      order: 1,
      unitCount: 2,
      lessonCount: 5,
      exerciseCount: 40,
    })

    const courses = await repo.getCourses()
    const legacy = courses.find((course) => course.id === 'legacy')!
    const counted = courses.find((course) => course.id === 'counted')!

    expect(legacy.unitCount).toBeUndefined()
    expect(courseCounts(legacy)).toEqual({ units: 0, lessons: 0, exercises: 0 })
    expect(courseCounts(counted)).toEqual({
      units: 2,
      lessons: 5,
      exercises: 40,
    })
  })
})
