// Exports the published Home course to public/content/home.json (DEC-043).
// Read-only: it queries published content the same way learners can, so it
// needs only the public VITE_FIREBASE_* config, no credentials.
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from 'dotenv'
import { initializeApp } from 'firebase/app'
import {
  collection,
  getDocs,
  getFirestore,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { buildHomeContent } from '../src/application/build-home-content'
import { courseType, type Course } from '../src/domain/models/course'
import type { Lesson } from '../src/domain/models/lesson'
import type { Unit } from '../src/domain/models/unit'

const OUTPUT = 'public/content/home.json'

if (existsSync('.env.local')) {
  config({ path: '.env.local', override: true })
}

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.projectId) {
  throw new Error(
    'VITE_FIREBASE_PROJECT_ID is not set — check .env.local exists and is loaded.',
  )
}

const db = getFirestore(initializeApp(firebaseConfig))

const toDate = (value: unknown) =>
  value && typeof value === 'object' && 'toDate' in value
    ? (value as { toDate(): Date }).toDate()
    : new Date(0)

function toCourse(id: string, data: DocumentData): Course {
  return {
    id,
    title: data.title,
    description: data.description,
    order: data.order,
    status: data.status,
    ...(data.type === 'home' || data.type === 'learning'
      ? { type: data.type }
      : {}),
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

function toUnit(id: string, data: DocumentData): Unit {
  return {
    id,
    courseId: data.courseId,
    title: data.title,
    description: data.description,
    order: data.order,
    status: data.status,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

function toLesson(id: string, data: DocumentData): Lesson {
  return {
    id,
    unitId: data.unitId,
    title: data.title,
    type: data.type,
    order: data.order,
    exercises: data.exercises ?? [],
    status: data.status,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  }
}

async function published(name: string, ...filters: ReturnType<typeof where>[]) {
  const snapshot = await getDocs(
    query(collection(db, name), where('status', '==', 'published'), ...filters),
  )
  return snapshot.docs
}

async function exportHomeContent() {
  const courses = (await published('courses')).map((d) =>
    toCourse(d.id, d.data()),
  )
  const homeCourses = courses.filter((course) => courseType(course) === 'home')
  // buildHomeContent reports none (skip) or more than one (error).
  const units =
    homeCourses.length === 1
      ? (
          await published('units', where('courseId', '==', homeCourses[0].id))
        ).map((d) => toUnit(d.id, d.data()))
      : []
  const lessons = (
    await Promise.all(
      units.map((unit) => published('lessons', where('unitId', '==', unit.id))),
    )
  )
    .flat()
    .map((d) => toLesson(d.id, d.data()))

  const content = buildHomeContent({
    courses,
    units,
    lessons,
    exportedAt: new Date(),
  })
  if (!content) {
    // Not an error: the Home course may not be authored yet. Remove any
    // stale export so an unpublished course is never shipped.
    rmSync(OUTPUT, { force: true })
    console.warn(
      'No published Home course found; skipping the Home export. Home will have no content.',
    )
    return
  }
  mkdirSync(dirname(OUTPUT), { recursive: true })
  writeFileSync(OUTPUT, `${JSON.stringify(content)}\n`)
  const exerciseCount = content.units
    .flatMap(({ lessons: unitLessons }) => unitLessons)
    .reduce((total, lesson) => total + lesson.exercises.length, 0)
  console.log(
    `Exported "${content.course.title}": ${content.units.length} units, ${exerciseCount} exercises → ${OUTPUT}`,
  )
}

exportHomeContent()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
