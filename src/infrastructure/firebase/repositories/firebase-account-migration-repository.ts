import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase'
import {
  mergeProfile,
  mergeProgress,
  mergeReviewItem,
  shouldUseGuestProgression,
  type GuestMigrationSnapshot,
  type MigrationMarker,
} from '../../../domain/models/guest-migration'
import {
  addSessionAggregate,
  emptySessionAggregate,
  type SessionAggregate,
} from '../../../domain/models/session-aggregate'
import type { AccountMigrationRepository } from '../../../domain/repositories/account-migration-repository'
import type { SessionSubmissionOutcome } from '../../../domain/repositories/session-submission-repository'
import type { RebirthRecord } from '../../../domain/models/rebirth'
import {
  awardProgressionExp,
  progressionOf,
} from '../../../domain/models/user-profile'
import { toProgress, toProgressDoc } from '../mappers/progress-mapper'
import { toReviewItem, toReviewItemDoc } from './firebase-review-repository'
import {
  toUserProfile,
  toUserProfileDoc,
} from './firebase-user-profile-repository'
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

const firebaseMigrationDependencies: FirebaseMigrationDependencies = {
  db,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  runTransaction,
}
const sessionDoc = (session: SessionSubmissionOutcome['session']) =>
  Object.fromEntries(Object.entries(session).filter(([key]) => key !== 'id'))

export class FirebaseAccountMigrationRepository implements AccountMigrationRepository {
  constructor(
    private dependencies: FirebaseMigrationDependencies = firebaseMigrationDependencies,
  ) {}

  async getMarker(
    accountId: string,
    guestId: string,
  ): Promise<MigrationMarker | null> {
    const { db, doc, getDoc } = this.dependencies
    const snapshot = await getDoc(
      doc(db, 'users', accountId, 'migrations', guestId),
    )
    if (!snapshot.exists()) return null
    const data = snapshot.data()
    if (data.status === 'started') return null
    return {
      guestId,
      accountId,
      completedAt: (data.completedAt as { toDate(): Date }).toDate(),
    }
  }

  async mergeInitialState(
    accountId: string,
    guestId: string,
    snapshot: GuestMigrationSnapshot,
  ): Promise<void> {
    const { db, doc, getDoc, setDoc, runTransaction } = this.dependencies
    const profileRef = doc(db, 'users', accountId)
    const migrationRef = doc(db, 'users', accountId, 'migrations', guestId)
    await runTransaction(db, async (transaction) => {
      const cloud = await transaction.get(profileRef)
      const cloudProfile = cloud.exists()
        ? toUserProfile(accountId, cloud.data())
        : null
      const merged = mergeProfile(cloudProfile, snapshot.profile)
      if (merged)
        transaction.set(
          profileRef,
          toUserProfileDoc({ ...merged, id: accountId }),
        )
      transaction.set(
        migrationRef,
        {
          status: 'started',
          useGuestProgression: shouldUseGuestProgression(cloudProfile),
        },
        { merge: true },
      )
    })

    for (const guestProgress of snapshot.progress) {
      const progressRef = doc(
        db,
        'users',
        accountId,
        'lessonProgress',
        guestProgress.lessonId,
      )
      await runTransaction(db, async (transaction) => {
        const cloud = await transaction.get(progressRef)
        transaction.set(
          progressRef,
          toProgressDoc(
            mergeProgress(
              cloud.exists()
                ? toProgress(guestProgress.lessonId, cloud.data())
                : null,
              guestProgress,
            ),
          ),
        )
      })
    }

    for (const guestReview of snapshot.reviewItems) {
      const reviewRef = doc(
        db,
        'users',
        accountId,
        'reviewItems',
        guestReview.id,
      )
      await runTransaction(db, async (transaction) => {
        const cloud = await transaction.get(reviewRef)
        transaction.set(
          reviewRef,
          toReviewItemDoc(
            mergeReviewItem(
              cloud.exists()
                ? toReviewItem(guestReview.id, cloud.data())
                : null,
              guestReview,
            ),
          ),
        )
      })
    }

    const receiptIds = new Set(
      snapshot.sessionOutcomes.map((outcome) => outcome.session.id),
    )
    for (const session of snapshot.sessions.filter(
      (candidate) => !receiptIds.has(candidate.id),
    )) {
      const sessionRef = doc(
        db,
        'users',
        accountId,
        'learningSessions',
        session.id,
      )
      const cloud = await getDoc(sessionRef)
      if (!cloud.exists()) await setDoc(sessionRef, sessionDoc(session))
    }
  }

  async migrateSessionOutcome(
    accountId: string,
    guestId: string,
    outcome: SessionSubmissionOutcome,
  ): Promise<void> {
    const { db, doc, runTransaction } = this.dependencies
    await runTransaction(db, async (transaction) => {
      const receiptRef = doc(
        db,
        'users',
        accountId,
        'sessionOutcomes',
        outcome.session.id,
      )
      const receipt = await transaction.get(receiptRef)
      if (receipt.exists()) return
      const profileRef = doc(db, 'users', accountId)
      const profile = await transaction.get(profileRef)
      const migration = await transaction.get(
        doc(db, 'users', accountId, 'migrations', guestId),
      )
      const current =
        (profile.data()?.sessionAggregate as SessionAggregate | undefined) ??
        emptySessionAggregate()
      const progressReads = await Promise.all(
        outcome.effects.progress.map(async (guestProgress) => {
          const progressRef = doc(
            db,
            'users',
            accountId,
            'lessonProgress',
            guestProgress.lessonId,
          )
          return {
            guestProgress,
            progressRef,
            cloud: await transaction.get(progressRef),
          }
        }),
      )
      const reviewReads = await Promise.all(
        outcome.effects.reviewItems.map(async (guestReview) => {
          const reviewRef = doc(
            db,
            'users',
            accountId,
            'reviewItems',
            guestReview.id,
          )
          return {
            guestReview,
            reviewRef,
            cloud: await transaction.get(reviewRef),
          }
        }),
      )
      const writeStats = await readSessionStatsWrites(
        { db, doc },
        transaction,
        accountId,
        profile.data(),
        outcome.session,
      )
      for (const { guestProgress, progressRef, cloud } of progressReads) {
        transaction.set(
          progressRef,
          toProgressDoc(
            mergeProgress(
              cloud.exists()
                ? toProgress(guestProgress.lessonId, cloud.data())
                : null,
              guestProgress,
            ),
          ),
        )
      }
      for (const { guestReview, reviewRef, cloud } of reviewReads) {
        transaction.set(
          reviewRef,
          toReviewItemDoc(
            mergeReviewItem(
              cloud.exists()
                ? toReviewItem(guestReview.id, cloud.data())
                : null,
              guestReview,
            ),
          ),
        )
      }
      transaction.set(
        doc(db, 'users', accountId, 'learningSessions', outcome.session.id),
        sessionDoc(outcome.session),
      )
      transaction.set(receiptRef, outcome)
      const migrationState = migration.data()
      const profileData = profile.data()
      const progression = progressionOf({
        exp: typeof profileData?.exp === 'number' ? profileData.exp : 0,
        sessionAggregate: current,
        progression: profileData?.progression as never,
      })
      const importedProgression = migrationState?.useGuestProgression
        ? undefined
        : (() => {
            const awarded = awardProgressionExp(
              progression,
              outcome.session.expGained,
            )
            return progression.rebirthCount > 0
              ? { ...awarded, currentExp: progression.currentExp }
              : awarded
          })()
      transaction.set(
        profileRef,
        {
          sessionAggregate: addSessionAggregate(current, outcome.aggregate),
          ...(importedProgression ? { progression: importedProgression } : {}),
          ...writeStats(transaction),
        },
        { merge: true },
      )
    })
  }

  async migrateRebirth(
    accountId: string,
    _guestId: string,
    record: RebirthRecord,
  ): Promise<void> {
    const { db, doc, runTransaction } = this.dependencies
    await runTransaction(db, async (transaction) => {
      const recordRef = doc(db, 'users', accountId, 'rebirths', record.id)
      if ((await transaction.get(recordRef)).exists()) return
      transaction.set(recordRef, record)
    })
  }

  async reconcileRebirths(accountId: string): Promise<void> {
    const { db, collection, doc, getDocs, runTransaction } = this.dependencies
    const profileRef = doc(db, 'users', accountId)
    const recordsRef = collection(db, 'users', accountId, 'rebirths')
    const recordsSnapshot = await getDocs(recordsRef)
    const records: RebirthRecord[] = recordsSnapshot.docs.map(
      (recordSnapshot) => recordSnapshot.data() as RebirthRecord,
    )
    await runTransaction(db, async (transaction) => {
      const profileSnapshot = await transaction.get(profileRef)
      if (!profileSnapshot.exists()) throw new Error('User profile is required')
      const profile = toUserProfile(accountId, profileSnapshot.data())
      const progression = progressionOf(profile)
      transaction.set(
        profileRef,
        {
          progression: {
            ...progression,
            rebirthCount: records.length,
            perkPointsEarned: records.length,
            highestLevel: Math.max(
              progression.highestLevel,
              ...records.map((record) => record.levelAtRebirth),
            ),
          },
        },
        { merge: true },
      )
    })
  }

  async markComplete(marker: MigrationMarker): Promise<void> {
    const { db, doc, setDoc } = this.dependencies
    await setDoc(
      doc(db, 'users', marker.accountId, 'migrations', marker.guestId),
      { status: 'completed', completedAt: marker.completedAt },
      { merge: true },
    )
  }
}
