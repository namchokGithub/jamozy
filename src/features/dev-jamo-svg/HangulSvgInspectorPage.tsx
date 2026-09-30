import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import {
  DEFAULT_PIECE_ASSIGNMENTS,
  extractPretendardGlyph,
  TARGET_SYLLABLES,
  type PretendardGlyph,
  type TargetSyllable,
} from './pretendard-glyphs'

const COLORS = ['#e66c58', '#4c8f8b', '#7866b8', '#bd7c2b']
const PRETENDARD_FAMILY = 'Pretendard SVG PoC'

function GlyphSvg({
  glyph,
  paths,
  label,
  colored = false,
  sourceOutlineD,
}: {
  glyph: PretendardGlyph
  paths: Array<{ d: string; color?: string }>
  label: string
  colored?: boolean
  sourceOutlineD?: string
}) {
  return (
    <div className="flex h-52 items-center justify-center rounded-xl border border-[#d8e3f2] bg-[#fafcff] p-3">
      <svg
        aria-label={label}
        className="h-40 w-auto max-w-full"
        style={{ aspectRatio: `${glyph.advanceWidth} / ${glyph.unitsPerEm}` }}
        viewBox={`0 0 ${glyph.advanceWidth} ${glyph.unitsPerEm}`}
        role="img"
      >
        {paths.map(({ d, color }, index) => (
          <path
            key={`${index}-${d.slice(0, 24)}`}
            d={d}
            fill={colored ? color : '#39465b'}
            fillRule="evenodd"
          />
        ))}
        {sourceOutlineD && (
          <path
            d={sourceOutlineD}
            fill="none"
            stroke="#253247"
            strokeDasharray="18 12"
            strokeWidth="8"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  )
}

function ExtractedOutlineOverlay({ glyph }: { glyph: PretendardGlyph }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute h-40 w-auto max-w-full opacity-45"
      style={{ aspectRatio: `${glyph.advanceWidth} / ${glyph.unitsPerEm}` }}
      viewBox={`0 0 ${glyph.advanceWidth} ${glyph.unitsPerEm}`}
    >
      <path d={glyph.d} fill="#e66c58" fillRule="evenodd" />
    </svg>
  )
}

function combinedPath(paths: string[]) {
  return paths.join(' ')
}

export default function HangulSvgInspectorPage() {
  const [syllable, setSyllable] = useState<TargetSyllable>('가')
  const [glyph, setGlyph] = useState<PretendardGlyph | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [assignments, setAssignments] = useState<Record<string, number>>(
    DEFAULT_PIECE_ASSIGNMENTS.가,
  )
  const [showAlignmentOverlay, setShowAlignmentOverlay] = useState(false)
  const [showSplitSourceOverlay, setShowSplitSourceOverlay] = useState(false)
  const [showMonochromeReconstruction, setShowMonochromeReconstruction] =
    useState(false)

  const jamoSteps = TARGET_SYLLABLES[syllable]

  useEffect(() => {
    let active = true
    void extractPretendardGlyph(syllable)
      .then((nextGlyph) => active && setGlyph(nextGlyph))
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : 'Font extraction failed.',
          )
      })
    return () => {
      active = false
    }
  }, [syllable])

  const groupedPaths = useMemo(
    () =>
      jamoSteps.map((jamo, step) => ({
        jamo,
        paths:
          glyph?.contours
            ? glyph.pieces
                .filter((piece) => assignments[piece.id] === step)
                .map((piece) => piece.d)
            : [],
      })),
    [assignments, glyph, jamoSteps],
  )

  const conflicts =
    glyph?.contours.filter(
      (contour) =>
        contour.spansJamoSteps &&
        contour.spansJamoSteps.length > 1 &&
        !contour.splitPieceIds,
    ) ?? []

  const exportPreview = glyph
    ? {
        [syllable]: {
          width: glyph.advanceWidth,
          paths: groupedPaths.map(({ jamo, paths }) => ({
            jamo,
            d: combinedPath(paths),
          })),
          requiresPathSplitting: conflicts.length > 0,
        },
      }
    : null

  const selectSyllable = (next: TargetSyllable) => {
    setSyllable(next)
    setGlyph(null)
    setError(null)
    setAssignments(DEFAULT_PIECE_ASSIGNMENTS[next])
  }

  return (
    <PageSurface contentClassName="max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-[#a85d4e]">
            Development only
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#39465b]">
            Pretendard jamo SVG inspector
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-[#667085]">
            Extracts only the six PoC glyphs from the local Pretendard 600 TTF.
            Assign contours to physical typing steps; no guide or learner
            renderer is used.
          </p>
        </div>
        <Link
          className="text-sm font-semibold text-[#8d4c43] hover:underline"
          to="/"
        >
          Back to learner
        </Link>
      </header>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-semibold text-[#39465b]">
            Syllable
          </span>
          {(Object.keys(TARGET_SYLLABLES) as TargetSyllable[]).map(
            (candidate) => (
              <Button
                key={candidate}
                variant={candidate === syllable ? 'primary' : 'secondary'}
                onClick={() => selectSyllable(candidate)}
              >
                {candidate}{' '}
                <span className="ml-1 text-xs opacity-75">
                  {TARGET_SYLLABLES[candidate].join(' / ')}
                </span>
              </Button>
            ),
          )}
        </div>
      </Card>

      {error && <Card className="mt-6 text-[#9d3b32]">{error}</Card>}
      {!glyph && !error && (
        <Card className="mt-6 text-[#667085]">
          Loading local Pretendard 600 outline…
        </Card>
      )}

      {glyph && (
        <>
          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-[#39465b]">
                  Original Pretendard glyph
                </h2>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#667085]">
                  <input
                    type="checkbox"
                    checked={showAlignmentOverlay}
                    onChange={(event) => setShowAlignmentOverlay(event.target.checked)}
                  />
                  Overlay SVG
                </label>
              </div>
              <div
                aria-label={`Original Pretendard glyph ${syllable}`}
                className="relative mt-3 flex h-52 items-center justify-center rounded-xl border border-[#d8e3f2] bg-[#fafcff] text-[10rem] leading-none text-[#39465b]"
                style={{ fontFamily: PRETENDARD_FAMILY, fontWeight: 600 }}
              >
                {syllable}
                {showAlignmentOverlay && <ExtractedOutlineOverlay glyph={glyph} />}
              </div>
            </Card>
            <Card>
              <h2 className="font-bold text-[#39465b]">Extracted SVG glyph</h2>
              <div className="mt-3">
                <GlyphSvg
                  glyph={glyph}
                  paths={[{ d: glyph.d }]}
                  label={`Extracted SVG ${syllable}`}
                />
              </div>
            </Card>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-[#39465b]">
                  Per-jamo colored result
                </h2>
                {glyph.contours.some((contour) => contour.splitPieceIds) && (
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-[#667085]">
                    <input
                      type="checkbox"
                      checked={showSplitSourceOverlay}
                      onChange={(event) =>
                        setShowSplitSourceOverlay(event.target.checked)
                      }
                    />
                    Overlay source contour
                  </label>
                )}
              </div>
              <div className="mt-3">
                <GlyphSvg
                  glyph={glyph}
                  colored={!showMonochromeReconstruction}
                  label={`Colored physical jamo SVG ${syllable}`}
                  paths={groupedPaths.map(({ paths }, step) => ({
                    d: combinedPath(paths),
                    color: COLORS[step],
                  }))}
                  sourceOutlineD={
                    showSplitSourceOverlay
                      ? glyph.contours.find((contour) => contour.splitPieceIds)?.d
                      : undefined
                  }
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-[#667085]">
                {jamoSteps.map((jamo, step) => (
                  <span key={`${jamo}-${step}`} style={{ color: COLORS[step] }}>
                    {step + 1}. {jamo}
                  </span>
                ))}
                {glyph.contours.some((contour) => contour.splitPieceIds) && (
                  <label className="ml-auto flex items-center gap-1.5 text-[#667085]">
                    <input
                      type="checkbox"
                      checked={showMonochromeReconstruction}
                      onChange={(event) =>
                        setShowMonochromeReconstruction(event.target.checked)
                      }
                    />
                    One color
                  </label>
                )}
              </div>
            </Card>
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
            <Card className="min-w-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-bold text-[#39465b]">
                    Source contours and piece ownership
                  </h2>
                  <p className="mt-1 text-sm text-[#667085]">
                    {glyph.contours.length} extracted contour
                    {glyph.contours.length === 1 ? '' : 's'}; each resulting
                    piece is assigned to a physical typing step.
                  </p>
                </div>
                <span className="text-xs text-[#667085]">
                  em: {glyph.unitsPerEm}; baseline: {glyph.baselineY}; advance:{' '}
                  {glyph.advanceWidth}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {glyph.contours.map((contour) => {
                  const sourceJamo = contour.spansJamoSteps
                    ?.map((step) => jamoSteps[step])
                    .join(' + ')
                  const pieces = glyph.pieces.filter(
                    (piece) => piece.sourceContourId === contour.id,
                  )
                  const wasSplit = pieces.some(
                    (piece) => piece.wasSplitFromSourceContour,
                  )
                  return (
                    <article
                      key={contour.id}
                      className={`rounded-xl border p-3 ${wasSplit ? 'border-[#e4bd79] bg-[#fff9ed]' : 'border-[#d8e3f2] bg-white/70'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="font-semibold text-[#39465b]">
                          Source contour {contour.id + 1}
                        </h3>
                        {wasSplit && (
                          <span className="rounded-full bg-[#fff0d8] px-2 py-1 text-xs font-semibold text-[#9a6424]">
                            split into {pieces.length} pieces
                          </span>
                        )}
                      </div>
                      {wasSplit && (
                        <>
                          <div className="mt-3">
                            <GlyphSvg
                              glyph={glyph}
                              label={`Original source contour ${contour.id + 1}`}
                              paths={[{ d: contour.d }]}
                            />
                          </div>
                          <p className="mt-3 text-xs font-semibold text-[#9a6424]">
                            Original source contour: {sourceJamo} share one
                            unioned Pretendard outline. The two pieces below add
                            only their shared interior closing seam.
                          </p>
                        </>
                      )}
                      <div
                        className={`mt-3 grid gap-3 ${wasSplit ? 'sm:grid-cols-2' : ''}`}
                      >
                        {pieces.map((piece, pieceIndex) => (
                          <div
                            key={piece.id}
                            className="rounded-lg border border-[#d8e3f2] bg-white/80 p-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-[#39465b]">
                                {wasSplit
                                  ? `Piece ${pieceIndex + 1}`
                                  : 'Assigned piece'}
                              </span>
                              <select
                                aria-label={`Assign ${piece.id}`}
                                className="rounded border border-[#c8d7ea] bg-white px-2 py-1 text-sm text-[#39465b]"
                                value={assignments[piece.id]}
                                onChange={(event) => {
                                  const step = Number(event.target.value)
                                  setAssignments((current) => ({
                                    ...current,
                                    [piece.id]: step,
                                  }))
                                }}
                              >
                                {jamoSteps.map((jamo, step) => (
                                  <option key={`${jamo}-${step}`} value={step}>
                                    {step + 1}. {jamo}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="mt-2">
                              <GlyphSvg
                                glyph={glyph}
                                label={`${wasSplit ? 'Split piece' : 'Contour'} ${contour.id + 1}.${pieceIndex + 1}`}
                                colored
                                paths={[
                                  {
                                    d: piece.d,
                                    color: COLORS[assignments[piece.id]],
                                  },
                                ]}
                              />
                            </div>
                            <p className="mt-2 text-xs text-[#667085]">
                              Assigned to {jamoSteps[assignments[piece.id]]}.
                            </p>
                          </div>
                        ))}
                      </div>
                      {wasSplit ? (
                        <p className="mt-3 text-xs font-semibold text-[#9a6424]">
                          Split resolved: each piece now has an independent
                          physical-jamo owner.
                        </p>
                      ) : (
                        <p className="mt-3 text-xs text-[#667085]">
                          Source outline is assigned without splitting.
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>
            </Card>

            <Card className="min-w-0" tone={conflicts.length > 0 ? 'peach' : 'sage'}>
              <h2 className="font-bold text-[#39465b]">Export preview</h2>
              <p className="mt-1 text-sm text-[#667085]">
                One combined source-outline path per ordered physical-jamo step.
              </p>
              {conflicts.length > 0 && (
                <p className="mt-3 rounded-lg bg-[#fff0d8] p-3 text-sm text-[#8b6035]">
                  Export is intentionally marked incomplete: contour{' '}
                  {conflicts.map((contour) => contour.id + 1).join(', ')} needs
                  future path splitting.
                </p>
              )}
              {!conflicts.length &&
                glyph.contours.some((contour) => contour.splitPieceIds) && (
                  <p className="mt-3 rounded-lg bg-[#eaf5e8] p-3 text-sm text-[#4a7049]">
                    Contour 3 was split into independently assigned ㅂ and ㅅ
                    pieces. This preview is complete and no longer requires
                    path splitting.
                  </p>
                )}
              <pre className="mt-4 max-h-[38rem] w-full overflow-auto rounded-xl bg-[#253247] p-4 text-xs leading-5 text-[#edf3fb]">
                {JSON.stringify(exportPreview, null, 2)}
              </pre>
              <Button
                className="mt-4 w-full"
                variant="secondary"
                onClick={() =>
                  void navigator.clipboard.writeText(
                    JSON.stringify(exportPreview, null, 2),
                  )
                }
              >
                Copy preview JSON
              </Button>
            </Card>
          </section>
        </>
      )}
    </PageSurface>
  )
}
