import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { toLesson } from '../mappers/lesson-mapper'
import type { LessonRepository } from '../../../domain/repositories/lesson-repository'
import type { Lesson } from '../../../domain/models/lesson'
import type { ContentStatus } from '../../../domain/models/content-status'

interface PublishedUnit {
  courseId: string
  status: ContentStatus | undefined
}

function isHiddenContentError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'permission-denied'
  )
}

async function hasPublishedAncestors(unitId: string): Promise<boolean> {
  try {
    const unitSnapshot = await getDoc(doc(db, 'units', unitId))
    if (!unitSnapshot.exists()) return false
    const unit = unitSnapshot.data() as PublishedUnit
    if (unit.status !== 'published') return false

    const courseSnapshot = await getDoc(doc(db, 'courses', unit.courseId))
    return (
      courseSnapshot.exists() && courseSnapshot.data().status === 'published'
    )
  } catch (error) {
    if (isHiddenContentError(error)) return false
    throw error
  }
}

export class FirebaseLessonRepository implements LessonRepository {
  async getLessonsByUnitId(unitId: string): Promise<Lesson[]> {
    if (!(await hasPublishedAncestors(unitId))) return []

    const snapshot = await getDocs(
      query(
        collection(db, 'lessons'),
        where('unitId', '==', unitId),
        where('status', '==', 'published'),
        orderBy('order'),
      ),
    )
    return snapshot.docs.map((d) => toLesson(d.id, d.data()))
  }

  async getLessonById(lessonId: string): Promise<Lesson | null> {
    try {
      const snapshot = await getDoc(doc(db, 'lessons', lessonId))
      if (!snapshot.exists()) return null
      const lesson = toLesson(snapshot.id, snapshot.data())
      if (lesson.status !== 'published') return null
      return (await hasPublishedAncestors(lesson.unitId)) ? lesson : null
    } catch (error) {
      if (isHiddenContentError(error)) return null
      throw error
    }
  }
}
