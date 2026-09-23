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

export class FakeProgressRepository implements ProgressRepository {
  private store = new Map<string, Progress>()

  async getProgress(userId: string, lessonId: string): Promise<Progress | null> {
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
