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
import type { CourseRepository } from '../../../domain/repositories/course-repository'
import type { Course } from '../../../domain/models/course'
import type { Unit } from '../../../domain/models/unit'
import type {
  ContentStatus,
  RestorableContentStatus,
} from '../../../domain/models/content-status'

function isHiddenContentError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'permission-denied'
  )
}

function toCourse(id: string, data: Record<string, unknown>): Course {
  return {
    id,
    title: data.title as string,
    description: data.description as string,
    order: data.order as number,
    createdAt: (data.createdAt as { toDate(): Date }).toDate(),
    updatedAt: (data.updatedAt as { toDate(): Date }).toDate(),
    status: (data.status as ContentStatus | undefined) ?? 'draft',
    ...(data.archivedFromStatus
      ? {
          archivedFromStatus:
            data.archivedFromStatus as RestorableContentStatus,
        }
      : {}),
  }
}

function toUnit(id: string, data: Record<string, unknown>): Unit {
  return {
    id,
    courseId: data.courseId as string,
    title: data.title as string,
    description: data.description as string,
    order: data.order as number,
    createdAt: (data.createdAt as { toDate(): Date }).toDate(),
    updatedAt: (data.updatedAt as { toDate(): Date }).toDate(),
    status: (data.status as ContentStatus | undefined) ?? 'draft',
    ...(data.archivedFromStatus
      ? {
          archivedFromStatus:
            data.archivedFromStatus as RestorableContentStatus,
        }
      : {}),
  }
}

export class FirebaseCourseRepository implements CourseRepository {
  async getCourses(): Promise<Course[]> {
    const snapshot = await getDocs(
      query(
        collection(db, 'courses'),
        where('status', '==', 'published'),
        orderBy('order'),
      ),
    )
    return snapshot.docs.map((d) => toCourse(d.id, d.data()))
  }

  async getCourseById(courseId: string): Promise<Course | null> {
    try {
      const snapshot = await getDoc(doc(db, 'courses', courseId))
      if (!snapshot.exists()) return null
      const course = toCourse(snapshot.id, snapshot.data())
      return course.status === 'published' ? course : null
    } catch (error) {
      if (isHiddenContentError(error)) return null
      throw error
    }
  }

  async getUnitsByCourseId(courseId: string): Promise<Unit[]> {
    if (!(await this.getCourseById(courseId))) return []

    const snapshot = await getDocs(
      query(
        collection(db, 'units'),
        where('courseId', '==', courseId),
        where('status', '==', 'published'),
        orderBy('order'),
      ),
    )
    return snapshot.docs.map((d) => toUnit(d.id, d.data()))
  }

  async getUnitById(unitId: string): Promise<Unit | null> {
    try {
      const snapshot = await getDoc(doc(db, 'units', unitId))
      if (!snapshot.exists()) return null
      const unit = toUnit(snapshot.id, snapshot.data())
      if (unit.status !== 'published') return null
      return (await this.getCourseById(unit.courseId)) ? unit : null
    } catch (error) {
      if (isHiddenContentError(error)) return null
      throw error
    }
  }
}
