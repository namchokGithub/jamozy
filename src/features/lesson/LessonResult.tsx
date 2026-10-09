import type { LessonCompletion } from './LessonTypingSession'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'

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

  return (
    <PageSurface contentClassName="max-w-2xl">
      <h1 className="text-2xl font-medium text-slate-900">Lesson complete!</h1>
      <p className="mt-2 text-slate-700">
        +{outcome.expGained} EXP — now level {outcome.level}
      </p>
      <Card aria-label="Lesson results" className="mt-4" role="region">
        <ul className="space-y-1 text-sm text-slate-700">
          <li>Accuracy {Math.round(result.accuracy)}%</li>
          <li>Typing speed {Math.round(result.speedWpm)} WPM</li>
          <li>Time {Math.round(result.durationSeconds)}s</li>
          <li>Mistakes {result.rejectedKeystrokes}</li>
        </ul>
        {result.mistakes.length === 0 ? (
          <p className="mt-3 text-sm text-emerald-700">
            No mistakes — nice work!
          </p>
        ) : (
          <>
            <h2 className="mt-3 text-sm font-medium text-slate-900">
              Words to review
            </h2>
            <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
              {mistypedWords.map((targetText) => (
                <li key={targetText}>{targetText}</li>
              ))}
            </ul>
          </>
        )}
      </Card>
      {outcome.unlockedNextLessonId && (
        <p className="mt-1 text-sm text-slate-600">Next lesson unlocked.</p>
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
    </PageSurface>
  )
}
