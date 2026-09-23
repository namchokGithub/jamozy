import type { CourseRepository } from '../domain/repositories/course-repository'
import type { LessonRepository } from '../domain/repositories/lesson-repository'
import type { ProgressRepository } from '../domain/repositories/progress-repository'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'
import type { Lesson } from '../domain/models/lesson'
import type { Progress } from '../domain/models/progress'
import { NotFoundError } from '../domain/errors'

export function getCourses(courseRepo: CourseRepository): Promise<Course[]> {
  return courseRepo.getCourses()
}

export function getCourseUnits(
  courseRepo: CourseRepository,
  courseId: string,
): Promise<Unit[]> {
  return courseRepo.getUnitsByCourseId(courseId)
}

export interface CourseMapLessonEntry {
  lesson: Lesson
  progress: Progress | null
}

export interface CourseMapUnit {
  unit: Unit
  lessons: CourseMapLessonEntry[]
}

export interface CourseMap {
  course: Course
  units: CourseMapUnit[]
}

export interface GetCourseMapDeps {
  courseRepo: CourseRepository
  lessonRepo: LessonRepository
  progressRepo: ProgressRepository
}

export async function getCourseMap(
  deps: GetCourseMapDeps,
  userId: string,
  courseId: string,
): Promise<CourseMap> {
  const course = await deps.courseRepo.getCourseById(courseId)
  if (!course) {
    throw new NotFoundError(`Course not found: ${courseId}`)
  }

  const units = await deps.courseRepo.getUnitsByCourseId(courseId)

  const mapUnits = await Promise.all(
    units.map(async (unit): Promise<CourseMapUnit> => {
      const lessons = await deps.lessonRepo.getLessonsByUnitId(unit.id)
      const lessonEntries = await Promise.all(
        lessons.map(async (lesson): Promise<CourseMapLessonEntry> => {
          const progress = await deps.progressRepo.getProgress(
            userId,
            lesson.id,
          )
          return { lesson, progress }
        }),
      )
      return { unit, lessons: lessonEntries }
    }),
  )

  return { course, units: mapUnits }
}
