import type { LessonCompletion } from './LessonTypingSession'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageHeading } from '../../components/ui/PageHeading'

interface LessonResultProps {
  completion: LessonCompletion
  onRetry: () => void
  onReview: () => void
  onContinue: () => void
}

export default function LessonResult({
  completion,
  onRetry,
  onReview,
  onContinue,
}: LessonResultProps) {
  const { outcome, result } = completion
  const mistypedWords = [
    ...new Set(result.mistakes.map((mistake) => mistake.targetText)),
  ]

  const stats = [
    { label: 'Accuracy', value: `${Math.round(result.accuracy)}%` },
    { label: 'Typing speed', value: `${Math.round(result.speedWpm)} WPM` },
    { label: 'Time', value: `${Math.round(result.durationSeconds)}s` },
    { label: 'Mistakes', value: `${result.rejectedKeystrokes}` },
  ]

  return (
    <>
      <PageHeading eyebrow="NICE WORK" title="Lesson complete!">
        <p className="mt-2 text-[#667085]">
          +{outcome.expGained} EXP — now level {outcome.level}
        </p>
      </PageHeading>
      <Card aria-label="Lesson results" className="mt-6" role="region">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map(({ label, value }) => (
            <div
              key={label}
              className="flex flex-col-reverse rounded-2xl bg-[#fffaf5] px-4 py-3"
            >
              <dt className="mt-1 text-xs font-semibold text-[#98a2b3]">
                {label}
              </dt>{' '}
              <dd className="text-2xl font-bold tracking-tight text-[#253247]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {result.mistakes.length === 0 ? (
          <p className="mt-4 text-sm font-semibold text-[#58733f]">
            No mistakes — nice work!
          </p>
        ) : (
          <>
            <h2 className="mt-4 text-sm font-bold text-[#39465b]">
              Words to review
            </h2>
            <ul className="mt-1 list-disc pl-5 text-sm text-[#596579]">
              {mistypedWords.map((targetText) => (
                <li key={targetText}>{targetText}</li>
              ))}
            </ul>
          </>
        )}
      </Card>
      {outcome.unlockedNextLessonId && (
        <p className="mt-4 text-sm font-semibold text-[#8b6035]">
          Next lesson unlocked.
        </p>
      )}
      <Button className="mt-6" variant="secondary" onClick={onRetry}>
        Retry
      </Button>
      <Button className="ml-3" variant="secondary" onClick={onReview}>
        Go to Review
      </Button>
      <Button className="ml-3" onClick={onContinue}>
        {outcome.unlockedNextLessonId ? 'Next Lesson' : 'Course Map'}
      </Button>
    </>
  )
}
