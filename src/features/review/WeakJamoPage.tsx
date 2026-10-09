import { useCallback, useState } from 'react'
import { useLoaderData, useLocation, useNavigate } from 'react-router'
import type { WeakJamoLoaderData } from './WeakJamoPage.loader'
import ReviewTypingSession from './ReviewTypingSession'
import type { CompletedTypingSession } from './review-session-body'
import type { SubmitWeakJamoSessionOutcome } from '../../application/submit-weak-jamo-session'
import { Button } from '../../components/ui/Button'
import { PageHeading } from '../../components/ui/PageHeading'
import { PageNav } from '../../components/ui/PageNav'
import { PageSurface } from '../../components/ui/PageSurface'

interface Finished {
  outcome: SubmitWeakJamoSessionOutcome
  completed: CompletedTypingSession
}

// Weak Jamo practice (DEC-051): Home exercises chosen for the learner's
// weakest key-level jamo, played with the Review typing session. Each
// navigation is one round: "Practice again" navigates, so the loader draws a
// new set and the round remounts once with it (a new submission id).
export default function WeakJamoPage() {
  const location = useLocation()
  return <WeakJamoRound key={location.key} />
}

function WeakJamoRound() {
  const loaderData = useLoaderData() as WeakJamoLoaderData
  // The set this round started with, kept for its results and labels.
  const [{ targets, exercises, settings }] = useState(loaderData)
  const navigate = useNavigate()
  const [finished, setFinished] = useState<Finished | null>(null)
  const handleComplete = useCallback(
    (outcome: SubmitWeakJamoSessionOutcome, completed: CompletedTypingSession) =>
      setFinished({ outcome, completed }),
    [],
  )
  const title = `Practice ${targets.map((target) => target.jamo).join(' ')}`
  const lessonTypes = new Map(
    exercises.map((exercise) => [exercise.id, exercise.lessonType]),
  )

  const buildBody = ({
    submissionId,
    metrics,
    results,
  }: CompletedTypingSession) => ({
    submissionId,
    durationSeconds: metrics.durationSeconds,
    startedAtMs: metrics.startedAtMs,
    exercisesAttempted: metrics.exercisesAttempted,
    acceptedKeystrokes: metrics.acceptedKeystrokes,
    rejectedKeystrokes: metrics.rejectedKeystrokes,
    ...(metrics.jamoCounts ? { jamoCounts: metrics.jamoCounts } : {}),
    results: results.map((result) => ({
      exerciseId: result.exerciseId,
      targetText: result.targetText,
      lessonType: lessonTypes.get(result.exerciseId) ?? 'word',
      wasCorrect: result.mistakes.length === 0,
      mistakeCount: result.mistakes.length,
      typingSeconds: result.typingSeconds ?? 0,
      elapsedSeconds: result.elapsedSeconds ?? 0,
    })),
  })

  const nav = <PageNav backTo="/review" backLabel="Review" />

  if (finished) {
    const counts = finished.completed.metrics.jamoCounts ?? {}
    return (
      <PageSurface contentClassName="max-w-2xl">
        {nav}
        <PageHeading eyebrow="NICE WORK" title="Practice complete!">
          <p className="mt-2 text-[#667085]">
            {finished.outcome.correctCount} correct,{' '}
            {finished.outcome.needsPracticeCount} need more practice
          </p>
        </PageHeading>
        <ul className="mt-6 space-y-2">
          {targets.map(({ jamo }) => {
            const count = counts[jamo]
            const total = count ? count.accepted + count.rejected : 0
            return (
              <li
                key={jamo}
                className="flex justify-between rounded-3xl border border-[#eadfd4] bg-white/85 p-4 text-[#253247] shadow-sm"
              >
                <span className="text-xl">{jamo}</span>
                <span className="text-sm text-[#667085]">
                  {total === 0
                    ? '–'
                    : `${Math.round((count.accepted / total) * 100)}% accuracy`}
                </span>
              </li>
            )
          })}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={() => navigate('/review/weak-jamo', { replace: true })}
          >
            Practice again
          </Button>
          <Button variant="secondary" onClick={() => navigate('/review')}>
            Back to Review
          </Button>
        </div>
      </PageSurface>
    )
  }

  return (
    <PageSurface contentClassName="max-w-2xl">
      {nav}
      <PageHeading eyebrow="WEAK JAMO" title={title} />
      <ReviewTypingSession<SubmitWeakJamoSessionOutcome>
        exercises={exercises}
        buildBody={buildBody}
        onComplete={handleComplete}
        keyboardSettings={settings}
      />
    </PageSurface>
  )
}
