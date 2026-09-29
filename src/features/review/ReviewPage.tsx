import { useState } from 'react'
import { Link, useLoaderData } from 'react-router'
import type { ReviewLoaderData } from './ReviewPage.loader'
import ReviewTypingSession from './ReviewTypingSession'
import type { SubmitReviewSessionOutcome } from '../../application/submit-review-session'
import { formatExerciseMeaning } from '../lesson/format-exercise-meaning'
import { Button } from '../../components/ui/Button'
import { PageSurface } from '../../components/ui/PageSurface'

export default function ReviewPage() {
  const { previews, settings } = useLoaderData() as ReviewLoaderData
  const items = previews.map((preview) => preview.item)
  const [started, setStarted] = useState(false)
  const [outcome, setOutcome] = useState<SubmitReviewSessionOutcome | null>(
    null,
  )

  if (outcome) {
    return (
      <PageSurface contentClassName="max-w-2xl">
        <h1 className="text-2xl font-medium text-slate-900">
          Review complete!
        </h1>
        <p className="mt-2 text-slate-700">
          {outcome.correctCount} correct, {outcome.needsPracticeCount} need more
          practice
        </p>
        <Link
          to="/"
          className="mt-4 inline-block text-sm text-slate-600 underline"
        >
          Back to Course List
        </Link>
      </PageSurface>
    )
  }

  if (started) {
    return (
      <PageSurface contentClassName="max-w-2xl">
        <h1 className="text-2xl font-medium text-slate-900">Review</h1>
        <ReviewTypingSession
          items={items}
          onComplete={setOutcome}
          keyboardSettings={settings}
        />
      </PageSurface>
    )
  }

  return (
    <PageSurface contentClassName="max-w-2xl">
      <h1 className="text-2xl font-medium text-slate-900">Review</h1>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          Mistyped words are added to your Review queue and become available
          when due.
        </p>
      ) : (
        <>
          <ul className="mt-6 space-y-2">
            {previews.map(({ item, exercise }) => {
              const meaning =
                exercise &&
                formatExerciseMeaning(exercise, settings.meaningLanguage)
              return (
                <li
                  key={item.id}
                  className="rounded-3xl border border-[#eadfd4] bg-white/85 p-4 text-[#253247] shadow-sm"
                >
                  <div>{item.targetText}</div>
                  {settings.romanizationEnabled && exercise?.romanization && (
                    <div className="text-sm text-slate-500">
                      {exercise.romanization}
                    </div>
                  )}
                  {meaning && (
                    <div className="mt-1 text-sm text-slate-700">{meaning}</div>
                  )}
                </li>
              )
            })}
          </ul>
          <Button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-6"
          >
            Start Review
          </Button>
        </>
      )}
    </PageSurface>
  )
}
