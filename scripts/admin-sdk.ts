import { existsSync } from 'node:fs'
import { config } from 'dotenv'
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

if (existsSync('.env.local')) config({ path: '.env.local', override: true })

export function getAdminServices() {
  if (!getApps().length) initializeApp({ credential: applicationDefault() })
  return { auth: getAuth(), db: getFirestore() }
}
