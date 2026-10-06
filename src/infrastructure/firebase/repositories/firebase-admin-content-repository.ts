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
  type DocumentData,
} from 'firebase/firestore'
import { db } from '../firebase'
import type { AdminContentRepository } from '../../../domain/repositories/admin-content-repository'
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

function toCourse(id: string, data: DocumentData): Course {
  return {
    id,
    title: data.title,
    description: data.description,
    order: data.order,
    ...(data.type === 'home' || data.type === 'learning'
      ? { type: data.type as CourseType }
      : {}),
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
  async getCourses(): Promise<Course[]> {
    const snapshot = await getDocs(
      query(collection(db, 'courses'), orderBy('order')),
    )
    return snapshot.docs.map((item) => toCourse(item.id, item.data()))
  }

  async getCourseById(courseId: string): Promise<Course | null> {
    const snapshot = await getDoc(doc(db, 'courses', courseId))
    return snapshot.exists() ? toCourse(snapshot.id, snapshot.data()) : null
  }

  async getUnitsByCourseId(courseId: string): Promise<Unit[]> {
    const snapshot = await getDocs(
      query(
        collection(db, 'units'),
        where('courseId', '==', courseId),
        orderBy('order'),
      ),
    )
    return snapshot.docs.map((item) => toUnit(item.id, item.data()))
  }

  async getUnitById(unitId: string): Promise<Unit | null> {
    const snapshot = await getDoc(doc(db, 'units', unitId))
    return snapshot.exists() ? toUnit(snapshot.id, snapshot.data()) : null
  }

  async getLessonsByUnitId(unitId: string): Promise<Lesson[]> {
    const snapshot = await getDocs(
      query(
        collection(db, 'lessons'),
        where('unitId', '==', unitId),
        orderBy('order'),
      ),
    )
    return snapshot.docs.map((item) => toLesson(item.id, item.data()))
  }

  async getLessonById(lessonId: string): Promise<Lesson | null> {
    const snapshot = await getDoc(doc(db, 'lessons', lessonId))
    return snapshot.exists() ? toLesson(snapshot.id, snapshot.data()) : null
  }

  async createCourse(
    input: Pick<Course, 'title' | 'description'>,
  ): Promise<Course> {
    const reference = doc(collection(db, 'courses'))
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
      doc(db, 'courses', course.id),
      serialize({ ...course, updatedAt: new Date() }),
    )
  }

  async createUnit(
    input: Pick<Unit, 'courseId' | 'title' | 'description'>,
  ): Promise<Unit> {
    const reference = doc(collection(db, 'units'))
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
      doc(db, 'units', unit.id),
      serialize({ ...unit, updatedAt: new Date() }),
    )
  }

  async createLesson(
    input: Pick<Lesson, 'unitId' | 'title' | 'type'>,
  ): Promise<Lesson> {
    const reference = doc(collection(db, 'lessons'))
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
      doc(db, 'lessons', lesson.id),
      serialize({ ...lesson, updatedAt: new Date() }),
    )
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
    await runTransaction(db, async (transaction) => {
      const references = ids.map((id) => doc(db, collectionName, id))
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
