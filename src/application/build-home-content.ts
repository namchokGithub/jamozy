import {
  findUntypeableCharacters,
  formatCharacters,
} from '../domain/korean/target-sequence'
import { isPublishedContent } from '../domain/models/content-status'
import { courseType, type Course } from '../domain/models/course'
import {
  homeContentSchema,
  type HomeContent,
} from '../domain/models/home-content'
import type { Lesson } from '../domain/models/lesson'
import type { Unit } from '../domain/models/unit'

export interface BuildHomeContentInput {
  courses: Course[]
  units: Unit[]
  lessons: Lesson[]
  exportedAt: Date
}

const byOrder = (left: { order: number }, right: { order: number }) =>
  left.order - right.order

// Builds the static Home export from Admin BO content (DEC-043). Only
// published items are exported; the result is validated before it is written.
// Returns null when no Home course is published yet, so the build ships
// without Home content instead of failing.
export function buildHomeContent({
  courses,
  units,
  lessons,
  exportedAt,
}: BuildHomeContentInput): HomeContent | null {
  const homeCourses = courses.filter(
    (course) => isPublishedContent(course) && courseType(course) === 'home',
  )
  if (homeCourses.length === 0) return null
  if (homeCourses.length > 1)
    throw new Error(
      `Expected at most one published Home course, found ${homeCourses.length}.`,
    )
  const [course] = homeCourses

  const homeUnits = units
    .filter((unit) => unit.courseId === course.id && isPublishedContent(unit))
    .sort(byOrder)
    .map((unit) => ({
      id: unit.id,
      title: unit.title,
      description: unit.description,
      order: unit.order,
      lessons: lessons
        .filter(
          (lesson) => lesson.unitId === unit.id && isPublishedContent(lesson),
        )
        .sort(byOrder)
        .map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          type: lesson.type,
          order: lesson.order,
          exercises: lesson.exercises.map((exercise) => ({
            id: exercise.id,
            targetText: exercise.targetText,
            romanization: exercise.romanization,
            meaningTh: exercise.meaningTh,
            meaningEn: exercise.meaningEn,
            difficulty: exercise.difficulty,
            hint: exercise.hint,
          })),
        })),
    }))
    .filter((unit) => unit.lessons.length > 0)

  const untypeable = homeUnits.flatMap((unit) =>
    unit.lessons.flatMap((lesson) =>
      lesson.exercises.flatMap((exercise) => {
        const chars = findUntypeableCharacters(exercise.targetText)
        return chars.length > 0
          ? [
              `lesson ${lesson.id} exercise ${exercise.id}: ${formatCharacters(chars)}`,
            ]
          : []
      }),
    ),
  )
  if (untypeable.length > 0)
    throw new Error(
      `Home content has text the keyboard cannot type: ${untypeable.join('; ')}`,
    )

  return homeContentSchema.parse({
    schemaVersion: 1,
    exportedAt: exportedAt.toISOString(),
    course: {
      id: course.id,
      title: course.title,
      description: course.description,
    },
    units: homeUnits,
  })
}
