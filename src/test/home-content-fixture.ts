import type { HomeContent } from '../domain/models/home-content'

// A valid one-lesson Home export whose exercises type the given targets.
export function homeContentWith(
  targets: string[],
  type: HomeContent['units'][number]['lessons'][number]['type'] = 'word',
): HomeContent {
  return {
    schemaVersion: 1,
    exportedAt: '2026-10-09T00:00:00Z',
    course: { id: 'home', title: 'Home', description: '' },
    units: [
      {
        id: 'unit-1',
        title: 'Unit',
        description: '',
        order: 0,
        lessons: [
          {
            id: 'lesson-1',
            title: 'Lesson',
            type,
            order: 0,
            exercises: targets.map((targetText, index) => ({
              id: `e${index}`,
              targetText,
              romanization: null,
              meaningTh: '',
              meaningEn: '',
              difficulty: 'easy' as const,
              hint: null,
            })),
          },
        ],
      },
    ],
  }
}
