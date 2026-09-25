import { useLoaderData } from 'react-router'
import type { ProfileLoaderData } from './ProfilePage.loader'
import { formatTypingTime } from './format-typing-time'

export default function ProfilePage() {
  const { summary } = useLoaderData() as ProfileLoaderData
  const expIntoLevel = summary.exp % 100

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-medium text-slate-900">
        Level {summary.level}
      </h1>
      <p className="mt-1 text-sm text-slate-600">{expIntoLevel} / 100 EXP</p>
      <progress
        value={expIntoLevel}
        max={100}
        className="mt-2 h-2 w-full"
        aria-label="EXP progress"
      />

      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm text-slate-500">Lessons completed</dt>
          <dd className="text-xl text-slate-900">
            {summary.stats.lessonsCompleted}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Words practiced</dt>
          <dd className="text-xl text-slate-900">
            {summary.stats.wordsPracticed}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Average accuracy</dt>
          <dd className="text-xl text-slate-900">
            {Math.round(summary.stats.averageAccuracy)}%
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Best accuracy</dt>
          <dd className="text-xl text-slate-900">
            {Math.round(summary.stats.bestAccuracy)}%
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Average speed</dt>
          <dd className="text-xl text-slate-900">
            {Math.round(summary.stats.averageSpeedWpm)} WPM
          </dd>
        </div>
        <div>
          <dt className="text-sm text-slate-500">Total typing time</dt>
          <dd className="text-xl text-slate-900">
            {formatTypingTime(summary.stats.totalTypingTimeSeconds)}
          </dd>
        </div>
      </dl>
    </main>
  )
}
