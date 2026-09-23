import type { CourseRepository } from '../domain/repositories/course-repository'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'

export function getCourses(courseRepo: CourseRepository): Promise<Course[]> {
  return courseRepo.getCourses()
}

export function getCourseUnits(
  courseRepo: CourseRepository,
  courseId: string,
): Promise<Unit[]> {
  return courseRepo.getUnitsByCourseId(courseId)
}
