import { Link, useLoaderData } from 'react-router'
import { Award, BookOpen, Gauge } from 'lucide-react'
import type { ProfileLoaderData } from './ProfilePage.loader'
import { formatTypingTime } from './format-typing-time'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'

export default function ProfilePage() {
  const { summary } = useLoaderData() as ProfileLoaderData
  const metrics = [
    ['Lessons completed', summary.stats.lessonsCompleted, 'peach'],
    ['Words practiced', summary.stats.wordsPracticed, 'lilac'],
    [
      'Average accuracy',
      `${Math.round(summary.stats.averageAccuracy)}%`,
      'sage',
    ],
    ['Best accuracy', `${Math.round(summary.stats.bestAccuracy)}%`, 'peach'],
    [
      'Average speed',
      `${Math.round(summary.stats.averageSpeedWpm)} WPM`,
      'lilac',
    ],
    [
      'Total typing time',
      formatTypingTime(summary.stats.totalTypingTimeSeconds),
      'sage',
    ],
  ] as const
  return (
    <PageSurface contentClassName="max-w-3xl">
      <Card className="p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#a85d4e]">
              YOUR KOREAN CORNER
            </p>
            <h1 className="mt-1 text-3xl font-bold">Level {summary.level}</h1>
            <p className="mt-2 text-sm text-[#667085]">
              {summary.expIntoLevel} / {summary.expToNextLevel} EXP
            </p>
          </div>
          <span className="rounded-3xl bg-[#fff0d8] p-3 text-[#a85d4e]">
            <Award aria-hidden="true" size={26} />
          </span>
        </div>
        <progress
          value={summary.expIntoLevel}
          max={summary.expToNextLevel}
          className="mt-5 h-3 w-full overflow-hidden rounded-full accent-[#a85d4e]"
          aria-label="EXP progress"
        />
      </Card>
      <section className="mt-6" aria-label="Learning statistics">
        <h2 className="text-xl font-bold">Your gentle progress</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(([label, value, tone]) => (
            <Card key={label} tone={tone}>
              <dt className="text-sm font-semibold text-[#667085]">{label}</dt>
              <dd className="mt-2 text-2xl font-bold">{value}</dd>
            </Card>
          ))}
        </dl>
      </section>
      {summary.sessionAggregate.exercisesAttempted > 0 && (
        <Card tone="lilac" className="mt-6">
          <div className="flex gap-3">
            <span className="rounded-2xl bg-white/80 p-2 text-[#7863a8]">
              <Gauge aria-hidden="true" size={18} />
            </span>
            <div>
              <h2 className="font-bold">Since session tracking</h2>
              <p className="mt-1 text-sm text-[#667085]">
                +{summary.sessionAggregate.exp} EXP ·{' '}
                {Math.round(
                  (summary.sessionAggregate.acceptedKeystrokes /
                    (summary.sessionAggregate.acceptedKeystrokes +
                      summary.sessionAggregate.rejectedKeystrokes)) *
                    100 || 0,
                )}
                % accuracy ·{' '}
                {Math.round(
                  summary.sessionAggregate.acceptedKeystrokes /
                    5 /
                    (summary.sessionAggregate.totalTypingTimeSeconds / 60) || 0,
                )}{' '}
                WPM
              </p>
            </div>
          </div>
        </Card>
      )}
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[#667085] hover:bg-white/70 hover:text-[#8d4c43]"
      >
        <BookOpen aria-hidden="true" size={16} />
        Back to Course List
      </Link>
    </PageSurface>
  )
}
