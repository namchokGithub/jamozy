import type { UserProfile } from '../domain/models/user-profile'
import type { UserProfileRepository } from '../domain/repositories/user-profile-repository'

export async function updateDisplayName(
  repository: UserProfileRepository,
  userId: string,
  displayName: string,
  now: Date = new Date(),
): Promise<UserProfile> {
  const normalized = displayName.trim()
  if (!normalized) throw new Error('Display name is required')
  const existing = await repository.getUserProfile(userId)
  if (!existing) throw new Error('User profile is required')
  const updated = { ...existing, displayName: normalized, updatedAt: now }
  await repository.saveUserProfile(userId, updated)
  return updated
}
