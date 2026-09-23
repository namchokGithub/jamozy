import type { Course } from '../models/course'
import type { Unit } from '../models/unit'

export interface CourseRepository {
  getCourses(): Promise<Course[]>
  getCourseById(courseId: string): Promise<Course | null>
  getUnitsByCourseId(courseId: string): Promise<Unit[]>
  getUnitById(unitId: string): Promise<Unit | null>
}
