import { useState } from 'react'
import { Link, useLoaderData } from 'react-router'
import type { ReviewLoaderData } from './ReviewPage.loader'
import ReviewTypingSession from './ReviewTypingSession'
import type { SubmitReviewSessionOutcome } from '../../application/submit-review-session'

export default function ReviewPage() {
  const { items } = useLoaderData() as ReviewLoaderData
  const [started, setStarted] = useState(false)
  const [outcome, setOutcome] = useState<SubmitReviewSessionOutcome | null>(null)

  if (outcome) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-medium text-slate-900">Review complete!</h1>
        <p className="mt-2 text-slate-700">
          {outcome.correctCount} correct, {outcome.needsPracticeCount} need more practice
        </p>
        <Link to="/" className="mt-4 inline-block text-sm text-slate-600 underline">
          Back to Course List
        </Link>
      </main>
    )
  }

  if (started) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-medium text-slate-900">Review</h1>
        <ReviewTypingSession items={items} onComplete={setOutcome} />
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">Review</h1>

      {items.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Nothing due right now.</p>
      ) : (
        <>
          <ul className="mt-6 space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-slate-200 p-3 text-slate-900">
                {item.targetText}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setStarted(true)}
            className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-white"
          >
            Start Review
          </button>
        </>
      )}
    </main>
  )
}
