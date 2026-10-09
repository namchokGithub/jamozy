import type { ReactNode } from 'react'
import { useLoaderData } from 'react-router'
import { Award, BookOpen, Clock, Gauge, Keyboard, Target } from 'lucide-react'
import type { ProfileLoaderData } from './ProfilePage.loader'
import { formatTypingTime } from './format-typing-time'
import { PageNav } from '../../components/ui/PageNav'
import { PageSurface } from '../../components/ui/PageSurface'

// Pastel accents follow Home: color stays on the icon, cards stay warm white.
const accents = {
  coral: 'bg-[#fde5e1] text-[#a85d4e]',
  lavender: 'bg-[#f2edf9] text-[#7863a8]',
  mint: 'bg-[#ddf5e9] text-[#2f7a62]',
}

const cardClass =
  'rounded-3xl border border-[#eadfd4] bg-[#fffdf9] shadow-[0_14px_35px_-28px_rgba(54,41,31,0.7)]'

export default function ProfilePage() {
  const { summary } = useLoaderData() as ProfileLoaderData
  const metrics: {
    label: string
    value: ReactNode
    icon: ReactNode
    accent: keyof typeof accents
  }[] = [
    {
      label: 'Lessons completed',
      value: summary.stats.lessonsCompleted,
      icon: <BookOpen aria-hidden="true" size={16} />,
      accent: 'coral',
    },
    {
      label: 'Words practiced',
      value: summary.stats.wordsPracticed,
      icon: <Keyboard aria-hidden="true" size={16} />,
      accent: 'lavender',
    },
    {
      label: 'Average accuracy',
      value: `${Math.round(summary.stats.averageAccuracy)}%`,
      icon: <Target aria-hidden="true" size={16} />,
      accent: 'mint',
    },
    {
      label: 'Best accuracy',
      value: `${Math.round(summary.stats.bestAccuracy)}%`,
      icon: <Award aria-hidden="true" size={16} />,
      accent: 'coral',
    },
    {
      label: 'Average speed',
      value: `${Math.round(summary.stats.averageSpeedWpm)} WPM`,
      icon: <Gauge aria-hidden="true" size={16} />,
      accent: 'lavender',
    },
    {
      label: 'Total typing time',
      value: formatTypingTime(summary.stats.totalTypingTimeSeconds),
      icon: <Clock aria-hidden="true" size={16} />,
      accent: 'mint',
    },
  ]
  const aggregate = summary.sessionAggregate
  const aggregateStats = [
    { label: 'EXP earned', value: `+${aggregate.exp}` },
    {
      label: 'Accuracy',
      value: `${Math.round(
        (aggregate.acceptedKeystrokes /
          (aggregate.acceptedKeystrokes + aggregate.rejectedKeystrokes)) *
          100 || 0,
      )}%`,
    },
    {
      label: 'Speed',
      value: `${Math.round(
        aggregate.acceptedKeystrokes /
          5 /
          (aggregate.totalTypingTimeSeconds / 60) || 0,
      )} WPM`,
    },
  ]

  return (
    <PageSurface contentClassName="max-w-5xl">
      <PageNav backTo="/" backLabel="Home" />
      <section className={`${cardClass} p-7`}>
        <p className="text-sm font-semibold text-[#a85d4e]">
          YOUR KOREAN CORNER
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[#253247]">
          Level {summary.level}
        </h1>
        <div className="mt-5 flex justify-end">
          <p className="text-sm font-semibold text-[#667085]">
            {summary.expIntoLevel} / {summary.expToNextLevel} EXP
          </p>
        </div>
        <progress
          value={summary.expIntoLevel}
          max={summary.expToNextLevel}
          className="mt-2 block h-3 w-full appearance-none overflow-hidden rounded-full bg-[#eef3ee] [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-[#5fae94] [&::-webkit-progress-bar]:bg-[#eef3ee] [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[#5fae94]"
          aria-label="EXP progress"
        />
      </section>

      <section className="mt-10" aria-label="Learning statistics">
        <SectionHeader eyebrow="LOOK HOW FAR YOU'VE COME">
          Your gentle progress
        </SectionHeader>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(({ label, value, icon, accent }) => (
            <div key={label} className={`${cardClass} p-5`}>
              <dt className="flex items-center gap-2 text-sm font-semibold text-[#667085]">
                <span className={`rounded-full p-1.5 ${accents[accent]}`}>
                  {icon}
                </span>
                {label}
              </dt>
              <dd className="mt-3 text-2xl font-bold text-[#253247]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {aggregate.exercisesAttempted > 0 && (
        <section className="mt-10" aria-label="Since tracking began">
          <SectionHeader eyebrow="SESSION HISTORY">
            Since tracking began
          </SectionHeader>
          <dl className={`${cardClass} mt-4 grid grid-cols-3 gap-4 p-5`}>
            {aggregateStats.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-sm font-semibold text-[#667085]">
                  {label}
                </dt>
                <dd className="mt-1 text-xl font-bold text-[#253247]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </PageSurface>
  )
}

function SectionHeader({
  eyebrow,
  children,
}: {
  eyebrow: string
  children: ReactNode
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-[#a85d4e]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-[#253247]">
        {children}
      </h2>
    </div>
  )
}
