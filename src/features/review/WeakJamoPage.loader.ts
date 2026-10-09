import { redirect, type ShouldRevalidateFunction } from 'react-router'
import {
  getWeakJamoPractice,
  type WeakJamoDeps,
} from '../../application/get-weak-jamo-practice'
import { getSettings } from '../../application/get-settings'
import type {
  PracticeExercise,
  WeakJamoTarget,
} from '../../domain/practice/weak-jamo'
import type { UserSettings } from '../../domain/models/user-profile'
import type { UserProfileRepository } from '../../domain/repositories/user-profile-repository'

export interface WeakJamoLoaderData {
  targets: WeakJamoTarget[]
  exercises: PracticeExercise[]
  settings: UserSettings
}

export function createWeakJamoLoader(
  deps: WeakJamoDeps & {
    userProfileRepo: UserProfileRepository
    ensureUser: () => Promise<{ uid: string }>
  },
) {
  return async (): Promise<WeakJamoLoaderData> => {
    const user = await deps.ensureUser()
    const [practice, settings] = await Promise.all([
      getWeakJamoPractice(deps, user.uid),
      getSettings(deps.userProfileRepo, user.uid),
    ])
    // Nothing to practice yet: the Review page explains what is available.
    if (!practice) throw redirect('/review')
    return { ...practice, settings }
  }
}

// Saving a round must not redraw it: a new draw would remount the session,
// hide the results or the retry, and redirect away when offline. Only a
// navigation ("Practice again") draws a new set.
export const weakJamoShouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  defaultShouldRevalidate,
}) => (formMethod ? false : defaultShouldRevalidate)
