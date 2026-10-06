import type { Course } from '../models/course'
import type { Lesson } from '../models/lesson'
import type { Unit } from '../models/unit'

export interface AdminContentRepository {
  getCourses(): Promise<Course[]>
  getCourseById(courseId: string): Promise<Course | null>
  getUnitsByCourseId(courseId: string): Promise<Unit[]>
  getUnitById(unitId: string): Promise<Unit | null>
  getLessonsByUnitId(unitId: string): Promise<Lesson[]>
  getLessonById(lessonId: string): Promise<Lesson | null>
  createCourse(input: Pick<Course, 'title' | 'description'>): Promise<Course>
  saveCourse(course: Course): Promise<void>
  createUnit(
    input: Pick<Unit, 'courseId' | 'title' | 'description'>,
  ): Promise<Unit>
  saveUnit(unit: Unit): Promise<void>
  createLesson(
    input: Pick<Lesson, 'unitId' | 'title' | 'type'>,
  ): Promise<Lesson>
  saveLesson(lesson: Lesson): Promise<void>
  /** Order calls take every sibling ID in its new order and write atomically. */
  saveCourseOrder(courseIds: string[]): Promise<void>
  saveUnitOrder(courseId: string, unitIds: string[]): Promise<void>
  saveLessonOrder(unitId: string, lessonIds: string[]): Promise<void>
}
