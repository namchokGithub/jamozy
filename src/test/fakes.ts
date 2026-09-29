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
import type { AdminContentRepository } from '../domain/repositories/admin-content-repository'

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
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.courses.push(item)
    return item
  }
  async saveCourse(course: Course) {
    this.replace(this.courses, course)
  }
  async createUnit(input: Pick<Unit, 'courseId' | 'title' | 'description'>) {
    const item: Unit = {
      id: `unit-${this.units.length + 1}`,
      ...input,
      order: (await this.getUnitsByCourseId(input.courseId)).length,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.units.push(item)
    return item
  }
  async saveUnit(unit: Unit) {
    this.replace(this.units, unit)
  }
  async createLesson(input: Pick<Lesson, 'unitId' | 'title' | 'type'>) {
    const item: Lesson = {
      id: `lesson-${this.lessons.length + 1}`,
      ...input,
      order: (await this.getLessonsByUnitId(input.unitId)).length,
      exercises: [],
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    this.lessons.push(item)
    return item
  }
  async saveLesson(lesson: Lesson) {
    this.replace(this.lessons, lesson)
  }
  async moveUnit(id: string, direction: 'up' | 'down') {
    await this.move(this.units, id, direction, (item) => item.courseId)
  }
  async moveLesson(id: string, direction: 'up' | 'down') {
    await this.move(this.lessons, id, direction, (item) => item.unitId)
  }

  private replace<T extends { id: string }>(items: T[], next: T) {
    const index = items.findIndex((item) => item.id === next.id)
    if (index >= 0) items[index] = next
  }
  private async move<T extends { id: string; order: number }>(
    items: T[],
    id: string,
    direction: 'up' | 'down',
    key: (item: T) => string,
  ) {
    const current = items.find((item) => item.id === id)
    if (!current) return
    const siblings = items
      .filter((item) => key(item) === key(current))
      .sort((a, b) => a.order - b.order)
    const neighbor =
      siblings[
        siblings.findIndex((item) => item.id === id) +
          (direction === 'up' ? -1 : 1)
      ]
    if (!neighbor) return
    const order = current.order
    current.order = neighbor.order
    neighbor.order = order
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
    return outcome
  }
}
