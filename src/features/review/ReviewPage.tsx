import { useState } from 'react'
import { Link, useLoaderData } from 'react-router'
import type { ReviewLoaderData } from './ReviewPage.loader'
import ReviewTypingSession from './ReviewTypingSession'
import type { SubmitReviewSessionOutcome } from '../../application/submit-review-session'
import { formatExerciseMeaning } from '../lesson/format-exercise-meaning'
import { Button } from '../../components/ui/Button'
import { PageHeading } from '../../components/ui/PageHeading'
import { PageNav } from '../../components/ui/PageNav'
import { PageSurface } from '../../components/ui/PageSurface'

export default function ReviewPage() {
  const { previews, settings, weakJamo } = useLoaderData() as ReviewLoaderData
  const items = previews.map((preview) => preview.item)
  const [started, setStarted] = useState(false)
  const [outcome, setOutcome] = useState<SubmitReviewSessionOutcome | null>(
    null,
  )

  const nav = <PageNav backTo="/" backLabel="Home" />

  if (outcome) {
    return (
      <PageSurface contentClassName="max-w-2xl">
        {nav}
        <PageHeading eyebrow="NICE WORK" title="Review complete!">
          <p className="mt-2 text-[#667085]">
            {outcome.correctCount} correct, {outcome.needsPracticeCount} need
            more practice
          </p>
        </PageHeading>
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
        {nav}
        <PageHeading eyebrow="TYPING NOW" title="Review" />
        <ReviewTypingSession<SubmitReviewSessionOutcome>
          exercises={items}
          onComplete={setOutcome}
          keyboardSettings={settings}
        />
      </PageSurface>
    )
  }

  return (
    <PageSurface contentClassName="max-w-2xl">
      {nav}
      <PageHeading eyebrow="PRACTICE YOUR MISTAKES" title="Review" />

      {weakJamo && (
        <div className="mt-6 rounded-3xl border border-[#eadfd4] bg-white/85 p-4 text-[#253247] shadow-sm">
          <div className="font-semibold">Practice weak jamo</div>
          <p className="mt-1 text-sm text-[#667085]">
            {weakJamo.targets
              .map(
                (target) =>
                  `${target.jamo} ${Math.round(target.mistakeRate * 100)}%`,
              )
              .join(' · ')}
          </p>
          <Link
            to="/review/weak-jamo"
            className="mt-3 inline-flex items-center justify-center rounded-full border border-[#a85d4e] bg-[#a85d4e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8d4c43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]"
          >
            Practice {weakJamo.available} words
          </Link>
        </div>
      )}

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
                  {(meaning && (
                    <div className="mt-1 text-sm text-slate-700">{meaning}</div>
                  )) || (
                    <div className="mt-1 text-sm italic text-[#7c8795]">
                      No meaning yet
                    </div>
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
