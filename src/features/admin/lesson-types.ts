import type { Lesson } from '../../domain/models/lesson'

export const lessonTypes: Lesson['type'][] = [
  'character',
  'syllable',
  'word',
  'phrase',
  'sentence',
]
