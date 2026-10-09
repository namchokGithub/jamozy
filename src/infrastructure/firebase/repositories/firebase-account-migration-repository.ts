import { collection, doc, getDoc, getDocs, runTransaction, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { mergeProfile, mergeProgress, mergeReviewItem, type GuestMigrationSnapshot, type MigrationMarker } from '../../../domain/models/guest-migration'
import { addSessionAggregate, emptySessionAggregate, type SessionAggregate } from '../../../domain/models/session-aggregate'
import type { AccountMigrationRepository } from '../../../domain/repositories/account-migration-repository'
import type { SessionSubmissionOutcome } from '../../../domain/repositories/session-submission-repository'
import { toProgress, toProgressDoc } from '../mappers/progress-mapper'
import { toReviewItem, toReviewItemDoc } from './firebase-review-repository'
import { toUserProfile, toUserProfileDoc } from './firebase-user-profile-repository'
import { readSessionStatsWrites } from './firestore-player-stats'

type FirebaseMigrationDependencies = {
  db: typeof db
  doc: typeof doc
  collection: typeof collection
  getDoc: typeof getDoc
  getDocs: typeof getDocs
  setDoc: typeof setDoc
  runTransaction: typeof runTransaction
}

const firebaseMigrationDependencies: FirebaseMigrationDependencies = { db, doc, collection, getDoc, getDocs, setDoc, runTransaction }
const sessionDoc = (session: SessionSubmissionOutcome['session']) =>
  Object.fromEntries(Object.entries(session).filter(([key]) => key !== 'id'))

export class FirebaseAccountMigrationRepository implements AccountMigrationRepository {
  constructor(private dependencies: FirebaseMigrationDependencies = firebaseMigrationDependencies) {}

  async getMarker(accountId: string, guestId: string): Promise<MigrationMarker | null> {
    const { db, doc, getDoc } = this.dependencies
    const snapshot = await getDoc(doc(db, 'users', accountId, 'migrations', guestId))
    if (!snapshot.exists()) return null
    const data = snapshot.data()
    return { guestId, accountId, completedAt: (data.completedAt as { toDate(): Date }).toDate() }
  }

  async mergeInitialState(accountId: string, _guestId: string, snapshot: GuestMigrationSnapshot): Promise<void> {
    const { db, doc, getDoc, setDoc, runTransaction } = this.dependencies
    const profileRef = doc(db, 'users', accountId)
    await runTransaction(db, async (transaction) => {
      const cloud = await transaction.get(profileRef)
      const merged = mergeProfile(cloud.exists() ? toUserProfile(accountId, cloud.data()) : null, snapshot.profile)
      if (merged) transaction.set(profileRef, toUserProfileDoc({ ...merged, id: accountId }))
    })

    for (const guestProgress of snapshot.progress) {
      const progressRef = doc(db, 'users', accountId, 'lessonProgress', guestProgress.lessonId)
      await runTransaction(db, async (transaction) => {
        const cloud = await transaction.get(progressRef)
        transaction.set(progressRef, toProgressDoc(mergeProgress(cloud.exists() ? toProgress(guestProgress.lessonId, cloud.data()) : null, guestProgress)))
      })
    }

    for (const guestReview of snapshot.reviewItems) {
      const reviewRef = doc(db, 'users', accountId, 'reviewItems', guestReview.id)
      await runTransaction(db, async (transaction) => {
        const cloud = await transaction.get(reviewRef)
        transaction.set(reviewRef, toReviewItemDoc(mergeReviewItem(cloud.exists() ? toReviewItem(guestReview.id, cloud.data()) : null, guestReview)))
      })
    }

    const receiptIds = new Set(snapshot.sessionOutcomes.map((outcome) => outcome.session.id))
    for (const session of snapshot.sessions.filter((candidate) => !receiptIds.has(candidate.id))) {
      const sessionRef = doc(db, 'users', accountId, 'learningSessions', session.id)
      const cloud = await getDoc(sessionRef)
      if (!cloud.exists()) await setDoc(sessionRef, sessionDoc(session))
    }
  }

  async migrateSessionOutcome(accountId: string, outcome: SessionSubmissionOutcome): Promise<void> {
    const { db, doc, runTransaction } = this.dependencies
    await runTransaction(db, async (transaction) => {
      const receiptRef = doc(db, 'users', accountId, 'sessionOutcomes', outcome.session.id)
      const receipt = await transaction.get(receiptRef)
      if (receipt.exists()) return
      const profileRef = doc(db, 'users', accountId)
      const profile = await transaction.get(profileRef)
      const current = (profile.data()?.sessionAggregate as SessionAggregate | undefined) ?? emptySessionAggregate()
      const progressReads = await Promise.all(outcome.effects.progress.map(async (guestProgress) => ({ guestProgress, progressRef: doc(db, 'users', accountId, 'lessonProgress', guestProgress.lessonId), cloud: await transaction.get(doc(db, 'users', accountId, 'lessonProgress', guestProgress.lessonId)) })))
      const reviewReads = await Promise.all(outcome.effects.reviewItems.map(async (guestReview) => ({ guestReview, reviewRef: doc(db, 'users', accountId, 'reviewItems', guestReview.id), cloud: await transaction.get(doc(db, 'users', accountId, 'reviewItems', guestReview.id)) })))
      const writeStats = await readSessionStatsWrites({ db, doc }, transaction, accountId, profile.data(), outcome.session)
      for (const { guestProgress, progressRef, cloud } of progressReads) {
        transaction.set(progressRef, toProgressDoc(mergeProgress(cloud.exists() ? toProgress(guestProgress.lessonId, cloud.data()) : null, guestProgress)))
      }
      for (const { guestReview, reviewRef, cloud } of reviewReads) {
        transaction.set(reviewRef, toReviewItemDoc(mergeReviewItem(cloud.exists() ? toReviewItem(guestReview.id, cloud.data()) : null, guestReview)))
      }
      transaction.set(doc(db, 'users', accountId, 'learningSessions', outcome.session.id), sessionDoc(outcome.session))
      transaction.set(receiptRef, outcome)
      transaction.set(profileRef, { sessionAggregate: addSessionAggregate(current, outcome.aggregate), ...writeStats(transaction) }, { merge: true })
    })
  }

  async markComplete(marker: MigrationMarker): Promise<void> {
    const { db, doc, setDoc } = this.dependencies
    await setDoc(doc(db, 'users', marker.accountId, 'migrations', marker.guestId), { completedAt: marker.completedAt })
  }
}
