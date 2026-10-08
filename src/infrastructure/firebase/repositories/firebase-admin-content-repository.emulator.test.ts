import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, type Firestore } from 'firebase/firestore'
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

  describe('creates count their new child', () => {
    it('starts a new Course at zero', async () => {
      const { firestore, repo } = adminRepository()
      const created = await repo.createCourse({
        title: 'New',
        description: 'Description',
      })

      expect(
        (await getDoc(doc(firestore, 'courses', created.id))).data(),
      ).toMatchObject({ unitCount: 0, lessonCount: 0, exerciseCount: 0 })
    })

    it('counts a new Unit on its Course', async () => {
      const { firestore, repo } = adminRepository()
      const course = await repo.createCourse({
        title: 'Course',
        description: 'Description',
      })

      const unit = await repo.createUnit({
        courseId: course.id,
        title: 'Unit',
        description: 'Description',
      })

      expect(
        (await getDoc(doc(firestore, 'units', unit.id))).data(),
      ).toMatchObject({ lessonCount: 0, exerciseCount: 0 })
      expect(
        (await getDoc(doc(firestore, 'courses', course.id))).data(),
      ).toMatchObject({ unitCount: 1, lessonCount: 0 })
    })

    it('counts a new Lesson on its Unit and Course', async () => {
      const { firestore, repo } = adminRepository()
      const course = await repo.createCourse({
        title: 'Course',
        description: 'Description',
      })
      const unit = await repo.createUnit({
        courseId: course.id,
        title: 'Unit',
        description: 'Description',
      })

      const lesson = await repo.createLesson({
        unitId: unit.id,
        title: 'Lesson',
        type: 'word',
      })
      await repo.createLesson({
        unitId: unit.id,
        title: 'Lesson 2',
        type: 'word',
      })

      expect(
        (await getDoc(doc(firestore, 'lessons', lesson.id))).data(),
      ).toMatchObject({ exerciseCount: 0 })
      expect(
        (await getDoc(doc(firestore, 'units', unit.id))).data(),
      ).toMatchObject({ lessonCount: 2 })
      expect(
        (await getDoc(doc(firestore, 'courses', course.id))).data(),
      ).toMatchObject({ unitCount: 1, lessonCount: 2 })
    })
  })

  describe('lesson writes apply the Exercise delta', () => {
    const base = { description: 'Description', createdAt: now, updatedAt: now }
    const exercise = (id: string) => ({
      id,
      targetText: '가',
      romanization: null,
      meaningTh: '',
      meaningEn: '',
      difficulty: 'easy' as const,
      hint: null,
    })

    async function seed(firestore: Firestore) {
      await setDoc(doc(firestore, 'courses', 'course'), {
        ...base,
        title: 'Course',
        order: 0,
        status: 'draft',
        exerciseCount: 1,
      })
      await setDoc(doc(firestore, 'units', 'unit'), {
        ...base,
        courseId: 'course',
        title: 'Unit',
        order: 0,
        status: 'draft',
        exerciseCount: 1,
      })
      await setDoc(doc(firestore, 'lessons', 'lesson'), {
        unitId: 'unit',
        title: 'Lesson',
        type: 'word',
        order: 5,
        status: 'draft',
        exercises: [exercise('a')],
        createdAt: now,
        updatedAt: now,
      })
    }

    async function counts(firestore: Firestore) {
      const read = async (path: string, id: string) =>
        (await getDoc(doc(firestore, path, id))).data()?.exerciseCount
      return {
        lesson: await read('lessons', 'lesson'),
        unit: await read('units', 'unit'),
        course: await read('courses', 'course'),
      }
    }

    it('adds the new Exercises to the Unit and Course and keeps order', async () => {
      const { firestore, repo } = adminRepository()
      await seed(firestore)
      const lesson = (await repo.getLessonById('lesson'))!

      await repo.saveLesson({
        ...lesson,
        order: 0,
        exercises: [exercise('a'), exercise('b'), exercise('c')],
      })

      expect(await counts(firestore)).toEqual({ lesson: 3, unit: 3, course: 3 })
      expect(
        (await getDoc(doc(firestore, 'lessons', 'lesson'))).data()?.order,
      ).toBe(5)
    })

    it('leaves parents unchanged when the Exercises do not change', async () => {
      const { firestore, repo } = adminRepository()
      await seed(firestore)
      const lesson = (await repo.getLessonById('lesson'))!

      await repo.saveLesson({ ...lesson, status: 'archived' })

      expect(await counts(firestore)).toEqual({ lesson: 1, unit: 1, course: 1 })
    })

    it('applies the delta for Lessons written through saveContent', async () => {
      const { firestore, repo } = adminRepository()
      await seed(firestore)
      const course = (await repo.getCourseById('course'))!
      const unit = (await repo.getUnitById('unit'))!
      const lesson = (await repo.getLessonById('lesson'))!

      await repo.saveContent({
        courses: [{ ...course, status: 'published' }],
        units: [{ ...unit, status: 'published' }],
        lessons: [
          {
            ...lesson,
            status: 'published',
            exercises: [exercise('a'), exercise('b')],
          },
        ],
      })

      expect(await counts(firestore)).toEqual({ lesson: 2, unit: 2, course: 2 })
      expect(
        (await getDoc(doc(firestore, 'courses', 'course'))).data()?.status,
      ).toBe('published')
    })
  })

  describe('creates take the order after the last sibling', () => {
    const base = { description: 'Description', createdAt: now, updatedAt: now }

    it('places a new Course, Unit, and Lesson after the highest order', async () => {
      const { firestore, repo } = adminRepository()
      await setDoc(doc(firestore, 'courses', 'a'), {
        ...base,
        title: 'A',
        order: 0,
        status: 'draft',
      })
      await setDoc(doc(firestore, 'courses', 'b'), {
        ...base,
        title: 'B',
        order: 4,
        status: 'draft',
      })
      await setDoc(doc(firestore, 'units', 'unit'), {
        ...base,
        courseId: 'a',
        title: 'Unit',
        order: 7,
        status: 'draft',
      })
      await setDoc(doc(firestore, 'units', 'elsewhere'), {
        ...base,
        courseId: 'b',
        title: 'Other course',
        order: 30,
        status: 'draft',
      })
      await setDoc(doc(firestore, 'lessons', 'lesson'), {
        unitId: 'unit',
        title: 'Lesson',
        type: 'word',
        order: 2,
        status: 'draft',
        exercises: [],
        createdAt: now,
        updatedAt: now,
      })

      const course = await repo.createCourse({
        title: 'C',
        description: 'Description',
      })
      const unit = await repo.createUnit({
        courseId: 'a',
        title: 'Unit 2',
        description: 'Description',
      })
      const lesson = await repo.createLesson({
        unitId: 'unit',
        title: 'Lesson 2',
        type: 'word',
      })
      const firstLesson = await repo.createLesson({
        unitId: unit.id,
        title: 'First',
        type: 'word',
      })

      expect(course.order).toBe(5)
      expect(unit.order).toBe(8)
      expect(lesson.order).toBe(3)
      expect(firstLesson.order).toBe(0)
    })
  })

  describe('order saves', () => {
    const unitDoc = (title: string, order: number) => ({
      description: 'Description',
      createdAt: now,
      updatedAt: now,
      courseId: 'course',
      title,
      order,
      status: 'draft',
    })

    async function seedUnits(firestore: Firestore) {
      await setDoc(doc(firestore, 'units', 'a'), unitDoc('A', 0))
      await setDoc(doc(firestore, 'units', 'b'), unitDoc('B', 1))
      await setDoc(doc(firestore, 'units', 'c'), unitDoc('C', 2))
    }

    it('writes the whole new order', async () => {
      const { firestore, repo } = adminRepository()
      await seedUnits(firestore)

      await repo.saveUnitOrder('course', ['c', 'a', 'b'])

      expect(
        (await repo.getUnitsByCourseId('course')).map((unit) => unit.id),
      ).toEqual(['c', 'a', 'b'])
    })

    it('rejects an order whose IDs differ from the siblings and writes nothing', async () => {
      const { firestore, repo } = adminRepository()
      await seedUnits(firestore)

      await expect(repo.saveUnitOrder('course', ['c', 'a'])).rejects.toThrow(
        'Content order changed. Refresh and try again.',
      )
      expect(
        (await repo.getUnitsByCourseId('course')).map((unit) => unit.id),
      ).toEqual(['a', 'b', 'c'])
    })
  })

  describe('content saves never overwrite counters', () => {
    const base = { description: 'Description', createdAt: now, updatedAt: now }

    it('saveCourse writes only editable fields', async () => {
      const { firestore, repo } = adminRepository()
      await setDoc(doc(firestore, 'courses', 'course'), {
        ...base,
        title: 'Old',
        order: 7,
        status: 'archived',
        archivedFromStatus: 'published',
        unitCount: 3,
        lessonCount: 9,
        exerciseCount: 50,
      })
      const stale = (await repo.getCourseById('course'))!

      await repo.saveCourse({
        ...stale,
        title: 'New',
        order: 0,
        unitCount: 0,
        lessonCount: 0,
        exerciseCount: 0,
        status: 'published',
        archivedFromStatus: undefined,
      })

      const stored = (await getDoc(doc(firestore, 'courses', 'course'))).data()
      expect(stored).toMatchObject({
        title: 'New',
        status: 'published',
        order: 7,
        unitCount: 3,
        lessonCount: 9,
        exerciseCount: 50,
      })
      expect(stored).not.toHaveProperty('archivedFromStatus')
    })

    it('saveUnit writes only editable fields', async () => {
      const { firestore, repo } = adminRepository()
      await setDoc(doc(firestore, 'units', 'unit'), {
        ...base,
        courseId: 'course',
        title: 'Old',
        order: 4,
        status: 'draft',
        lessonCount: 2,
        exerciseCount: 12,
      })
      const stale = (await repo.getUnitById('unit'))!

      await repo.saveUnit({
        ...stale,
        title: 'New',
        order: 0,
        lessonCount: 0,
        exerciseCount: 0,
      })

      expect(
        (await getDoc(doc(firestore, 'units', 'unit'))).data(),
      ).toMatchObject({
        title: 'New',
        order: 4,
        lessonCount: 2,
        exerciseCount: 12,
      })
    })

    it('saveContent keeps Course and Unit counters', async () => {
      const { firestore, repo } = adminRepository()
      await setDoc(doc(firestore, 'courses', 'course'), {
        ...base,
        title: 'Course',
        order: 0,
        status: 'draft',
        unitCount: 1,
      })
      await setDoc(doc(firestore, 'units', 'unit'), {
        ...base,
        courseId: 'course',
        title: 'Unit',
        order: 0,
        status: 'draft',
        lessonCount: 2,
      })
      const course = (await repo.getCourseById('course'))!
      const unit = (await repo.getUnitById('unit'))!

      await repo.saveContent({
        courses: [{ ...course, status: 'published', unitCount: 0 }],
        units: [{ ...unit, status: 'published', lessonCount: 0 }],
      })

      expect(
        (await getDoc(doc(firestore, 'courses', 'course'))).data(),
      ).toMatchObject({ status: 'published', unitCount: 1 })
      expect(
        (await getDoc(doc(firestore, 'units', 'unit'))).data(),
      ).toMatchObject({ status: 'published', lessonCount: 2 })
    })
  })
})
