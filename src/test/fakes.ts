import type { JamoStats } from '../domain/models/jamo-stat'
import type { JamoStatsRepository } from '../domain/repositories/jamo-stats-repository'
import type { CourseRepository } from '../domain/repositories/course-repository'
import type { LessonRepository } from '../domain/repositories/lesson-repository'
import type { ProgressRepository } from '../domain/repositories/progress-repository'
import type { ReviewRepository } from '../domain/repositories/review-repository'
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'
import type { Course } from '../domain/models/course'
import type { Unit } from '../domain/models/unit'
import type { Lesson } from '../domain/models/lesson'
import type { Progress } from '../domain/models/progress'
import type { ReviewItem } from '../domain/models/review-item'
import type { UserProfile } from '../domain/models/user-profile'
import type { LearningSession } from '../domain/models/learning-session'
import { aggregateFromSession } from '../domain/models/session-aggregate'
import type {
  SessionSubmissionEffects,
  SessionSubmissionOutcome,
  SessionSubmissionRepository,
} from '../domain/repositories/session-submission-repository'
import type {
  AdminContentChanges,
  AdminContentRepository,
} from '../domain/repositories/admin-content-repository'
import type { OnePageLearningCheckpoint } from '../domain/models/one-page-learning-checkpoint'
import type { OnePageLearningCheckpointRepository } from '../domain/repositories/one-page-learning-checkpoint-repository'
import type { HomeSyncJob } from '../domain/models/home-sync-job'
import type { HomeSyncJobRepository } from '../domain/repositories/home-sync-job-repository'

export class FakeCourseRepository implements CourseRepository {
  constructor(
    private courses: Course[] = [],
    private units: Unit[] = [],
  ) {}

  async getCourses(): Promise<Course[]> {
    return [...this.courses].sort((a, b) => a.order - b.order)
  }

  async getCourseById(courseId: string): Promise<Course | null> {
    return this.courses.find((c) => c.id === courseId) ?? null
  }

  async getUnitsByCourseId(courseId: string): Promise<Unit[]> {
    return this.units
      .filter((u) => u.courseId === courseId)
      .sort((a, b) => a.order - b.order)
  }

  async getUnitById(unitId: string): Promise<Unit | null> {
    return this.units.find((u) => u.id === unitId) ?? null
  }
}

export class FakeLessonRepository implements LessonRepository {
  constructor(private lessons: Lesson[] = []) {}

  async getLessonsByUnitId(unitId: string): Promise<Lesson[]> {
    return this.lessons
      .filter((l) => l.unitId === unitId)
      .sort((a, b) => a.order - b.order)
  }

  async getLessonById(lessonId: string): Promise<Lesson | null> {
    return this.lessons.find((l) => l.id === lessonId) ?? null
  }
}

export class FakeAdminContentRepository implements AdminContentRepository {
  constructor(
    readonly courses: Course[] = [],
    readonly units: Unit[] = [],
    readonly lessons: Lesson[] = [],
  ) {}

  async getCourses() {
    return [...this.courses].sort((a, b) => a.order - b.order)
  }
  async getCourseById(id: string) {
    return this.courses.find((item) => item.id === id) ?? null
  }
  async getUnitsByCourseId(courseId: string) {
    return this.units
      .filter((item) => item.courseId === courseId)
      .sort((a, b) => a.order - b.order)
  }
  async getUnitById(id: string) {
    return this.units.find((item) => item.id === id) ?? null
  }
  async getLessonsByUnitId(unitId: string) {
    return this.lessons
      .filter((item) => item.unitId === unitId)
      .sort((a, b) => a.order - b.order)
  }
  async getLessonById(id: string) {
    return this.lessons.find((item) => item.id === id) ?? null
  }
  async createCourse(input: Pick<Course, 'title' | 'description'>) {
    const item: Course = {
      id: `course-${this.courses.length + 1}`,
      ...input,
      order: this.courses.length,
      status: 'draft',
      unitCount: 0,
      lessonCount: 0,
      exerciseCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.courses.push(item)
    return item
  }
  // Like the Firebase adapter, saves keep stored counters and order.
  async saveCourse(course: Course) {
    this.replace(this.courses, this.keepStored(this.courses, course))
  }
  async createUnit(input: Pick<Unit, 'courseId' | 'title' | 'description'>) {
    const item: Unit = {
      id: `unit-${this.units.length + 1}`,
      ...input,
      order: (await this.getUnitsByCourseId(input.courseId)).length,
      status: 'draft',
      lessonCount: 0,
      exerciseCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.units.push(item)
    this.bump(this.courses, input.courseId, 'unitCount', 1)
    return item
  }
  async saveUnit(unit: Unit) {
    this.replace(this.units, this.keepStored(this.units, unit))
  }
  async createLesson(input: Pick<Lesson, 'unitId' | 'title' | 'type'>) {
    const item: Lesson = {
      id: `lesson-${this.lessons.length + 1}`,
      ...input,
      order: (await this.getLessonsByUnitId(input.unitId)).length,
      exercises: [],
      exerciseCount: 0,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.lessons.push(item)
    const unit = await this.getUnitById(input.unitId)
    this.bump(this.units, input.unitId, 'lessonCount', 1)
    if (unit) this.bump(this.courses, unit.courseId, 'lessonCount', 1)
    return item
  }
  async saveLesson(lesson: Lesson) {
    this.writeLesson(lesson)
  }
  async saveContent(changes: AdminContentChanges) {
    for (const course of changes.courses ?? [])
      this.replace(this.courses, this.keepStored(this.courses, course))
    for (const unit of changes.units ?? [])
      this.replace(this.units, this.keepStored(this.units, unit))
    for (const lesson of changes.lessons ?? []) this.writeLesson(lesson)
  }
  async saveCourseOrder(courseIds: string[]) {
    this.saveOrder(await this.getCourses(), courseIds)
  }
  async saveUnitOrder(courseId: string, unitIds: string[]) {
    this.saveOrder(await this.getUnitsByCourseId(courseId), unitIds)
  }
  async saveLessonOrder(unitId: string, lessonIds: string[]) {
    this.saveOrder(await this.getLessonsByUnitId(unitId), lessonIds)
  }

  private bump<T extends { id: string }>(
    items: T[],
    id: string,
    field: 'unitCount' | 'lessonCount' | 'exerciseCount',
    by: number,
  ) {
    const item = items.find((candidate) => candidate.id === id) as
      (T & Record<typeof field, number | undefined>) | undefined
    if (item) item[field] = (item[field] ?? 0) + by
  }
  // Like the Firebase adapter: keeps order, stores exerciseCount, and adds
  // the Exercises the Lesson gains to its Unit and Course.
  private writeLesson(lesson: Lesson) {
    const saved = this.lessons.find((item) => item.id === lesson.id)
    const delta = lesson.exercises.length - (saved?.exercises.length ?? 0)
    this.replace(this.lessons, {
      ...lesson,
      order: saved?.order ?? lesson.order,
      exerciseCount: lesson.exercises.length,
    })
    if (delta === 0) return
    const unit = this.units.find((item) => item.id === lesson.unitId)
    this.bump(this.units, lesson.unitId, 'exerciseCount', delta)
    if (unit) this.bump(this.courses, unit.courseId, 'exerciseCount', delta)
  }
  private keepStored<T extends Course | Unit>(items: T[], next: T): T {
    const saved = items.find((item) => item.id === next.id)
    if (!saved) return next
    const kept = {
      order: saved.order,
      unitCount: (saved as Course).unitCount,
      lessonCount: saved.lessonCount,
      exerciseCount: saved.exerciseCount,
    }
    return {
      ...next,
      ...Object.fromEntries(
        Object.entries(kept).filter(([, value]) => value !== undefined),
      ),
    }
  }
  private replace<T extends { id: string }>(items: T[], next: T) {
    const index = items.findIndex((item) => item.id === next.id)
    if (index >= 0) items[index] = next
  }
  private saveOrder(siblings: { id: string; order: number }[], ids: string[]) {
    if (
      ids.length !== siblings.length ||
      new Set(ids).size !== ids.length ||
      ids.some((id) => !siblings.some((item) => item.id === id))
    )
      throw new Error('Content order changed. Refresh and try again.')
    ids.forEach((id, order) => {
      const item = siblings.find((sibling) => sibling.id === id)
      if (item) item.order = order
    })
  }
}

export class FakeProgressRepository implements ProgressRepository {
  private store = new Map<string, Progress>()

  async getProgress(
    userId: string,
    lessonId: string,
  ): Promise<Progress | null> {
    return this.store.get(`${userId}:${lessonId}`) ?? null
  }

  async getAllProgress(userId: string): Promise<Progress[]> {
    return [...this.store.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, value]) => value)
  }

  async saveProgress(userId: string, progress: Progress): Promise<void> {
    this.store.set(`${userId}:${progress.lessonId}`, progress)
  }
}

export class FakeReviewRepository implements ReviewRepository {
  private store = new Map<string, ReviewItem>()

  async getReviewItems(userId: string): Promise<ReviewItem[]> {
    return [...this.store.entries()]
      .filter(([key]) => key.startsWith(`${userId}:`))
      .map(([, value]) => value)
  }

  async getReviewItem(
    userId: string,
    itemId: string,
  ): Promise<ReviewItem | null> {
    return this.store.get(`${userId}:${itemId}`) ?? null
  }

  async addReviewItem(userId: string, item: ReviewItem): Promise<void> {
    this.store.set(`${userId}:${item.id}`, item)
  }

  async updateReviewItem(userId: string, item: ReviewItem): Promise<void> {
    this.store.set(`${userId}:${item.id}`, item)
  }
}

export class FakeUserProfileRepository implements UserProfileRepository {
  private store = new Map<string, UserProfile>()

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return this.store.get(userId) ?? null
  }

  async saveUserProfile(userId: string, profile: UserProfile): Promise<void> {
    this.store.set(userId, profile)
  }
}

export class FakeSessionSubmissionRepository implements SessionSubmissionRepository {
  readonly submissions: Array<{
    userId: string
    session: LearningSession
    effects: SessionSubmissionEffects
  }> = []
  private outcomes = new Map<string, SessionSubmissionOutcome>()

  // When given, applies Progress effects like the real adapters do.
  constructor(private progressRepo?: ProgressRepository) {}

  async submit(
    userId: string,
    session: LearningSession,
    effects: SessionSubmissionEffects,
  ): Promise<SessionSubmissionOutcome> {
    const key = `${userId}:${session.id}`
    const existing = this.outcomes.get(key)
    if (existing) return { ...existing, wasDuplicate: true }
    const outcome = {
      session,
      aggregate: aggregateFromSession(session),
      effects,
      wasDuplicate: false,
    }
    this.outcomes.set(key, outcome)
    this.submissions.push({ userId, session, effects })
    for (const progress of effects.progress)
      await this.progressRepo?.saveProgress(userId, progress)
    return outcome
  }
}

export class FakeOnePageLearningCheckpointRepository implements OnePageLearningCheckpointRepository {
  private store = new Map<string, OnePageLearningCheckpoint>()
  private key(userId: string, courseId: string) {
    return `${userId}:${courseId}`
  }
  async getCheckpoint(userId: string, courseId: string) {
    return this.store.get(this.key(userId, courseId)) ?? null
  }
  async saveCheckpoint(checkpoint: OnePageLearningCheckpoint) {
    this.store.set(this.key(checkpoint.userId, checkpoint.courseId), checkpoint)
  }
  async clearLesson(userId: string, courseId: string, lessonId: string) {
    const checkpoint = await this.getCheckpoint(userId, courseId)
    if (!checkpoint) return
    const completedExerciseIdsByLesson = {
      ...checkpoint.completedExerciseIdsByLesson,
    }
    const partialLessonResults = { ...checkpoint.partialLessonResults }
    delete completedExerciseIdsByLesson[lessonId]
    delete partialLessonResults[lessonId]
    if (
      !Object.keys(completedExerciseIdsByLesson).length &&
      !Object.keys(partialLessonResults).length
    ) {
      this.store.delete(this.key(userId, courseId))
      return
    }
    await this.saveCheckpoint({
      ...checkpoint,
      completedExerciseIdsByLesson,
      partialLessonResults,
    })
  }
}

export class FakeHomeSyncJobRepository implements HomeSyncJobRepository {
  readonly jobs: HomeSyncJob[] = []
  async list() {
    return [...this.jobs].sort(
      (a, b) => a.enqueuedAt.getTime() - b.enqueuedAt.getTime(),
    )
  }
  async save(job: HomeSyncJob) {
    const index = this.jobs.findIndex(({ id }) => id === job.id)
    if (index === -1) this.jobs.push(job)
    else this.jobs[index] = job
  }
  async remove(job: HomeSyncJob) {
    const index = this.jobs.findIndex(({ id }) => id === job.id)
    if (index !== -1) this.jobs.splice(index, 1)
  }
}

export class FakeJamoStatsRepository implements JamoStatsRepository {
  constructor(private readonly stats: Record<string, JamoStats> = {}) {}

  async getJamoStats(userId: string): Promise<JamoStats> {
    return this.stats[userId] ?? {}
  }
}
