import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore'
import { db } from '../firebase'
import type {
  AdminContentChanges,
  AdminContentRepository,
} from '../../../domain/repositories/admin-content-repository'
import type { Course, CourseType } from '../../../domain/models/course'
import type { Lesson } from '../../../domain/models/lesson'
import type { Unit } from '../../../domain/models/unit'
import type {
  ContentStatus,
  RestorableContentStatus,
} from '../../../domain/models/content-status'

const ORDER_CHANGED = 'Content order changed. Refresh and try again.'

function date(value: unknown): Date {
  return value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
    ? (value as { toDate(): Date }).toDate()
    : new Date()
}

function statusFields(data: DocumentData) {
  return {
    status: (data.status as ContentStatus | undefined) ?? 'draft',
    ...(data.archivedFromStatus
      ? {
          archivedFromStatus:
            data.archivedFromStatus as RestorableContentStatus,
        }
      : {}),
  }
}

// Copies only stored counters: an absent counter stays absent, because
// writing a guessed 0 back would look like a real count before the backfill.
function counterFields<K extends string>(
  data: DocumentData,
  keys: readonly K[],
): Partial<Record<K, number>> {
  return Object.fromEntries(
    keys
      .filter((key) => typeof data[key] === 'number')
      .map((key) => [key, data[key] as number]),
  ) as Partial<Record<K, number>>
}

function toCourse(id: string, data: DocumentData): Course {
  return {
    id,
    title: data.title,
    description: data.description,
    order: data.order,
    ...(data.type === 'home' || data.type === 'learning'
      ? { type: data.type as CourseType }
      : {}),
    ...counterFields(data, ['unitCount', 'lessonCount', 'exerciseCount']),
    createdAt: date(data.createdAt),
    updatedAt: date(data.updatedAt),
    ...statusFields(data),
  }
}

function toUnit(id: string, data: DocumentData): Unit {
  return {
    id,
    courseId: data.courseId,
    title: data.title,
    description: data.description,
    order: data.order,
    ...counterFields(data, ['lessonCount', 'exerciseCount']),
    createdAt: date(data.createdAt),
    updatedAt: date(data.updatedAt),
    ...statusFields(data),
  }
}

function toLesson(id: string, data: DocumentData): Lesson {
  return {
    id,
    unitId: data.unitId,
    title: data.title,
    type: data.type,
    order: data.order,
    exercises: data.exercises ?? [],
    ...counterFields(data, ['exerciseCount']),
    createdAt: date(data.createdAt),
    updatedAt: date(data.updatedAt),
    ...statusFields(data),
  }
}

function serialize<T extends { id: string; createdAt: Date; updatedAt: Date }>(
  value: T,
): Omit<T, 'id'> {
  const { id, archivedFromStatus, ...data } = value as T & {
    archivedFromStatus?: unknown
  }
  void id
  return (
    archivedFromStatus === undefined ? data : { ...data, archivedFromStatus }
  ) as Omit<T, 'id'>
}

export class FirebaseAdminContentRepository implements AdminContentRepository {
  // Injectable so emulator tests can pass their own Firestore instance.
  constructor(private readonly firestore: Firestore = db) {}

  async getCourses(): Promise<Course[]> {
    const snapshot = await getDocs(
      query(collection(this.firestore, 'courses'), orderBy('order')),
    )
    return snapshot.docs.map((item) => toCourse(item.id, item.data()))
  }

  async getCourseById(courseId: string): Promise<Course | null> {
    const snapshot = await getDoc(doc(this.firestore, 'courses', courseId))
    return snapshot.exists() ? toCourse(snapshot.id, snapshot.data()) : null
  }

  async getUnitsByCourseId(courseId: string): Promise<Unit[]> {
    const snapshot = await getDocs(
      query(
        collection(this.firestore, 'units'),
        where('courseId', '==', courseId),
        orderBy('order'),
      ),
    )
    return snapshot.docs.map((item) => toUnit(item.id, item.data()))
  }

  async getUnitById(unitId: string): Promise<Unit | null> {
    const snapshot = await getDoc(doc(this.firestore, 'units', unitId))
    return snapshot.exists() ? toUnit(snapshot.id, snapshot.data()) : null
  }

  async getLessonsByUnitId(unitId: string): Promise<Lesson[]> {
    const snapshot = await getDocs(
      query(
        collection(this.firestore, 'lessons'),
        where('unitId', '==', unitId),
        orderBy('order'),
      ),
    )
    return snapshot.docs.map((item) => toLesson(item.id, item.data()))
  }

  async getLessonById(lessonId: string): Promise<Lesson | null> {
    const snapshot = await getDoc(doc(this.firestore, 'lessons', lessonId))
    return snapshot.exists() ? toLesson(snapshot.id, snapshot.data()) : null
  }

  async createCourse(
    input: Pick<Course, 'title' | 'description'>,
  ): Promise<Course> {
    const reference = doc(collection(this.firestore, 'courses'))
    const siblings = await this.getCourses()
    const now = new Date()
    const course: Course = {
      id: reference.id,
      ...input,
      order: (siblings.at(-1)?.order ?? -1) + 1,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(reference, serialize(course))
    return course
  }

  async saveCourse(course: Course): Promise<void> {
    await setDoc(
      doc(this.firestore, 'courses', course.id),
      serialize({ ...course, updatedAt: new Date() }),
    )
  }

  async createUnit(
    input: Pick<Unit, 'courseId' | 'title' | 'description'>,
  ): Promise<Unit> {
    const reference = doc(collection(this.firestore, 'units'))
    const siblings = await this.getUnitsByCourseId(input.courseId)
    const now = new Date()
    const unit: Unit = {
      id: reference.id,
      ...input,
      order: (siblings.at(-1)?.order ?? -1) + 1,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(reference, serialize(unit))
    return unit
  }

  async saveUnit(unit: Unit): Promise<void> {
    await setDoc(
      doc(this.firestore, 'units', unit.id),
      serialize({ ...unit, updatedAt: new Date() }),
    )
  }

  async createLesson(
    input: Pick<Lesson, 'unitId' | 'title' | 'type'>,
  ): Promise<Lesson> {
    const reference = doc(collection(this.firestore, 'lessons'))
    const siblings = await this.getLessonsByUnitId(input.unitId)
    const now = new Date()
    const lesson: Lesson = {
      id: reference.id,
      ...input,
      order: (siblings.at(-1)?.order ?? -1) + 1,
      exercises: [],
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(reference, serialize(lesson))
    return lesson
  }

  async saveLesson(lesson: Lesson): Promise<void> {
    await setDoc(
      doc(this.firestore, 'lessons', lesson.id),
      serialize({ ...lesson, updatedAt: new Date() }),
    )
  }

  async saveContent(changes: AdminContentChanges): Promise<void> {
    const batch = writeBatch(this.firestore)
    const updatedAt = new Date()
    for (const course of changes.courses ?? [])
      batch.set(
        doc(this.firestore, 'courses', course.id),
        serialize({ ...course, updatedAt }),
      )
    for (const unit of changes.units ?? [])
      batch.set(
        doc(this.firestore, 'units', unit.id),
        serialize({ ...unit, updatedAt }),
      )
    for (const lesson of changes.lessons ?? [])
      batch.set(
        doc(this.firestore, 'lessons', lesson.id),
        serialize({ ...lesson, updatedAt }),
      )
    await batch.commit()
  }

  async saveCourseOrder(courseIds: string[]): Promise<void> {
    await this.saveOrder('courses', await this.getCourses(), courseIds)
  }

  async saveUnitOrder(courseId: string, unitIds: string[]): Promise<void> {
    await this.saveOrder(
      'units',
      await this.getUnitsByCourseId(courseId),
      unitIds,
    )
  }

  async saveLessonOrder(unitId: string, lessonIds: string[]): Promise<void> {
    await this.saveOrder(
      'lessons',
      await this.getLessonsByUnitId(unitId),
      lessonIds,
    )
  }

  // Rewrites every sibling's order in one transaction, and refuses an order
  // that is not exactly the current siblings or that changed since it was read.
  private async saveOrder(
    collectionName: 'courses' | 'units' | 'lessons',
    siblings: { id: string; order: number }[],
    ids: string[],
  ): Promise<void> {
    const currentById = new Map(siblings.map((item) => [item.id, item]))
    if (
      ids.length !== siblings.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !currentById.has(id))
    ) {
      throw new Error(ORDER_CHANGED)
    }
    await runTransaction(this.firestore, async (transaction) => {
      const references = ids.map((id) =>
        doc(this.firestore, collectionName, id),
      )
      const snapshots = await Promise.all(
        references.map((reference) => transaction.get(reference)),
      )
      if (
        snapshots.some(
          (snapshot, index) =>
            !snapshot.exists() ||
            snapshot.data().order !== currentById.get(ids[index])?.order,
        )
      ) {
        throw new Error(ORDER_CHANGED)
      }
      references.forEach((reference, order) => {
        transaction.update(reference, { order, updatedAt: new Date() })
      })
    })
  }
}
