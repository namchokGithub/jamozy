import type { UserProfile } from '../models/user-profile'

export interface UserProfileRepository {
  getUserProfile(userId: string): Promise<UserProfile | null>
  saveUserProfile(userId: string, profile: UserProfile): Promise<void>
}
