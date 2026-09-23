import { existsSync } from 'node:fs'
import { config } from 'dotenv'
import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import { doc, getFirestore, setDoc } from 'firebase/firestore'
import {
  seedCourses,
  seedLessons,
  seedUnits,
} from '../src/infrastructure/firebase/seed/sample-content'

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

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

async function seed() {
  await signInAnonymously(auth)

  const now = new Date()

  for (const course of seedCourses) {
    await setDoc(doc(db, 'courses', course.id), {
      title: course.title,
      description: course.description,
      order: course.order,
      createdAt: now,
      updatedAt: now,
    })
    console.log(`course: ${course.id}`)
  }

  for (const unit of seedUnits) {
    await setDoc(doc(db, 'units', unit.id), {
      courseId: unit.courseId,
      title: unit.title,
      description: unit.description,
      order: unit.order,
      createdAt: now,
      updatedAt: now,
    })
    console.log(`unit: ${unit.id}`)
  }

  for (const lesson of seedLessons) {
    await setDoc(doc(db, 'lessons', lesson.id), {
      unitId: lesson.unitId,
      title: lesson.title,
      type: lesson.type,
      order: lesson.order,
      exercises: lesson.exercises,
      createdAt: now,
      updatedAt: now,
    })
    console.log(`lesson: ${lesson.id}`)
  }

  console.log('Seed complete.')
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
