import { Link } from 'react-router'
import type { JamoOverview } from '../../application/get-weak-jamo-practice'
import { MIN_RANKED_JAMO_ATTEMPTS } from '../../domain/models/jamo-stat'
import { nearestToUnlock } from '../../domain/practice/jamo-grid'

const buttonClasses =
  'mt-3 inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold'

// Weak Jamo practice entry (DEC-051). Always shown: locked, with progress,
// until a jamo has enough attempts and mistakes to rank.
export default function WeakJamoCard({ overview }: { overview: JamoOverview }) {
  const { weakJamo } = overview
  if (weakJamo) {
    return (
      <section className="mt-6 rounded-3xl border border-[#eadfd4] bg-white/85 p-4 text-[#253247] shadow-sm">
        <h2 className="font-semibold">Practice weak jamo</h2>
        <p className="mt-1 text-sm text-[#667085]">
          {weakJamo.targets
            .map(
              (target) =>
                `${target.jamo} ${Math.round(target.mistakeRate * 100)}% mistakes`,
            )
            .join(' · ')}
        </p>
        <Link
          to="/review/weak-jamo"
          className={`${buttonClasses} border-[#a85d4e] bg-[#a85d4e] text-white hover:bg-[#8d4c43] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bc6c5d]`}
        >
          Practice {weakJamo.available} exercises
        </Link>
      </section>
    )
  }
  const nearest = nearestToUnlock(overview.stats)
  return (
    <section className="mt-6 rounded-3xl border border-[#eadfd4] bg-white/85 p-4 text-[#253247] shadow-sm">
      <h2 className="font-semibold">Practice weak jamo</h2>
      <p className="mt-1 text-sm text-[#667085]">
        {nearest
          ? `Keep typing to unlock: ${nearest.jamo} ${nearest.attempts}/${MIN_RANKED_JAMO_ATTEMPTS} tries.`
          : `Keep typing to unlock: a jamo needs ${MIN_RANKED_JAMO_ATTEMPTS} tries and a mistake.`}
      </p>
      <span
        aria-disabled="true"
        className={`${buttonClasses} cursor-not-allowed border-[#eadfd4] bg-[#f6f2ee] text-[#98a2b3]`}
      >
        Locked
      </span>
    </section>
  )
}
