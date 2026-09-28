import type { UserProfile } from '../../domain/models/user-profile'
import type { Progress } from '../../domain/models/progress'
import type { ReviewItem } from '../../domain/models/review-item'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import type { ProgressRepository } from '../../domain/repositories/progress-repository'
import type { ReviewRepository } from '../../domain/repositories/review-repository'
import { GuestDatabase, guestDatabase } from './guest-database'
const key = (userId: string, id = '') => `${userId}:${id}`
export class LocalUserProfileRepository implements UserProfileRepository { constructor(private db: GuestDatabase = guestDatabase) {} async getUserProfile(id: string) { return this.db.get<UserProfile>('profiles', key(id)) } async saveUserProfile(id: string, p: UserProfile) { await this.db.put('profiles', key(id), p) } }
export class LocalProgressRepository implements ProgressRepository { constructor(private db: GuestDatabase = guestDatabase) {} async getProgress(u: string, l: string) { return this.db.get<Progress>('progress', key(u, l)) } async getAllProgress(u: string) { return this.db.getAll<Progress>('progress', key(u, '')) } async saveProgress(u: string, p: Progress) { await this.db.put('progress', key(u, p.lessonId), p) } }
export class LocalReviewRepository implements ReviewRepository { constructor(private db: GuestDatabase = guestDatabase) {} async getReviewItems(u: string) { return this.db.getAll<ReviewItem>('reviewItems', key(u, '')) } async getReviewItem(u: string, i: string) { return this.db.get<ReviewItem>('reviewItems', key(u, i)) } async addReviewItem(u: string, i: ReviewItem) { await this.db.put('reviewItems', key(u, i.id), i) } async updateReviewItem(u: string, i: ReviewItem) { await this.addReviewItem(u, i) } }
