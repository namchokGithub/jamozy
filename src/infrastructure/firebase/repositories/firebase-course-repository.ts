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

function toCourse(id: string, data: Record<string, unknown>): Course {
  return {
    id,
    title: data.title as string,
    description: data.description as string,
    order: data.order as number,
    createdAt: (data.createdAt as { toDate(): Date }).toDate(),
    updatedAt: (data.updatedAt as { toDate(): Date }).toDate(),
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
  }
}

export class FirebaseCourseRepository implements CourseRepository {
  async getCourses(): Promise<Course[]> {
    const snapshot = await getDocs(
      query(collection(db, 'courses'), orderBy('order')),
    )
    return snapshot.docs.map((d) => toCourse(d.id, d.data()))
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
    return snapshot.docs.map((d) => toUnit(d.id, d.data()))
  }

  async getUnitById(unitId: string): Promise<Unit | null> {
    const snapshot = await getDoc(doc(db, 'units', unitId))
    return snapshot.exists() ? toUnit(snapshot.id, snapshot.data()) : null
  }
}
