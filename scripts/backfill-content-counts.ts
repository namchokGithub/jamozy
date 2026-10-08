import { getAdminServices } from './admin-sdk'
import { parseMigrationArgs } from './migrate-content-status'

type Counters = Record<string, number>

export type CountChange = {
  path: string
  /** Stored counters before the change; absent counters are omitted. */
  from: Counters
  to: Counters
}

export type CountBackfillSummary = {
  scanned: number
  changes: CountChange[]
  dryRun: boolean
}

interface AdminDocument {
  id: string
  ref: { update(value: Record<string, unknown>): Promise<unknown> }
  data(): Record<string, unknown>
}

interface AdminFirestore {
  collection(name: string): { get(): Promise<{ docs: AdminDocument[] }> }
}

const counterKeys = {
  courses: ['unitCount', 'lessonCount', 'exerciseCount'],
  units: ['lessonCount', 'exerciseCount'],
  lessons: ['exerciseCount'],
} as const

/**
 * Recomputes every content counter (DEC-047) from the documents themselves and
 * updates only documents whose stored counters differ. Re-running it repairs
 * drift. Run it while nobody edits content: an increment made between its
 * read and its write would be overwritten.
 */
export async function backfillContentCounts(
  db: AdminFirestore,
  dryRun: boolean,
): Promise<CountBackfillSummary> {
  const [courses, units, lessons] = await Promise.all(
    (['courses', 'units', 'lessons'] as const).map(
      async (name) => (await db.collection(name).get()).docs,
    ),
  )
  const expected = new Map<AdminDocument, Counters>()
  const unitCourse = new Map<string, string>()
  const courseCounts = new Map<string, Counters>(
    courses.map((course) => [
      course.id,
      { unitCount: 0, lessonCount: 0, exerciseCount: 0 },
    ]),
  )
  const unitCounts = new Map<string, Counters>(
    units.map((unit) => [unit.id, { lessonCount: 0, exerciseCount: 0 }]),
  )

  for (const unit of units) {
    const courseId = String(unit.data().courseId)
    unitCourse.set(unit.id, courseId)
    const course = courseCounts.get(courseId)
    if (course) course.unitCount += 1
  }
  for (const lesson of lessons) {
    const data = lesson.data()
    const exerciseCount = Array.isArray(data.exercises)
      ? data.exercises.length
      : 0
    expected.set(lesson, { exerciseCount })
    const unitId = String(data.unitId)
    const unit = unitCounts.get(unitId)
    if (unit) {
      unit.lessonCount += 1
      unit.exerciseCount += exerciseCount
    }
    const course = courseCounts.get(unitCourse.get(unitId) ?? '')
    if (course) {
      course.lessonCount += 1
      course.exerciseCount += exerciseCount
    }
  }
  for (const course of courses)
    expected.set(course, courseCounts.get(course.id)!)
  for (const unit of units) expected.set(unit, unitCounts.get(unit.id)!)

  const changes: CountChange[] = []
  const collections = [
    ['courses', courses],
    ['units', units],
    ['lessons', lessons],
  ] as const
  for (const [name, documents] of collections) {
    for (const document of documents) {
      const to = expected.get(document)!
      const data = document.data()
      const from = Object.fromEntries(
        counterKeys[name]
          .filter((key) => typeof data[key] === 'number')
          .map((key) => [key, data[key] as number]),
      )
      if (counterKeys[name].every((key) => from[key] === to[key])) continue
      changes.push({ path: `${name}/${document.id}`, from, to })
      if (!dryRun) await document.ref.update(to)
    }
  }
  return {
    scanned: courses.length + units.length + lessons.length,
    changes,
    dryRun,
  }
}

const { mode, confirmedAfterDryRun } = parseMigrationArgs(process.argv.slice(2))
if (import.meta.url === `file://${process.argv[1]}`) {
  if (
    (mode !== '--dry-run' && mode !== '--write') ||
    (mode === '--write' && !confirmedAfterDryRun)
  ) {
    console.error(
      'Run a dry-run first: pnpm content:backfill-counts -- --dry-run. Then use: pnpm content:backfill-counts -- --write --after-dry-run',
    )
    process.exitCode = 1
  } else {
    backfillContentCounts(getAdminServices().db, mode === '--dry-run')
      .then((summary) => {
        for (const change of summary.changes)
          console.log(
            `${change.path}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`,
          )
        console.log(
          `${summary.dryRun ? 'Dry run' : 'Write'}: scanned ${summary.scanned}, ${summary.changes.length} documents with changed counters.`,
        )
      })
      .catch((error) => {
        console.error(error)
        process.exitCode = 1
      })
  }
}
