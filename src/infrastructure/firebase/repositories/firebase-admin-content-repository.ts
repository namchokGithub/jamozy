import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type Transaction,
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

// Course and Unit saves write only what an author can change. Counters are
// kept by their own increments and order by the order commands, so writing
// the values read before the save could overwrite newer ones.
function courseUpdate(course: Course, updatedAt: Date): DocumentData {
  return {
    title: course.title,
    description: course.description,
    type: course.type ?? deleteField(),
    ...statusUpdate(course),
    updatedAt,
  }
}

function unitUpdate(unit: Unit, updatedAt: Date): DocumentData {
  return {
    title: unit.title,
    description: unit.description,
    ...statusUpdate(unit),
    updatedAt,
  }
}

// Lesson saves also skip `order` and `unitId`, and store exerciseCount so
// parents can be counted without reading Exercises.
function lessonUpdate(lesson: Lesson, updatedAt: Date): DocumentData {
  return {
    title: lesson.title,
    type: lesson.type,
    exercises: lesson.exercises,
    exerciseCount: lesson.exercises.length,
    ...statusUpdate(lesson),
    updatedAt,
  }
}

interface LessonWrite {
  lesson: Lesson
  delta: number
  courseId: string | null
}

function statusUpdate(item: Course | Unit | Lesson): DocumentData {
  return {
    status: item.status ?? 'draft',
    archivedFromStatus: item.archivedFromStatus ?? deleteField(),
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
    const order = await this.nextOrder('courses')
    const now = new Date()
    const course: Course = {
      id: reference.id,
      ...input,
      order,
      status: 'draft',
      unitCount: 0,
      lessonCount: 0,
      exerciseCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    await setDoc(reference, serialize(course))
    return course
  }

  async saveCourse(course: Course): Promise<void> {
    await updateDoc(
      doc(this.firestore, 'courses', course.id),
      courseUpdate(course, new Date()),
    )
  }

  async createUnit(
    input: Pick<Unit, 'courseId' | 'title' | 'description'>,
  ): Promise<Unit> {
    const reference = doc(collection(this.firestore, 'units'))
    const order = await this.nextOrder('units', 'courseId', input.courseId)
    const now = new Date()
    const unit: Unit = {
      id: reference.id,
      ...input,
      order,
      status: 'draft',
      lessonCount: 0,
      exerciseCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    // One batch: the Unit and its Course's count land together. The update
    // fails when the Course is missing, so no orphan Unit is created.
    const batch = writeBatch(this.firestore)
    batch.set(reference, serialize(unit))
    batch.update(doc(this.firestore, 'courses', input.courseId), {
      unitCount: increment(1),
    })
    await batch.commit()
    return unit
  }

  async saveUnit(unit: Unit): Promise<void> {
    await updateDoc(
      doc(this.firestore, 'units', unit.id),
      unitUpdate(unit, new Date()),
    )
  }

  async createLesson(
    input: Pick<Lesson, 'unitId' | 'title' | 'type'>,
  ): Promise<Lesson> {
    const reference = doc(collection(this.firestore, 'lessons'))
    const parent = await this.getUnitById(input.unitId)
    if (!parent) throw new Error('Parent Unit was not found.')
    const order = await this.nextOrder('lessons', 'unitId', input.unitId)
    const now = new Date()
    const lesson: Lesson = {
      id: reference.id,
      ...input,
      order,
      exercises: [],
      exerciseCount: 0,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    }
    const batch = writeBatch(this.firestore)
    batch.set(reference, serialize(lesson))
    batch.update(doc(this.firestore, 'units', input.unitId), {
      lessonCount: increment(1),
    })
    batch.update(doc(this.firestore, 'courses', parent.courseId), {
      lessonCount: increment(1),
    })
    await batch.commit()
    return lesson
  }

  async saveLesson(lesson: Lesson): Promise<void> {
    await runTransaction(this.firestore, async (transaction) => {
      const writes = await this.readLessonWrites(transaction, [lesson])
      this.writeLessons(transaction, writes, new Date())
    })
  }

  async saveContent(changes: AdminContentChanges): Promise<void> {
    // A transaction, not a batch: Lesson Exercise deltas need a read first.
    await runTransaction(this.firestore, async (transaction) => {
      const writes = await this.readLessonWrites(
        transaction,
        changes.lessons ?? [],
      )
      const updatedAt = new Date()
      for (const course of changes.courses ?? [])
        transaction.update(
          doc(this.firestore, 'courses', course.id),
          courseUpdate(course, updatedAt),
        )
      for (const unit of changes.units ?? [])
        transaction.update(
          doc(this.firestore, 'units', unit.id),
          unitUpdate(unit, updatedAt),
        )
      this.writeLessons(transaction, writes, updatedAt)
    })
  }

  // Reads each saved Lesson to find how many Exercises it gains, and its
  // Course when the count changes. All reads happen before any write.
  private async readLessonWrites(
    transaction: Transaction,
    lessons: Lesson[],
  ): Promise<LessonWrite[]> {
    return Promise.all(
      lessons.map(async (lesson) => {
        const saved = await transaction.get(
          doc(this.firestore, 'lessons', lesson.id),
        )
        if (!saved.exists()) throw new Error('Lesson was not found.')
        const savedExercises: unknown[] = saved.data().exercises ?? []
        const delta = lesson.exercises.length - savedExercises.length
        if (delta === 0) return { lesson, delta, courseId: null }
        const unit = await transaction.get(
          doc(this.firestore, 'units', lesson.unitId),
        )
        if (!unit.exists()) throw new Error('Parent Unit was not found.')
        return { lesson, delta, courseId: unit.data().courseId as string }
      }),
    )
  }

  private writeLessons(
    transaction: Transaction,
    writes: LessonWrite[],
    updatedAt: Date,
  ): void {
    for (const { lesson, delta, courseId } of writes) {
      transaction.update(
        doc(this.firestore, 'lessons', lesson.id),
        lessonUpdate(lesson, updatedAt),
      )
      if (delta === 0 || !courseId) continue
      transaction.update(doc(this.firestore, 'units', lesson.unitId), {
        exerciseCount: increment(delta),
      })
      transaction.update(doc(this.firestore, 'courses', courseId), {
        exerciseCount: increment(delta),
      })
    }
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
  // Reads only the last sibling (1 document) instead of every sibling.
  // The parent filter needs the `order` DESC composite indexes.
  private async nextOrder(
    collectionName: 'courses' | 'units' | 'lessons',
    parentField?: 'courseId' | 'unitId',
    parentId?: string,
  ): Promise<number> {
    const snapshot = await getDocs(
      query(
        collection(this.firestore, collectionName),
        ...(parentField ? [where(parentField, '==', parentId)] : []),
        orderBy('order', 'desc'),
        limit(1),
      ),
    )
    const last: unknown = snapshot.docs[0]?.data().order
    return typeof last === 'number' ? last + 1 : 0
  }

  // One sibling query (N reads), then one batch. The order must name exactly
  // the current siblings; it does not detect a reorder made elsewhere with the
  // same siblings, which single-owner editing makes acceptable.
  private async saveOrder(
    collectionName: 'courses' | 'units' | 'lessons',
    siblings: { id: string }[],
    ids: string[],
  ): Promise<void> {
    const siblingIds = new Set(siblings.map((item) => item.id))
    if (
      ids.length !== siblings.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !siblingIds.has(id))
    ) {
      throw new Error(ORDER_CHANGED)
    }
    const batch = writeBatch(this.firestore)
    const updatedAt = new Date()
    ids.forEach((id, order) => {
      batch.update(doc(this.firestore, collectionName, id), {
        order,
        updatedAt,
      })
    })
    await batch.commit()
  }
}
