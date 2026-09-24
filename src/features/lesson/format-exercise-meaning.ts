import type { LessonExercise } from '../../domain/models/lesson'
import type { UserSettings } from '../../domain/models/user-profile'

export function formatExerciseMeaning(
  exercise: Pick<LessonExercise, 'meaningTh' | 'meaningEn'>,
  meaningLanguage: UserSettings['meaningLanguage'],
): string | null {
  const parts: string[] = []
  if (meaningLanguage !== 'en' && exercise.meaningTh) parts.push(exercise.meaningTh)
  if (meaningLanguage !== 'th' && exercise.meaningEn) parts.push(exercise.meaningEn)
  return parts.length > 0 ? parts.join(' / ') : null
}
