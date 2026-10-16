import { useState, type ReactNode } from 'react'
import { useLoaderData, useFetcher } from 'react-router'
import { Award, BookOpen, Clock, Gauge, Keyboard, Target } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import type { ProfileLoaderData } from './ProfilePage.loader'
import { formatTypingTime } from './format-typing-time'
import { PageNav } from '../../components/ui/PageNav'
import { PageSurface } from '../../components/ui/PageSurface'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import type { RebirthActionData } from './ProfilePage.action'
import { closesRebirthModal } from './rebirth-action-state'

// Pastel accents follow Home: color stays on the icon, cards stay warm white.
const accents = {
  coral: 'bg-coral-100 text-coral-600',
  lavender: 'bg-lavender-100 text-lavender-600',
  mint: 'bg-mint-100 text-mint-700',
}

const cardClass = 'rounded-3xl border border-line bg-card shadow-card'

// eslint-disable-next-line react-refresh/only-export-components
export const ranks = [
  {
    minimumLevel: 100,
    name: 'Genesis',
    image: '/ranking/WebP/128w/9-Genesis@128.webp',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    ringClass:
      'border-rose-400 bg-rose-50 shadow-[0_0_28px_-8px_rgba(200,79,130,0.65)]',
  },
  {
    minimumLevel: 90,
    name: 'Divine',
    image: '/ranking/WebP/128w/8-Divine@128.webp',
    badgeClass: 'border-peach-300 bg-peach-50 text-peach-700',
    ringClass:
      'border-peach-300 bg-peach-50 shadow-[0_0_28px_-8px_rgba(227,173,115,0.7)]',
  },
  {
    minimumLevel: 80,
    name: 'Mythic',
    image: '/ranking/WebP/128w/7-Mythic@128.webp',
    badgeClass: 'border-coral-200 bg-coral-50 text-coral-700',
    ringClass:
      'border-coral-300 bg-coral-50 shadow-[0_0_28px_-8px_rgba(188,108,93,0.65)]',
  },
  {
    minimumLevel: 65,
    name: 'Legendary',
    image: '/ranking/WebP/128w/6-Legendary@128.webp',
    badgeClass: 'border-peach-300 bg-peach-50 text-peach-700',
    ringClass:
      'border-peach-300 bg-peach-50 shadow-[0_0_28px_-8px_rgba(227,173,115,0.7)]',
  },
  {
    minimumLevel: 50,
    name: 'Unique',
    image: '/ranking/WebP/128w/5-Unique@128.webp',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-700',
    ringClass:
      'border-rose-400 bg-rose-50 shadow-[0_0_28px_-8px_rgba(200,79,130,0.65)]',
  },
  {
    minimumLevel: 35,
    name: 'Epic',
    image: '/ranking/WebP/128w/4-Epic@128.webp',
    badgeClass: 'border-lavender-300 bg-lavender-100 text-lavender-700',
    ringClass:
      'border-lavender-400 bg-lavender-100 shadow-[0_0_28px_-8px_rgba(157,139,200,0.65)]',
  },
  {
    minimumLevel: 20,
    name: 'Rare',
    image: '/ranking/WebP/128w/3-Rare@128.webp',
    badgeClass: 'border-sky-300 bg-sky-100 text-sky-700',
    ringClass:
      'border-sky-300 bg-sky-100 shadow-[0_0_28px_-8px_rgba(63,111,174,0.45)]',
  },
  {
    minimumLevel: 10,
    name: 'Uncommon',
    image: '/ranking/WebP/128w/2-Uncommon@128.webp',
    badgeClass: 'border-mint-200 bg-mint-50 text-mint-700',
    ringClass:
      'border-mint-400 bg-mint-50 shadow-[0_0_28px_-8px_rgba(95,174,148,0.6)]',
  },
  {
    minimumLevel: 1,
    name: 'Normal',
    image: '/ranking/WebP/128w/1-Normal@128.webp',
    badgeClass: 'border-line bg-sand text-ink-muted',
    ringClass: 'border-line-strong bg-sand shadow-card',
  },
] as const

type RankName = (typeof ranks)[number]['name']

interface RankAnimation {
  floatDistance: number
  floatDuration: number
  glow: { color: string; minimumBlur: number; maximumBlur: number } | null
  sparkleCount: number
  sparkleClass: string
}

const rankAnimations: Record<RankName, RankAnimation> = {
  Normal: {
    floatDistance: 0,
    floatDuration: 0,
    glow: null,
    sparkleCount: 0,
    sparkleClass: '',
  },
  Uncommon: {
    floatDistance: 2,
    floatDuration: 3.4,
    glow: null,
    sparkleCount: 0,
    sparkleClass: '',
  },
  Rare: {
    floatDistance: 3,
    floatDuration: 3,
    glow: { color: 'rgba(63, 111, 174, 0.4)', minimumBlur: 5, maximumBlur: 10 },
    sparkleCount: 0,
    sparkleClass: '',
  },
  Epic: {
    floatDistance: 3,
    floatDuration: 3,
    glow: {
      color: 'rgba(157, 139, 200, 0.45)',
      minimumBlur: 6,
      maximumBlur: 12,
    },
    sparkleCount: 0,
    sparkleClass: '',
  },
  Unique: {
    floatDistance: 3,
    floatDuration: 3,
    glow: {
      color: 'rgba(200, 79, 130, 0.45)',
      minimumBlur: 6,
      maximumBlur: 13,
    },
    sparkleCount: 1,
    sparkleClass: 'text-rose-500',
  },
  Legendary: {
    floatDistance: 3,
    floatDuration: 3,
    glow: {
      color: 'rgba(227, 173, 115, 0.5)',
      minimumBlur: 7,
      maximumBlur: 14,
    },
    sparkleCount: 2,
    sparkleClass: 'text-peach-300',
  },
  Mythic: {
    floatDistance: 3,
    floatDuration: 2.8,
    glow: {
      color: 'rgba(188, 108, 93, 0.62)',
      minimumBlur: 8,
      maximumBlur: 18,
    },
    sparkleCount: 2,
    sparkleClass: 'text-coral-400',
  },
  Divine: {
    floatDistance: 3,
    floatDuration: 3.2,
    glow: {
      color: 'rgba(227, 173, 115, 0.58)',
      minimumBlur: 8,
      maximumBlur: 17,
    },
    sparkleCount: 3,
    sparkleClass: 'text-peach-300',
  },
  Genesis: {
    floatDistance: 2,
    floatDuration: 4,
    glow: {
      color: 'rgba(200, 79, 130, 0.64)',
      minimumBlur: 10,
      maximumBlur: 21,
    },
    sparkleCount: 3,
    sparkleClass: 'text-rose-500',
  },
}

const sparklePositions = [
  'left-0 top-1',
  'right-0 top-4',
  'bottom-0 right-4',
] as const

export default function ProfilePage() {
  const { summary } = useLoaderData() as ProfileLoaderData
  const fetcher = useFetcher<RebirthActionData>()
  const [confirming, setConfirming] = useState(false)
  const [operationId] = useState(() => crypto.randomUUID())
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
  const rank = rankForLevel(summary.level)
  const expRemaining = Math.max(
    summary.expToNextLevel - summary.expIntoLevel,
    0,
  )
  const canRebirth = summary.level >= 100
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
      <section className={`${cardClass} relative overflow-hidden p-7`}>
        <div
          className={`absolute right-5 top-5 flex h-20 w-20 items-center justify-center rounded-full border-4 sm:right-7 sm:top-7 sm:h-24 sm:w-24 ${rank.ringClass}`}
        >
          <RankMascot rank={rank} />
        </div>
        <p className="text-sm font-semibold text-coral-600">
          YOUR KOREAN CORNER
        </p>
        <h1 className="mt-1 pr-24 text-3xl font-bold tracking-tight text-ink sm:pr-32">
          Level {summary.level}
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-medium text-muted">Rank:</span>
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${rank.badgeClass}`}
          >
            {rank.name}
          </span>
        </div>
        <div className="mt-6 flex items-end justify-between gap-4">
          <p className="text-sm font-bold text-ink">
            {formatExp(summary.expIntoLevel)} /{' '}
            {formatExp(summary.expToNextLevel)} EXP
          </p>
          <p className="text-xs font-medium text-muted">
            {formatExp(expRemaining)} EXP to next level
          </p>
        </div>
        <progress
          value={summary.expIntoLevel}
          max={summary.expToNextLevel}
          className="mt-2 block h-3 w-full appearance-none overflow-hidden rounded-full bg-mint-50 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-mint-500 [&::-webkit-progress-bar]:bg-mint-50 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-mint-500"
          aria-label="EXP progress"
        />
        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-line-soft bg-sand/70 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
              Rebirths
            </dt>
            <dd className="mt-1 text-xl font-bold text-ink">
              {summary.rebirthCount ?? 0}
            </dd>
          </div>
          <div className="rounded-2xl border border-line-soft bg-sand/70 px-4 py-3">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
              Perk Points
            </dt>
            <dd className="mt-1 text-xl font-bold text-ink">
              {summary.perkPointsEarned ?? 0}
            </dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            variant={canRebirth ? 'primary' : 'secondary'}
            disabled={!canRebirth}
            onClick={() => setConfirming(true)}
          >
            Rebirth
          </Button>
          {!canRebirth && (
            <p className="text-xs font-medium text-muted">
              Unlocks at Level 100
            </p>
          )}
        </div>
      </section>
      <Modal
        open={confirming && !closesRebirthModal(fetcher.data)}
        title="Begin a new Rebirth?"
        onClose={() => setConfirming(false)}
      >
        <p className="mt-3 text-sm leading-6 text-muted">
          Your current cycle EXP resets to 0. Your learning progress and
          statistics stay. You earn 1 Perk Point. Pending Home results can add
          EXP to the new cycle.
        </p>
        {fetcher.data && 'error' in fetcher.data && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-coral-100 px-3 py-2 text-sm font-medium text-coral-600"
          >
            {fetcher.data.error}. Please try again.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            disabled={fetcher.state !== 'idle'}
            onClick={() =>
              fetcher.submit(
                { operationId },
                { method: 'post', encType: 'application/json' },
              )
            }
          >
            Confirm Rebirth
          </Button>
        </div>
      </Modal>

      <section className="mt-10" aria-label="Learning statistics">
        <SectionHeader eyebrow="LOOK HOW FAR YOU'VE COME">
          Your gentle progress
        </SectionHeader>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map(({ label, value, icon, accent }) => (
            <div key={label} className={`${cardClass} p-5`}>
              <dt className="flex items-center gap-2 text-sm font-semibold text-muted">
                <span className={`rounded-full p-1.5 ${accents[accent]}`}>
                  {icon}
                </span>
                {label}
              </dt>
              <dd className="mt-3 text-2xl font-bold text-ink">{value}</dd>
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
                <dt className="text-sm font-semibold text-muted">{label}</dt>
                <dd className="mt-1 text-xl font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </PageSurface>
  )
}

function formatExp(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

// eslint-disable-next-line react-refresh/only-export-components
export function rankForLevel(level: number) {
  return ranks.find((rank) => level >= rank.minimumLevel) ?? ranks.at(-1)!
}

export function RankMascot({ rank }: { rank: (typeof ranks)[number] }) {
  const reducedMotion = useReducedMotion()
  const animation = rankAnimations[rank.name]
  const glow = animation.glow
  const animatedProperties = reducedMotion
    ? undefined
    : {
        ...(animation.floatDistance > 0
          ? { y: [0, -animation.floatDistance, 0] }
          : {}),
        ...(glow
          ? {
              filter: [
                `drop-shadow(0 0 ${glow.minimumBlur}px ${glow.color})`,
                `drop-shadow(0 0 ${glow.maximumBlur}px ${glow.color})`,
                `drop-shadow(0 0 ${glow.minimumBlur}px ${glow.color})`,
              ],
            }
          : {}),
      }

  return (
    <>
      <motion.img
        src={rank.image}
        alt={`${rank.name} rank mascot`}
        width="88"
        height="88"
        className="h-[72px] w-[72px] object-contain sm:h-[88px] sm:w-[88px]"
        animate={animatedProperties}
        transition={{
          y: {
            duration: animation.floatDuration,
            repeat: Infinity,
            ease: 'easeInOut',
          },
          filter: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
        }}
      />
      {!reducedMotion &&
        Array.from({ length: animation.sparkleCount }, (_, index) => (
          <motion.span
            key={sparklePositions[index]}
            aria-hidden="true"
            className={`pointer-events-none absolute text-sm ${sparklePositions[index]} ${animation.sparkleClass}`}
            initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
            animate={{
              opacity: [0, 0, 1, 0],
              scale: [0.5, 0.5, 1.1, 0.5],
              rotate: [-20, -20, 20, 40],
            }}
            transition={{
              duration: 3.6,
              delay: index * 0.85,
              repeat: Infinity,
              ease: 'easeInOut',
              times: [0, 0.6, 0.78, 1],
            }}
          >
            ✦
          </motion.span>
        ))}
    </>
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
      <p className="text-sm font-semibold text-coral-600">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink">
        {children}
      </h2>
    </div>
  )
}
