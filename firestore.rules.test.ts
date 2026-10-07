import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore'
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest'

const projectId = 'jamozy-rules-test'
const now = new Date('2026-09-29T00:00:00.000Z')

let testEnvironment: RulesTestEnvironment
const describeWithFirestoreEmulator = process.env.FIRESTORE_EMULATOR_HOST
  ? describe
  : describe.skip

async function seedContent() {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    const batch = writeBatch(db)

    const course = (id: string, status: 'draft' | 'published') =>
      batch.set(doc(db, 'courses', id), {
        title: id,
        description: 'Course description',
        order: 0,
        status,
        createdAt: now,
        updatedAt: now,
      })
    const unit = (
      id: string,
      courseId: string,
      status: 'draft' | 'published',
    ) =>
      batch.set(doc(db, 'units', id), {
        courseId,
        title: id,
        description: 'Unit description',
        order: 0,
        status,
        createdAt: now,
        updatedAt: now,
      })
    const lesson = (
      id: string,
      unitId: string,
      status: 'draft' | 'published',
    ) =>
      batch.set(doc(db, 'lessons', id), {
        unitId,
        title: id,
        type: 'word',
        order: 0,
        status,
        exercises: [],
        createdAt: now,
        updatedAt: now,
      })

    course('published-course', 'published')
    course('draft-course', 'draft')
    unit('published-unit', 'published-course', 'published')
    unit('draft-unit', 'published-course', 'draft')
    unit('unit-in-draft-course', 'draft-course', 'published')
    lesson('published-lesson', 'published-unit', 'published')
    lesson('draft-lesson', 'published-unit', 'draft')
    lesson('lesson-in-draft-unit', 'draft-unit', 'published')
    lesson('lesson-in-draft-course', 'unit-in-draft-course', 'published')

    await batch.commit()
  })
}

describeWithFirestoreEmulator('Firestore content Rules', () => {
  beforeAll(async () => {
    testEnvironment = await initializeTestEnvironment({
      projectId,
      firestore: {
        rules: readFileSync(resolve('firestore.rules'), 'utf8'),
      },
    })
  })

  beforeEach(seedContent)

  afterEach(async () => {
    await testEnvironment.clearFirestore()
  })

  afterAll(async () => {
    await testEnvironment.cleanup()
  })

  it('allows anonymous learners to read only published content with published ancestors', async () => {
    const db = testEnvironment.unauthenticatedContext().firestore()

    await assertSucceeds(getDoc(doc(db, 'courses', 'published-course')))
    await assertFails(getDoc(doc(db, 'courses', 'draft-course')))
    await assertSucceeds(getDoc(doc(db, 'units', 'published-unit')))
    await assertFails(getDoc(doc(db, 'units', 'unit-in-draft-course')))
    await assertSucceeds(getDoc(doc(db, 'lessons', 'published-lesson')))
    await assertFails(getDoc(doc(db, 'lessons', 'draft-lesson')))
    await assertFails(getDoc(doc(db, 'lessons', 'lesson-in-draft-unit')))
    await assertFails(getDoc(doc(db, 'lessons', 'lesson-in-draft-course')))
  })

  it('denies learner writes to content', async () => {
    const db = testEnvironment.authenticatedContext('learner-1').firestore()

    await assertFails(
      setDoc(doc(db, 'courses', 'learner-course'), {
        title: 'Learner course',
        description: 'Must not be written',
        order: 1,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      }),
    )
    await assertFails(
      setDoc(doc(db, 'units', 'learner-unit'), {
        courseId: 'published-course',
        title: 'Learner unit',
        description: 'Must not be written',
        order: 1,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      }),
    )
    await assertFails(
      setDoc(doc(db, 'lessons', 'learner-lesson'), {
        unitId: 'published-unit',
        title: 'Learner lesson',
        type: 'word',
        order: 1,
        status: 'draft',
        exercises: [],
        createdAt: now,
        updatedAt: now,
      }),
    )
  })

  it('allows an admin to read draft content and write content', async () => {
    const db = testEnvironment
      .authenticatedContext('admin-1', { admin: true })
      .firestore()

    await assertSucceeds(getDoc(doc(db, 'courses', 'draft-course')))
    await assertSucceeds(
      setDoc(doc(db, 'courses', 'admin-course'), {
        title: 'Admin course',
        description: 'Owner content',
        order: 1,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      }),
    )
    await assertSucceeds(
      setDoc(doc(db, 'units', 'admin-unit'), {
        courseId: 'admin-course',
        title: 'Admin unit',
        description: 'Owner content',
        order: 0,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      }),
    )
    await assertSucceeds(
      setDoc(doc(db, 'lessons', 'admin-lesson'), {
        unitId: 'admin-unit',
        title: 'Admin lesson',
        type: 'word',
        order: 0,
        status: 'draft',
        exercises: [],
        createdAt: now,
        updatedAt: now,
      }),
    )
    await assertSucceeds(
      setDoc(doc(db, 'courses', 'draft-course'), { status: 'archived' }, { merge: true }),
    )
  })

  it('denies hard-deleting content, even for an admin (DEC-034)', async () => {
    const db = testEnvironment
      .authenticatedContext('admin-1', { admin: true })
      .firestore()

    await assertFails(deleteDoc(doc(db, 'courses', 'draft-course')))
    await assertFails(deleteDoc(doc(db, 'units', 'draft-unit')))
    await assertFails(deleteDoc(doc(db, 'lessons', 'draft-lesson')))
  })
})
