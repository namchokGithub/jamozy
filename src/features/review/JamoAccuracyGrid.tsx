import { Link } from 'react-router'
import type { JamoStats } from '../../domain/models/jamo-stat'
import {
  jamoGrid,
  type JamoCell,
  type JamoTone,
} from '../../domain/practice/jamo-grid'

const toneClasses: Record<JamoTone, string> = {
  none: 'border-line bg-sand text-faint',
  pending: 'border-line bg-sand text-muted',
  weak: 'border-coral-200 bg-coral-50 text-danger',
  fair: 'border-peach-100 bg-peach-50 text-peach-700',
  strong: 'border-mint-200 bg-mint-50 text-mint-600',
}

const legend: Array<{ tone: JamoTone; label: string }> = [
  { tone: 'weak', label: '< 70%' },
  { tone: 'fair', label: '70–90%' },
  { tone: 'strong', label: '90%+' },
  { tone: 'pending', label: 'Under 20 tries' },
]

function cellLabel(cell: JamoCell) {
  return cell.accuracy === null
    ? `${cell.jamo}, not practiced yet`
    : `${cell.jamo}, ${cell.accuracy}% accuracy over ${cell.attempts} tries`
}

function Cell({ cell, drillable }: { cell: JamoCell; drillable: boolean }) {
  const className = `flex h-14 w-12 flex-col items-center justify-center rounded-xl border ${toneClasses[cell.tone]}`
  const content = (
    <>
      <span className="text-lg font-semibold">{cell.jamo}</span>
      <span className="text-[11px]">
        {cell.accuracy === null ? '–' : `${cell.accuracy}%`}
      </span>
    </>
  )
  return drillable ? (
    <Link
      to={`/review/weak-jamo?jamo=${encodeURIComponent(cell.jamo)}`}
      aria-label={`Practice ${cellLabel(cell)}`}
      className={`${className} hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-500`}
    >
      {content}
    </Link>
  ) : (
    <div aria-label={cellLabel(cell)} className={className}>
      {content}
    </div>
  )
}

// Per-jamo accuracy (DEC-051). Ranked red and yellow keys with Home
// exercises open a practice round for that jamo.
export default function JamoAccuracyGrid({
  stats,
  practicable,
}: {
  stats: JamoStats
  practicable: string[]
}) {
  const drillable = new Set(practicable)
  return (
    <section className="mt-6 rounded-3xl border border-line bg-white/85 p-4 text-ink shadow-sm">
      <h2 className="font-semibold">Per-jamo accuracy</h2>
      <p className="mt-1 text-sm text-muted">
        Where you struggle. Tap a red or yellow key to practice it.
      </p>
      {jamoGrid(stats).map((group) => (
        <div key={group.label} className="mt-4">
          <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {group.label}
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {group.cells.map((cell) => (
              <Cell
                key={cell.jamo}
                cell={cell}
                drillable={
                  (cell.tone === 'weak' || cell.tone === 'fair') &&
                  drillable.has(cell.jamo)
                }
              />
            ))}
          </div>
        </div>
      ))}
      <ul className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
        {legend.map(({ tone, label }) => (
          <li key={tone} className="flex items-center gap-1">
            <span
              aria-hidden
              className={`inline-block h-3 w-3 rounded border ${toneClasses[tone]}`}
            />
            {label}
          </li>
        ))}
      </ul>
    </section>
  )
}
