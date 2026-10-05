import type { Course } from '../domain/models/course'
import type { Lesson } from '../domain/models/lesson'
import type { Progress } from '../domain/models/progress'
import type { Unit } from '../domain/models/unit'
import type { CourseRepository } from '../domain/repositories/course-repository'
import type { LessonRepository } from '../domain/repositories/lesson-repository'

export interface OrderedLearningPathLesson {
  course: Course
  unit: Unit
  lesson: Lesson
}

export async function getOrderedLearningPath(
  courseRepo: CourseRepository,
  lessonRepo: LessonRepository,
): Promise<OrderedLearningPathLesson[]> {
  const courses = [...(await courseRepo.getCourses())].sort(
    (left, right) => left.order - right.order,
  )
  // Query every course's units, then every unit's lessons, concurrently:
  // sequential awaits made Home load in 1 + courses + units round trips.
  const unitsByCourse = await Promise.all(
    courses.map(async (course) =>
      [...(await courseRepo.getUnitsByCourseId(course.id))]
        .sort((left, right) => left.order - right.order)
        .map((unit) => ({ course, unit })),
    ),
  )
  const lessonsByUnit = await Promise.all(
    unitsByCourse.flat().map(async ({ course, unit }) =>
      [...(await lessonRepo.getLessonsByUnitId(unit.id))]
        .sort((left, right) => left.order - right.order)
        .map((lesson) => ({ course, unit, lesson })),
    ),
  )
  return lessonsByUnit.flat()
}

export function findContiguousFrontier(
  ordered: OrderedLearningPathLesson[],
  progress: Iterable<Progress>,
): OrderedLearningPathLesson | null {
  const byLessonId = new Map(
    [...progress].map((entry) => [entry.lessonId, entry]),
  )
  return (
    ordered.find(
      ({ lesson }) => byLessonId.get(lesson.id)?.status !== 'completed',
    ) ?? null
  )
}
