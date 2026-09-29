import {
  getProfileSummary,
  type ProfileSummary,
} from '../../application/get-profile-summary'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'
import type { ProgressRepository } from '../../domain/repositories/progress-repository'

export interface ProfileLoaderData {
  summary: ProfileSummary
}

export function createProfileLoader(deps: {
  userProfileRepo: UserProfileRepository
  progressRepo: ProgressRepository
  ensureUser: () => Promise<{ uid: string }>
}) {
  return async (): Promise<ProfileLoaderData> => {
    const user = await deps.ensureUser()
    const [summary, progress] = await Promise.all([
      getProfileSummary(deps.userProfileRepo, user.uid),
      deps.progressRepo.getAllProgress(user.uid),
    ])
    return {
      summary: {
        ...summary,
        stats: {
          ...summary.stats,
          lessonsCompleted: progress.filter((item) => item.status === 'completed').length,
        },
      },
    }
  }
}
