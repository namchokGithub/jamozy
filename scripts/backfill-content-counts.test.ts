import { describe, expect, it } from 'vitest'
import { backfillContentCounts } from './backfill-content-counts'

type Document = Record<string, unknown>

function fakeDb(collections: Record<string, Record<string, Document>>) {
  let writes = 0
  const db = {
    collection(name: string) {
      return {
        async get() {
          return {
            docs: Object.entries(collections[name] ?? {}).map(([id, data]) => ({
              id,
              data: () => data,
              ref: {
                async update(next: Document) {
                  Object.assign(data, next)
                  writes += 1
                },
              },
            })),
          }
        },
      }
    },
  }
  return { db, writes: () => writes }
}

const exercises = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `e${index}` }))

function content() {
  return {
    courses: {
      course: { title: 'Course' },
      empty: { title: 'Empty', unitCount: 0, lessonCount: 0, exerciseCount: 0 },
    },
    units: {
      first: { courseId: 'course', lessonCount: 9 },
      second: { courseId: 'course' },
    },
    lessons: {
      a: { unitId: 'first', exercises: exercises(2) },
      b: { unitId: 'first', exercises: exercises(3), exerciseCount: 3 },
      c: { unitId: 'second', exercises: exercises(1) },
    },
    users: { learner: { ignored: true } },
  }
}

describe('backfillContentCounts', () => {
  it('reports the counters it would change without writing in a dry run', async () => {
    const data = content()
    const fake = fakeDb(data)

    const summary = await backfillContentCounts(fake.db, true)

    expect(summary).toMatchObject({ scanned: 7, dryRun: true })
    expect(summary.changes.map((change) => change.path)).toEqual([
      'courses/course',
      'units/first',
      'units/second',
      'lessons/a',
      'lessons/c',
    ])
    expect(summary.changes[0]).toEqual({
      path: 'courses/course',
      from: {},
      to: { unitCount: 2, lessonCount: 3, exerciseCount: 6 },
    })
    expect(fake.writes()).toBe(0)
  })

  it('writes only differing counters and is idempotent', async () => {
    const data = content()
    const fake = fakeDb(data)

    await backfillContentCounts(fake.db, false)

    expect(data.courses.course).toMatchObject({
      unitCount: 2,
      lessonCount: 3,
      exerciseCount: 6,
    })
    expect(data.units.first).toMatchObject({ lessonCount: 2, exerciseCount: 5 })
    expect(data.units.second).toMatchObject({
      lessonCount: 1,
      exerciseCount: 1,
    })
    expect(data.lessons.a).toMatchObject({ exerciseCount: 2 })
    expect(fake.writes()).toBe(5)
    expect(data.users.learner).toEqual({ ignored: true })

    const again = await backfillContentCounts(fake.db, false)
    expect(again.changes).toEqual([])
    expect(fake.writes()).toBe(5)
  })
})
