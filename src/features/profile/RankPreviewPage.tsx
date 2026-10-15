import { PageNav } from '../../components/ui/PageNav'
import { PageSurface } from '../../components/ui/PageSurface'
import { RankMascot, ranks } from './ProfilePage'

export default function RankPreviewPage() {
  return (
    <PageSurface contentClassName="max-w-5xl">
      <PageNav backTo="/profile" backLabel="Profile" />
      <header>
        <p className="text-sm font-semibold text-coral-600">RANK PREVIEW</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">
          Every Rank mascot
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          A visual check for each rank identity and its animation.
        </p>
      </header>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ranks.map((rank, index) => (
          <article
            key={rank.name}
            className="rounded-3xl border border-line bg-card p-5 shadow-card"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold tracking-wide ${rank.badgeClass}`}
                >
                  {rank.name}
                </span>
                <p className="mt-3 text-sm font-semibold text-muted">
                  {levelRange(rank, index)}
                </p>
              </div>
              <div
                className={`relative flex h-24 w-24 items-center justify-center rounded-full border-4 ${rank.ringClass}`}
              >
                <RankMascot rank={rank} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </PageSurface>
  )
}

function levelRange(rank: (typeof ranks)[number], index: number) {
  const higherRank = ranks[index - 1]
  return higherRank
    ? `Level ${rank.minimumLevel}–${higherRank.minimumLevel - 1}`
    : `Level ${rank.minimumLevel}+`
}
