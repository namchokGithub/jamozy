import type { Course } from '../domain/models/course'
import type { LessonExercise } from '../domain/models/lesson'
import type { OnePageLearningCheckpoint } from '../domain/models/one-page-learning-checkpoint'
import type { Progress } from '../domain/models/progress'
import type { CourseRepository } from '../domain/repositories/course-repository'
import type { LessonRepository } from '../domain/repositories/lesson-repository'
import type { OnePageLearningCheckpointRepository } from '../domain/repositories/one-page-learning-checkpoint-repository'
import type { ProgressRepository } from '../domain/repositories/progress-repository'
import { getOrderedLearningPath, type OrderedLearningPathLesson } from './learning-path-order'

export interface OnePageQueueExercise extends OrderedLearningPathLesson {
  exercise: LessonExercise
}

export interface OnePageLearningPath {
  courses: Array<{ id: string; title: string; description: string }>
  selectedCourseId: string | null
  queue: OnePageQueueExercise[]
  checkpoint: OnePageLearningCheckpoint | null
  pendingLessonId: string | null
}

export interface OnePageQueueCursor {
  lessonId: string
  exerciseId: string
}

const QUEUE_SIZE = 10

export interface GetOnePageLearningPathDeps {
  courseRepo: CourseRepository
  lessonRepo: LessonRepository
  progressRepo: ProgressRepository
  checkpointRepo: OnePageLearningCheckpointRepository
  courses?: Promise<Course[]>
}

function isCompleted(progress: Map<string, Progress>, lessonId: string): boolean {
  return progress.get(lessonId)?.status === 'completed'
}

function reconcileCheckpoint(
  checkpoint: OnePageLearningCheckpoint,
  ordered: OrderedLearningPathLesson[],
): OnePageLearningCheckpoint {
  const exercisesByLesson = new Map(
    ordered.map(({ lesson }) => [lesson.id, new Set(lesson.exercises.map(({ id }) => id))]),
  )
  const completedExerciseIdsByLesson: Record<string, string[]> = {}
  const partialLessonResults = { ...checkpoint.partialLessonResults }
  for (const [lessonId, ids] of Object.entries(checkpoint.completedExerciseIdsByLesson)) {
    const valid = exercisesByLesson.get(lessonId)
    if (!valid) {
      delete partialLessonResults[lessonId]
      continue
    }
    const retained = ids.filter((id, index) => valid.has(id) && ids.indexOf(id) === index)
    if (retained.length > 0) completedExerciseIdsByLesson[lessonId] = retained
    const partial = partialLessonResults[lessonId]
    if (partial) {
      partialLessonResults[lessonId] = {
        ...partial,
        completedExerciseIds: retained,
        mistakes: partial.mistakes.filter(({ sourceExerciseId }) => retained.includes(sourceExerciseId)),
      }
    }
  }
  return { ...checkpoint, completedExerciseIdsByLesson, partialLessonResults }
}

// Exercises in canonical order after the cursor. Replay courses wrap to their
// first exercise, repeating the course until a full queue is available.
function exercisesAfter(
  exercises: OnePageQueueExercise[],
  after: OnePageQueueCursor,
  wrap: boolean,
): OnePageQueueExercise[] {
  const index = exercises.findIndex(({ lesson, exercise }) =>
    lesson.id === after.lessonId && exercise.id === after.exerciseId)
  const following = exercises.slice(index + 1)
  if (!wrap || exercises.length === 0) return following
  const cycles = Math.ceil(QUEUE_SIZE / exercises.length) + 1
  return [...following, ...Array.from({ length: cycles }, () => exercises).flat()]
}

export async function getOnePageLearningPath(
  deps: GetOnePageLearningPathDeps,
  userId: string,
  selectedCourseId?: string,
  after?: OnePageQueueCursor,
): Promise<OnePageLearningPath> {
  const [ordered, allProgress] = await Promise.all([
    getOrderedLearningPath(deps.courseRepo, deps.lessonRepo, deps.courses),
    deps.progressRepo.getAllProgress(userId),
  ])
  const progress = new Map(allProgress.map((entry) => [entry.lessonId, entry]))
  const incompleteCourseIds = [...new Set(
    ordered
      .filter(({ lesson }) => !isCompleted(progress, lesson.id))
      .map(({ course }) => course.id),
  )]
  const replayCourseIds = [...new Set(ordered.map(({ course }) => course.id))]
  const selectableCourseIds = (incompleteCourseIds.length > 0
    ? incompleteCourseIds
    : replayCourseIds).slice(0, 3)
  const courses = selectableCourseIds.map((courseId) => {
    const course = ordered.find((entry) => entry.course.id === courseId)!.course
    return { id: course.id, title: course.title, description: course.description }
  })
  // A refill keeps the player's course even if it stopped being selectable
  // while the learner was still playing it.
  const courseId = selectedCourseId && (selectableCourseIds.includes(selectedCourseId) ||
    (after && ordered.some(({ course }) => course.id === selectedCourseId)))
    ? selectedCourseId
    : selectableCourseIds[0] ?? null
  if (!courseId) return { courses, selectedCourseId: null, queue: [], checkpoint: null, pendingLessonId: null }

  const courseEntries = ordered.filter(({ course }) => course.id === courseId)
  const storedCheckpoint = await deps.checkpointRepo.getCheckpoint(userId, courseId)
  const checkpoint = storedCheckpoint ? reconcileCheckpoint(storedCheckpoint, courseEntries) : null
  if (checkpoint && JSON.stringify(checkpoint) !== JSON.stringify(storedCheckpoint)) {
    await deps.checkpointRepo.saveCheckpoint({ ...checkpoint, updatedAt: new Date() })
  }
  const isReplayCourse = !incompleteCourseIds.includes(courseId)
  const isQueued = ({ lesson, exercise }: OnePageQueueExercise) =>
    (isReplayCourse || !isCompleted(progress, lesson.id)) &&
    !checkpoint?.completedExerciseIdsByLesson[lesson.id]?.includes(exercise.id)
  const courseExercises = courseEntries.flatMap((entry) =>
    entry.lesson.exercises.map((exercise) => ({ ...entry, exercise })))
  const queue = after
    ? exercisesAfter(courseExercises, after, isReplayCourse).filter(isQueued).slice(0, QUEUE_SIZE)
    : courseExercises.filter(isQueued).slice(0, QUEUE_SIZE)
  const pendingLessonId = checkpoint
    ? courseEntries.find(({ lesson }) =>
      (isReplayCourse || !isCompleted(progress, lesson.id)) &&
      lesson.exercises.length > 0 &&
      lesson.exercises.every((exercise) => checkpoint.completedExerciseIdsByLesson[lesson.id]?.includes(exercise.id)),
    )?.lesson.id ?? null
    : null
  return { courses, selectedCourseId: courseId, queue, checkpoint, pendingLessonId }
}
