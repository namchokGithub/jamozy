import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import { retainSourceAfterSave } from './tagger-state'
import {
  removeSourceRange,
  replacePrimarySourceRange,
} from '../../../tools/jamo-svg/split-workbench'
import type { CachedContour, RecipeToken } from '../../../tools/jamo-svg/types'

type Geometry =
  | { kind: 'contour'; contourId: number }
  | { kind: 'split-piece'; recipeId: string; pieceId: string }
type Review = {
  syllable: string
  status: string
  blockers: string[]
  notes?: string
  steps: Array<{ order: number; jamo: string; geometry: Geometry[] }>
  splitRecipes: Array<{
    id: string
    sourceContourId: number
    sourceContourHash: string
    splitRecipeSchemaVersion: number
    rationale: string
    visualValidation: { sourceContourHash: string }
    method: 'source-command-partition'
    pieces: Array<{ id: string; tokens: RecipeToken[] }>
  }>
  approved?: unknown
  [key: string]: unknown
}
type Glyph = {
  syllable: string
  advanceWidth: number
  sourcePath: string
  contours: CachedContour[]
  physicalSteps: Array<{ order: number; jamo: string }>
  extraction: unknown
}
type State = {
  source: Glyph
  review: Review
  compiled: { paths: Array<{ jamo: string; d: string }> }
  validation: { blockers: string[] }
  revision?: string
}
type SaveResponse = Omit<State, 'source'> & { revision: string }
type PreviewResponse = Pick<State, 'compiled' | 'validation'>
type QueueEntry = {
  syllable: string
  priority: number
  reasons: string[]
  reviewStatus?: string
  blockers?: string[]
}
const colors = ['#e66c58', '#4c8f8b', '#7866b8', '#bd7c2b', '#5b8c5a']
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/__jamo-svg${path}`, init)
  const body = (await response.json()) as T & { error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Tagger request failed.')
  return body
}
function GlyphPreview({
  glyph,
  paths,
  colored,
  overlay,
}: {
  glyph: Glyph
  paths: Array<{ d: string; jamo?: string }>
  colored?: boolean
  overlay?: boolean
}) {
  return (
    <svg
      className="h-48 w-full"
      viewBox={`0 0 ${glyph.advanceWidth} 2048`}
      role="img"
      aria-label={`${glyph.syllable} SVG preview`}
    >
      {paths.map((path, index) => (
        <path
          key={`${index}-${path.d.slice(0, 16)}`}
          d={path.d}
          fill={colored ? colors[index] : '#39465b'}
          fillRule="evenodd"
        />
      ))}
      {overlay && (
        <path
          d={glyph.sourcePath}
          fill="none"
          stroke="#e66c58"
          strokeWidth="8"
          strokeDasharray="18 12"
        />
      )}
    </svg>
  )
}
function commandSegmentPath(
  commands: CachedContour['commands'],
  commandIndex: number,
) {
  let cursor: { x: number; y: number } | undefined
  let subpathStart: { x: number; y: number } | undefined
  for (let index = 0; index <= commandIndex; index += 1) {
    const command = commands[index]
    if (!command) return undefined
    if (command.type === 'M') {
      cursor = { x: command.x!, y: command.y! }
      subpathStart = cursor
      if (index === commandIndex)
        return { d: `M${cursor.x} ${cursor.y}`, point: cursor }
      continue
    }
    if (!cursor) return undefined
    if (command.type === 'L') {
      const next = { x: command.x!, y: command.y! }
      if (index === commandIndex)
        return { d: `M${cursor.x} ${cursor.y} L${next.x} ${next.y}` }
      cursor = next
      continue
    }
    if (command.type === 'Q') {
      const next = { x: command.x!, y: command.y! }
      if (index === commandIndex)
        return {
          d: `M${cursor.x} ${cursor.y} Q${command.x1} ${command.y1} ${next.x} ${next.y}`,
        }
      cursor = next
      continue
    }
    if (command.type === 'C') {
      const next = { x: command.x!, y: command.y! }
      if (index === commandIndex)
        return {
          d: `M${cursor.x} ${cursor.y} C${command.x1} ${command.y1} ${command.x2} ${command.y2} ${next.x} ${next.y}`,
        }
      cursor = next
      continue
    }
    if (index === commandIndex && subpathStart)
      return {
        d: `M${cursor.x} ${cursor.y} L${subpathStart.x} ${subpathStart.y}`,
      }
    cursor = subpathStart
  }
  return undefined
}
function SourceRangeInput({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [syncedValue, setSyncedValue] = useState(value)
  if (value !== syncedValue) {
    setSyncedValue(value)
    setDraft(String(value))
  }
  return (
    <input
      className="mt-1 w-full rounded border p-2 font-normal"
      type="text"
      value={draft}
      onChange={(event) => {
        const next = event.target.value
        setDraft(next)
        const number = Number(next)
        if (next !== '' && Number.isInteger(number)) onChange(number)
      }}
    />
  )
}
function CommandRangePainter({
  glyph,
  contour,
  ranges,
  targetJamo,
  onRangeChange,
}: {
  glyph: Glyph
  contour: CachedContour
  ranges: Array<{ fromCommand: number; toCommand: number }>
  targetJamo?: string
  onRangeChange: (fromCommand: number, toCommand: number) => void
}) {
  const [dragStart, setDragStart] = useState<number>()
  const [dragEnd, setDragEnd] = useState<number>()
  const dragRange = useRef<{ start: number; end: number } | undefined>(
    undefined,
  )
  const selected = (index: number) => {
    if (dragStart !== undefined && dragEnd !== undefined)
      return (
        index >= Math.min(dragStart, dragEnd) &&
        index <= Math.max(dragStart, dragEnd)
      )
    return ranges.some(
      (range) => index >= range.fromCommand && index <= range.toCommand,
    )
  }
  const finish = () => {
    if (dragRange.current)
      onRangeChange(
        Math.min(dragRange.current.start, dragRange.current.end),
        Math.max(dragRange.current.start, dragRange.current.end),
      )
    dragRange.current = undefined
    setDragStart(undefined)
    setDragEnd(undefined)
  }
  return (
    <div className="mt-3 rounded border border-[#d8e3f2] bg-[#f9fbff] p-3">
      <p className="text-xs font-semibold text-[#39465b]">
        Paint source commands
      </p>
      <p className="mt-1 text-xs text-[#667085]">
        {targetJamo
          ? `Drag across the outline to paint geometry for ${targetJamo}. The colored selection still saves only source-command indexes.`
          : 'Choose the target jamo first, then drag across its outline.'}
      </p>
      <svg
        className="mt-2 h-36 w-full touch-none"
        viewBox={`0 0 ${glyph.advanceWidth} 2048`}
        role="img"
        aria-label="Paint a source-command range"
        onPointerUp={finish}
        onPointerMove={(event) => {
          const attribute = (event.target as Element).getAttribute(
            'data-command-index',
          )
          if (attribute === null) return
          const commandIndex = Number(attribute)
          if (
            event.buttons === 1 &&
            dragRange.current &&
            Number.isInteger(commandIndex)
          ) {
            dragRange.current.end = commandIndex
            setDragEnd(commandIndex)
          }
        }}
        onPointerLeave={(event) => {
          if (event.buttons === 0) finish()
        }}
      >
        <path d={contour.d} fill="none" stroke="#c4cfdf" strokeWidth="18" />
        {contour.commands.map((_, index) => {
          const segment = commandSegmentPath(contour.commands, index)
          if (!segment) return null
          const color = selected(index) ? '#e66c58' : '#4c8f8b'
          return segment.point ? (
            <circle
              key={index}
              cx={segment.point.x}
              cy={segment.point.y}
              r="22"
              fill={color}
              className={targetJamo ? 'cursor-crosshair' : 'cursor-not-allowed'}
              onPointerDown={() => {
                if (!targetJamo) return
                dragRange.current = { start: index, end: index }
                setDragStart(index)
                setDragEnd(index)
              }}
              data-command-index={index}
            />
          ) : (
            <path
              key={index}
              d={segment.d}
              fill="none"
              stroke={color}
              strokeWidth="28"
              strokeLinecap="round"
              className={targetJamo ? 'cursor-crosshair' : 'cursor-not-allowed'}
              onPointerDown={() => {
                if (!targetJamo) return
                dragRange.current = { start: index, end: index }
                setDragStart(index)
                setDragEnd(index)
              }}
              data-command-index={index}
            />
          )
        })}
      </svg>
      <p className="text-xs text-[#667085]">
        {dragStart !== undefined && dragEnd !== undefined
          ? `Painting commands ${Math.min(dragStart, dragEnd)}–${Math.max(dragStart, dragEnd)}.`
          : ranges.length > 0
            ? `Source ranges: ${ranges.map((range) => `${range.fromCommand}–${range.toCommand}`).join(', ')}.`
            : 'Click a segment, or drag from the first segment to the last.'}
      </p>
    </div>
  )
}
function DraftSegmentationPreview({
  glyph,
  review,
}: {
  glyph: Glyph
  review: Review
}) {
  return (
    <svg
      className="h-48 w-full"
      viewBox={`0 0 ${glyph.advanceWidth} 2048`}
      role="img"
      aria-label={`${glyph.syllable} draft jamo segmentation`}
    >
      <path
        d={glyph.sourcePath}
        fill="none"
        stroke="#d5dce8"
        strokeWidth="14"
      />
      {review.steps.flatMap((step) =>
        step.geometry.flatMap((geometry) => {
          const color = colors[step.order % colors.length]
          if (geometry.kind === 'contour') {
            const contour = glyph.contours.find(
              (item) => item.id === geometry.contourId,
            )
            return contour
              ? [
                  <path
                    key={`contour-${step.order}-${contour.id}`}
                    d={contour.d}
                    fill={color}
                    fillRule="evenodd"
                  />,
                ]
              : []
          }
          const recipe = review.splitRecipes.find(
            (item) => item.id === geometry.recipeId,
          )
          const contour = glyph.contours.find(
            (item) => item.id === recipe?.sourceContourId,
          )
          const piece = recipe?.pieces.find(
            (item) => item.id === geometry.pieceId,
          )
          if (!contour || !piece) return []
          return contour.commands.flatMap((_, commandIndex) => {
            const selected = piece.tokens.some(
              (token) =>
                token.kind === 'source-range' &&
                commandIndex >= token.fromCommand &&
                commandIndex <= token.toCommand,
            )
            if (!selected) return []
            const segment = commandSegmentPath(contour.commands, commandIndex)
            if (!segment) return []
            return segment.point
              ? [
                  <circle
                    key={`piece-${step.order}-${piece.id}-${commandIndex}`}
                    cx={segment.point.x}
                    cy={segment.point.y}
                    r="20"
                    fill={color}
                  />,
                ]
              : [
                  <path
                    key={`piece-${step.order}-${piece.id}-${commandIndex}`}
                    d={segment.d}
                    fill="none"
                    stroke={color}
                    strokeWidth="24"
                    strokeLinecap="round"
                  />,
                ]
          })
        }),
      )}
    </svg>
  )
}
export default function JamoSvgTaggerPage() {
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'needs-split'>('all')
  const [index, setIndex] = useState(0)
  const [state, setState] = useState<State | null>(null)
  const [revision, setRevision] = useState<string>()
  const [error, setError] = useState<string>()
  const [overlay, setOverlay] = useState(true)
  const [splitContourId, setSplitContourId] = useState<number>()
  const previewSequence = useRef(0)
  const filteredQueue = useMemo(
    () =>
      queue.filter(
        (item) =>
          (filter === 'all' || item.blockers?.includes('needs-split')) &&
          (!query ||
            item.syllable.includes(query) ||
            `U+${item.syllable.codePointAt(0)?.toString(16).toUpperCase()}`.includes(
              query.toUpperCase(),
            )),
      ),
    [filter, queue, query],
  )
  const selected = filteredQueue[index]
  useEffect(() => {
    void api<{ entries: QueueEntry[] }>('/queue')
      .then(({ entries }) => setQueue(entries))
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : 'Could not load queue.',
        ),
      )
  }, [])
  useEffect(() => {
    if (!selected) return
    void api<State>(`/glyph?syllable=${encodeURIComponent(selected.syllable)}`)
      .then((next) => {
        setState(next)
        setRevision(next.revision)
        setError(undefined)
      })
      .catch((reason: unknown) =>
        setError(
          reason instanceof Error ? reason.message : 'Could not load glyph.',
        ),
      )
  }, [selected])
  const refreshPreview = async (review: Review) => {
    const sequence = ++previewSequence.current
    try {
      const result = await api<PreviewResponse>('/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review }),
      })
      if (sequence !== previewSequence.current) return
      setState((current) =>
        current?.review === review ? { ...current, ...result } : current,
      )
      setError(undefined)
    } catch (reason) {
      if (sequence === previewSequence.current)
        setError(
          reason instanceof Error
            ? reason.message
            : 'Could not refresh preview.',
        )
    }
  }
  const updateDraft = (review: Review) => {
    if (!state) return
    setState({ ...state, review })
    void refreshPreview(review)
  }
  const beginReview = (review: Review) => ({
    ...review,
    status:
      review.status === 'approved' || review.status === 'unreviewed'
        ? 'reviewing'
        : review.status,
    approved: undefined,
  })
  const assign = (contourId: number, step: number | null) => {
    if (!state) return
    const review = beginReview({
      ...state.review,
      steps: state.review.steps.map((item) => ({
        ...item,
        geometry: item.geometry
          .filter(
            (geometry) =>
              geometry.kind !== 'contour' || geometry.contourId !== contourId,
          )
          .concat(item.order === step ? [{ kind: 'contour', contourId }] : []),
      })),
    })
    updateDraft(review)
  }
  const assignSplitPiece = (
    recipeId: string,
    pieceId: string,
    step: number | null,
  ) => {
    if (!state) return
    const review = beginReview({
      ...state.review,
      steps: state.review.steps.map((item) => ({
        ...item,
        geometry: item.geometry
          .filter(
            (geometry) =>
              geometry.kind !== 'split-piece' ||
              geometry.recipeId !== recipeId ||
              geometry.pieceId !== pieceId,
          )
          .concat(
            item.order === step
              ? [{ kind: 'split-piece', recipeId, pieceId }]
              : [],
          ),
      })),
    })
    updateDraft(review)
  }
  const startRecipe = (contourId: number) => {
    if (!state) return
    const contour = state.source.contours.find((item) => item.id === contourId)
    if (!contour) return
    const existingRecipeIds = new Set(
      state.review.splitRecipes.map((recipe) => recipe.id),
    )
    let suffix = 1
    let id = `split-${contourId}-${suffix}`
    while (existingRecipeIds.has(id)) {
      suffix += 1
      id = `split-${contourId}-${suffix}`
    }
    const review = beginReview({
      ...state.review,
      splitRecipes: [
        ...state.review.splitRecipes,
        {
          id,
          sourceContourId: contourId,
          sourceContourHash: contour.commandHash,
          splitRecipeSchemaVersion: 2,
          method: 'source-command-partition',
          rationale: 'Manual source-command partition.',
          visualValidation: { sourceContourHash: contour.commandHash },
          pieces: [],
        },
      ],
      steps: state.review.steps.map((item) => ({
        ...item,
        geometry: item.geometry.filter(
          (geometry) =>
            geometry.kind !== 'contour' || geometry.contourId !== contourId,
        ),
      })),
    })
    setSplitContourId(contourId)
    updateDraft(review)
  }
  const addPiece = (recipeId: string) => {
    if (!state) return
    const review = beginReview({
      ...state.review,
      splitRecipes: state.review.splitRecipes.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              pieces: [
                ...recipe.pieces,
                { id: `piece-${recipe.pieces.length + 1}`, tokens: [] },
              ],
            }
          : recipe,
      ),
    })
    updateDraft(review)
  }
  const updatePiece = (
    recipeId: string,
    pieceId: string,
    tokens: RecipeToken[],
  ) => {
    if (!state) return
    const review = beginReview({
      ...state.review,
      splitRecipes: state.review.splitRecipes.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              pieces: recipe.pieces.map((piece) =>
                piece.id === pieceId ? { ...piece, tokens } : piece,
              ),
            }
          : recipe,
      ),
    })
    updateDraft(review)
  }
  const deletePiece = (recipeId: string, pieceId: string) => {
    if (!state) return
    const review = beginReview({
      ...state.review,
      splitRecipes: state.review.splitRecipes.map((recipe) =>
        recipe.id === recipeId
          ? {
              ...recipe,
              pieces: recipe.pieces.filter((piece) => piece.id !== pieceId),
            }
          : recipe,
      ),
      steps: state.review.steps.map((step) => ({
        ...step,
        geometry: step.geometry.filter(
          (geometry) =>
            geometry.kind !== 'split-piece' ||
            geometry.recipeId !== recipeId ||
            geometry.pieceId !== pieceId,
        ),
      })),
    })
    updateDraft(review)
  }
  const deleteRecipe = (recipeId: string) => {
    if (!state) return
    const recipe = state.review.splitRecipes.find(
      (item) => item.id === recipeId,
    )
    if (!recipe) return
    const review = beginReview({
      ...state.review,
      splitRecipes: state.review.splitRecipes.filter(
        (item) => item.id !== recipeId,
      ),
      steps: state.review.steps.map((step) => ({
        ...step,
        geometry: step.geometry.filter(
          (geometry) =>
            geometry.kind !== 'split-piece' || geometry.recipeId !== recipeId,
        ),
      })),
    })
    setSplitContourId(undefined)
    updateDraft(review)
  }
  const activeRecipe = state?.review.splitRecipes.find(
    (recipe) => recipe.sourceContourId === splitContourId,
  )
  const activeContour = state?.source.contours.find(
    (contour) => contour.id === splitContourId,
  )
  const commandCoverage =
    activeContour && activeRecipe
      ? activeContour.commands.map((_, index) =>
          activeRecipe.pieces.reduce(
            (count, piece) =>
              count +
              piece.tokens.filter(
                (token) =>
                  token.kind === 'source-range' &&
                  index >= token.fromCommand &&
                  index <= token.toCommand,
              ).length,
            0,
          ),
        )
      : []
  const save = async (approve = false) => {
    if (!state) return
    previewSequence.current += 1
    try {
      const result = await api<SaveResponse>(approve ? '/approve' : '/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review: state.review,
          expectedRevision: revision,
          reviewer: 'local-reviewer',
        }),
      })
      setState((current) =>
        current ? retainSourceAfterSave(current, result) : current,
      )
      setRevision(result.revision)
      setQueue((items) =>
        items.map((item) =>
          item.syllable === result.review.syllable
            ? {
                ...item,
                reviewStatus: result.review.status,
                blockers: result.review.blockers,
              }
            : item,
        ),
      )
      setError(undefined)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Save failed.')
    }
  }
  const toggleNeedsSplit = () => {
    if (!state) return
    const review = {
      ...state.review,
      status: 'reviewing',
      blockers: state.review.blockers.includes('needs-split')
        ? state.review.blockers.filter((blocker) => blocker !== 'needs-split')
        : [...state.review.blockers, 'needs-split'],
    }
    updateDraft(review)
  }
  const reviewStateWarning =
    Boolean(state?.review.notes?.trim()) &&
    !state?.review.blockers.includes('needs-split')
  const hasCompleteCompiledPreview = Boolean(
    state &&
    state.source.physicalSteps.every((step) =>
      Boolean(state.compiled.paths[step.order]?.d),
    ),
  )
  return (
    <PageSurface contentClassName="max-w-7xl">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-[#a85d4e]">
            Development only
          </p>
          <h1 className="text-3xl font-bold text-[#39465b]">Jamo SVG Tagger</h1>
          <p className="mt-2 text-sm text-[#667085]">
            Reviewed Pretendard 600 ownership and constrained split recipes.
            This does not affect the learner renderer.
          </p>
        </div>
        <Link
          to="/"
          className="text-sm font-semibold text-[#8d4c43] hover:underline"
        >
          Back to learner
        </Link>
      </header>
      {error && <Card className="mt-4 text-[#9d3b32]">{error}</Card>}
      {reviewStateWarning && (
        <Card className="mt-4 border-[#e5b869] bg-[#fff9ed] text-[#7b4b17]">
          <strong>Review-state consistency warning.</strong> This saved note may
          describe unresolved split work, but it has no <code>needs-split</code>{' '}
          blocker. Explicitly choose “Mark as needs split” below, or retain the
          note after confirming no split is required.
        </Card>
      )}
      <section className="mt-6 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Card className="h-fit">
          <label className="text-sm font-semibold text-[#39465b]">
            Queue search
            <input
              className="mt-2 w-full rounded border p-2"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setIndex(0)
              }}
              placeholder="syllable or U+"
            />
          </label>
          <label className="mt-3 block text-xs font-semibold text-[#39465b]">
            Filter
            <select
              className="mt-1 w-full rounded border p-2"
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as 'all' | 'needs-split')
                setIndex(0)
              }}
            >
              <option value="all">All queue items</option>
              <option value="needs-split">Needs split</option>
            </select>
          </label>
          <p className="mt-3 text-xs text-[#667085]">
            {selected ? `${index + 1} / ${filteredQueue.length}` : '0'} shown ·{' '}
            {state?.review.status ?? 'loading'}
          </p>
          <div className="mt-3 space-y-1">
            {filteredQueue.map((item, itemIndex) => (
              <button
                key={item.syllable}
                onClick={() => setIndex(itemIndex)}
                className={`w-full rounded p-2 text-left text-sm ${selected?.syllable === item.syllable ? 'bg-[#e9efff] font-bold' : 'hover:bg-[#f7f7fa]'}`}
              >
                {item.syllable}{' '}
                {item.blockers?.includes('needs-split') && (
                  <span className="rounded bg-[#fff0d8] px-1 text-xs text-[#9a6424]">
                    needs split
                  </span>
                )}
                <span className="block text-xs text-[#667085]">
                  U+{item.syllable.codePointAt(0)?.toString(16).toUpperCase()} ·{' '}
                  {item.reviewStatus ?? 'unreviewed'} · P{item.priority}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setIndex(Math.max(0, index - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                setIndex(
                  Math.min(Math.max(0, filteredQueue.length - 1), index + 1),
                )
              }
            >
              Next
            </Button>
          </div>
        </Card>
        {state && (
          <main className="min-w-0">
            <section className="grid gap-4 md:grid-cols-3">
              <Card>
                <h2 className="font-bold text-[#39465b]">Source glyph</h2>
                <GlyphPreview
                  glyph={state.source}
                  paths={[{ d: state.source.sourcePath }]}
                />
              </Card>
              <Card>
                <h2 className="font-bold text-[#39465b]">Per-jamo result</h2>
                <p className="mt-1 text-xs text-[#667085]">
                  {hasCompleteCompiledPreview
                    ? 'Combined compiled/exportable geometry, colored by physical step.'
                    : 'Draft segmentation from selected source commands, colored by physical step.'}
                </p>
                {hasCompleteCompiledPreview ? (
                  <GlyphPreview
                    glyph={state.source}
                    colored
                    paths={state.compiled.paths}
                  />
                ) : (
                  <DraftSegmentationPreview
                    glyph={state.source}
                    review={state.review}
                  />
                )}
                {!hasCompleteCompiledPreview && (
                  <p className="text-xs font-semibold text-[#9a6424]">
                    Draft only — resolve coverage, seams, and all blockers to
                    inspect exportable filled paths.
                  </p>
                )}
              </Card>
              <Card>
                <div className="flex justify-between">
                  <h2 className="font-bold text-[#39465b]">Reconstruction</h2>
                  <label className="text-xs">
                    <input
                      type="checkbox"
                      checked={overlay}
                      onChange={(event) => setOverlay(event.target.checked)}
                    />{' '}
                    Overlay source
                  </label>
                </div>
                <GlyphPreview
                  glyph={state.source}
                  overlay={overlay}
                  paths={state.compiled.paths}
                />
              </Card>
            </section>
            <Card className="mt-4">
              <h2 className="font-bold text-[#39465b]">Physical-step result</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Inspect the exact path that would be exported for each ordered
                typing step.
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {state.source.physicalSteps.map((step) => {
                  const path = state.compiled.paths[step.order]
                  const hasGeometry = Boolean(path?.d)
                  return (
                    <article
                      className={`rounded border p-3 ${hasGeometry ? 'border-[#d8e3f2]' : 'border-[#e5b869] bg-[#fff9ed]'}`}
                      key={step.order}
                    >
                      <strong>
                        Step {step.order + 1} — {step.jamo}
                      </strong>
                      <GlyphPreview
                        glyph={state.source}
                        paths={path ? [{ d: path.d }] : []}
                      />
                      {hasGeometry ? (
                        <p className="text-xs text-[#667085]">
                          Compiled export path
                        </p>
                      ) : (
                        <p className="text-xs font-semibold text-[#9a6424]">
                          No compiled geometry — resolve ownership or split work
                          before approval.
                        </p>
                      )}
                    </article>
                  )
                })}
              </div>
            </Card>
            <Card className="mt-4">
              <h2 className="font-bold text-[#39465b]">
                Contour ownership — physical order:{' '}
                {state.source.physicalSteps.map(({ jamo }) => jamo).join(' / ')}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {state.source.contours.map((contour) => (
                  <article
                    className="rounded border border-[#d8e3f2] p-3"
                    key={contour.id}
                  >
                    <div className="flex justify-between">
                      <strong>Contour {contour.id + 1}</strong>
                      {state.review.splitRecipes.some(
                        (recipe) => recipe.sourceContourId === contour.id,
                      ) && (
                        <span className="text-xs text-[#9a6424]">
                          fixed split recipe
                        </span>
                      )}
                    </div>
                    <GlyphPreview
                      glyph={state.source}
                      paths={[{ d: contour.d }]}
                    />
                    {state.review.splitRecipes.some(
                      (recipe) => recipe.sourceContourId === contour.id,
                    ) ? (
                      <div className="mt-2 rounded border border-dashed border-[#d8e3f2] p-2">
                        <p className="text-xs font-semibold text-[#39465b]">
                          Live split ownership
                        </p>
                        <ul className="mt-1 space-y-1 text-xs text-[#667085]">
                          {state.review.steps.map((step) => {
                            const pieces = state.review.splitRecipes
                              .filter(
                                (recipe) =>
                                  recipe.sourceContourId === contour.id,
                              )
                              .flatMap((recipe) =>
                                recipe.pieces
                                  .filter((piece) =>
                                    step.geometry.some(
                                      (geometry) =>
                                        geometry.kind === 'split-piece' &&
                                        geometry.recipeId === recipe.id &&
                                        geometry.pieceId === piece.id,
                                    ),
                                  )
                                  .map((piece) => piece.id),
                              )
                            return (
                              <li key={step.order}>
                                {step.order + 1}. {step.jamo}:{' '}
                                {pieces.length ? pieces.join(', ') : 'pending'}
                              </li>
                            )
                          })}
                        </ul>
                        <p className="mt-2 text-xs text-[#667085]">
                          Assign or change a piece&apos;s jamo in Split
                          Workbench below; this preview updates before Save.
                        </p>
                      </div>
                    ) : (
                      <select
                        className="mt-2 w-full rounded border p-2"
                        value={
                          state.review.steps.find((step) =>
                            step.geometry.some(
                              (geometry) =>
                                geometry.kind === 'contour' &&
                                geometry.contourId === contour.id,
                            ),
                          )?.order ?? ''
                        }
                        onChange={(event) =>
                          assign(
                            contour.id,
                            event.target.value === ''
                              ? null
                              : Number(event.target.value),
                          )
                        }
                      >
                        <option value="">Unassigned</option>
                        {state.source.physicalSteps.map((step) => (
                          <option key={step.order} value={step.order}>
                            {step.order + 1}. {step.jamo}
                          </option>
                        ))}
                      </select>
                    )}
                  </article>
                ))}
              </div>
            </Card>
            <Card className="mt-4">
              <h2 className="font-bold text-[#39465b]">Split Workbench</h2>
              <p className="mt-1 text-sm text-[#667085]">
                Create only audited source-command partitions. No hand-drawn or
                replacement SVG geometry is accepted.
              </p>
              <label className="mt-3 block text-sm font-semibold">
                Source contour
                <select
                  className="mt-1 w-full rounded border p-2 font-normal"
                  value={splitContourId ?? ''}
                  onChange={(event) =>
                    setSplitContourId(
                      event.target.value === ''
                        ? undefined
                        : Number(event.target.value),
                    )
                  }
                >
                  <option value="">Select contour to inspect</option>
                  {state.source.contours.map((contour) => (
                    <option key={contour.id} value={contour.id}>
                      Contour {contour.id + 1}
                      {state.review.splitRecipes.some(
                        (recipe) => recipe.sourceContourId === contour.id,
                      )
                        ? ' — recipe exists'
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
              {activeContour && (
                <div className="mt-3 rounded border border-[#d8e3f2] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>
                      Contour {activeContour.id + 1} ·{' '}
                      {activeContour.commands.length} source commands
                    </strong>
                    {!activeRecipe ? (
                      <Button onClick={() => startRecipe(activeContour.id)}>
                        Start split recipe
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() => deleteRecipe(activeRecipe.id)}
                      >
                        Delete draft recipe
                      </Button>
                    )}
                  </div>
                  <GlyphPreview
                    glyph={state.source}
                    paths={[{ d: activeContour.d }]}
                  />
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Stable source commands and anchors
                    </summary>
                    <ol className="mt-2 max-h-64 overflow-auto rounded bg-[#f7f7fa] p-2 font-mono text-xs">
                      {activeContour.commands.map((command, commandIndex) => (
                        <li key={commandIndex}>
                          {commandIndex}: {JSON.stringify(command)}
                        </li>
                      ))}
                    </ol>
                  </details>
                  {activeRecipe && (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <strong>Pieces and coverage</strong>
                        <Button onClick={() => addPiece(activeRecipe.id)}>
                          Add piece
                        </Button>
                      </div>
                      <p className="text-xs">
                        Coverage:{' '}
                        {commandCoverage.filter((count) => count === 1).length}/
                        {commandCoverage.length} exactly once ·{' '}
                        {commandCoverage.filter((count) => count === 0).length}{' '}
                        uncovered ·{' '}
                        {commandCoverage.filter((count) => count > 1).length}{' '}
                        duplicate
                      </p>
                      {activeRecipe.pieces.map((piece) => {
                        const ranges = piece.tokens.filter(
                          (
                            token,
                          ): token is Extract<
                            RecipeToken,
                            { kind: 'source-range' }
                          > => token.kind === 'source-range',
                        )
                        const owner = state.review.steps.find((step) =>
                          step.geometry.some(
                            (geometry) =>
                              geometry.kind === 'split-piece' &&
                              geometry.recipeId === activeRecipe.id &&
                              geometry.pieceId === piece.id,
                          ),
                        )
                        const updateSourceRange = (
                          tokenIndex: number,
                          fromCommand: number,
                          toCommand: number,
                        ) =>
                          updatePiece(
                            activeRecipe.id,
                            piece.id,
                            piece.tokens.map((token, index) =>
                              index === tokenIndex &&
                              token.kind === 'source-range'
                                ? {
                                    kind: 'source-range',
                                    fromCommand: Math.min(
                                      fromCommand,
                                      toCommand,
                                    ),
                                    toCommand: Math.max(fromCommand, toCommand),
                                  }
                                : token,
                            ),
                          )
                        const updatePrimaryRange = (
                          fromCommand: number,
                          toCommand: number,
                        ) => {
                          const rangeIndex = piece.tokens.findIndex(
                            (token) => token.kind === 'source-range',
                          )
                          if (rangeIndex < 0)
                            updatePiece(
                              activeRecipe.id,
                              piece.id,
                              replacePrimarySourceRange(
                                piece.tokens,
                                fromCommand,
                                toCommand,
                              ),
                            )
                          else
                            updateSourceRange(
                              rangeIndex,
                              fromCommand,
                              toCommand,
                            )
                        }
                        return (
                          <article
                            className="rounded border border-[#d8e3f2] p-3"
                            key={piece.id}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <strong>{piece.id}</strong>
                              <Button
                                variant="secondary"
                                onClick={() =>
                                  deletePiece(activeRecipe.id, piece.id)
                                }
                              >
                                Delete piece
                              </Button>
                            </div>
                            <label className="mt-2 block text-xs font-semibold">
                              This geometry belongs to
                              <select
                                className="mt-1 w-full rounded border p-2 font-normal"
                                value={owner?.order ?? ''}
                                onChange={(event) =>
                                  assignSplitPiece(
                                    activeRecipe.id,
                                    piece.id,
                                    event.target.value === ''
                                      ? null
                                      : Number(event.target.value),
                                  )
                                }
                              >
                                <option value="">Choose a jamo to paint</option>
                                {state.source.physicalSteps.map((step) => (
                                  <option key={step.order} value={step.order}>
                                    {step.order + 1}. {step.jamo}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <CommandRangePainter
                              glyph={state.source}
                              contour={activeContour}
                              ranges={ranges}
                              targetJamo={owner?.jamo}
                              onRangeChange={updatePrimaryRange}
                            />
                            <div className="mt-2">
                              <p className="text-xs font-semibold text-[#39465b]">
                                Source ranges
                              </p>
                              <div className="mt-1 space-y-2">
                                {piece.tokens.map((token, tokenIndex) => {
                                  if (token.kind !== 'source-range') return null
                                  const nextToken = piece.tokens[tokenIndex + 1]
                                  const seamAfterRange =
                                    nextToken?.kind === 'line-to-anchor'
                                      ? nextToken
                                      : undefined
                                  const nextRange = piece.tokens
                                    .slice(tokenIndex + 1)
                                    .find(
                                      (candidate) =>
                                        candidate.kind === 'source-range',
                                    )
                                  const suggestedAnchor =
                                    nextRange && nextRange.fromCommand > 0
                                      ? nextRange.fromCommand - 1
                                      : undefined
                                  return (
                                    <div
                                      key={`${piece.id}-${tokenIndex}`}
                                      className="rounded border border-[#d8e3f2] p-2"
                                    >
                                      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                        <label className="text-xs font-semibold">
                                          Range from
                                          <SourceRangeInput
                                            value={token.fromCommand}
                                            onChange={(value) =>
                                              updateSourceRange(
                                                tokenIndex,
                                                value,
                                                token.toCommand,
                                              )
                                            }
                                          />
                                        </label>
                                        <label className="text-xs font-semibold">
                                          Range to
                                          <SourceRangeInput
                                            value={token.toCommand}
                                            onChange={(value) =>
                                              updateSourceRange(
                                                tokenIndex,
                                                token.fromCommand,
                                                value,
                                              )
                                            }
                                          />
                                        </label>
                                        <Button
                                          variant="secondary"
                                          onClick={() =>
                                            updatePiece(
                                              activeRecipe.id,
                                              piece.id,
                                              removeSourceRange(
                                                piece.tokens,
                                                tokenIndex,
                                              ),
                                            )
                                          }
                                        >
                                          Remove
                                        </Button>
                                      </div>
                                      {seamAfterRange ? (
                                        <div className="mt-2 flex items-center justify-between gap-2 rounded bg-[#fff8ed] p-2 text-xs">
                                          <span>
                                            Seam before next range → command{' '}
                                            {seamAfterRange.anchor.commandIndex}{' '}
                                            end
                                          </span>
                                          <Button
                                            variant="secondary"
                                            onClick={() =>
                                              updatePiece(
                                                activeRecipe.id,
                                                piece.id,
                                                piece.tokens.filter(
                                                  (_, index) =>
                                                    index !== tokenIndex + 1,
                                                ),
                                              )
                                            }
                                          >
                                            Remove seam
                                          </Button>
                                        </div>
                                      ) : nextRange ? (
                                        <label className="mt-2 block text-xs font-semibold text-[#39465b]">
                                          Line seam to next range
                                          <span className="ml-1 font-normal text-[#667085]">
                                            (usually command{' '}
                                            {suggestedAnchor ?? 0} end)
                                          </span>
                                          <select
                                            className="mt-1 w-full rounded border p-2 font-normal"
                                            defaultValue=""
                                            onChange={(event) => {
                                              if (event.target.value === '')
                                                return
                                              const tokens = [...piece.tokens]
                                              tokens.splice(tokenIndex + 1, 0, {
                                                kind: 'line-to-anchor',
                                                anchor: {
                                                  contourId: activeContour.id,
                                                  commandIndex: Number(
                                                    event.target.value,
                                                  ),
                                                  point: 'end',
                                                },
                                                reason: 'interior-closure-seam',
                                              })
                                              updatePiece(
                                                activeRecipe.id,
                                                piece.id,
                                                tokens,
                                              )
                                            }}
                                          >
                                            <option value="">
                                              Choose anchor…
                                            </option>
                                            {suggestedAnchor !== undefined && (
                                              <option value={suggestedAnchor}>
                                                Suggested: command{' '}
                                                {suggestedAnchor} end
                                              </option>
                                            )}
                                            {activeContour.commands.map(
                                              (_, commandIndex) =>
                                                commandIndex ===
                                                suggestedAnchor ? null : (
                                                  <option
                                                    key={commandIndex}
                                                    value={commandIndex}
                                                  >
                                                    command {commandIndex} end
                                                  </option>
                                                ),
                                            )}
                                          </select>
                                        </label>
                                      ) : null}
                                    </div>
                                  )
                                })}
                                {!piece.tokens.some(
                                  (token) => token.kind === 'source-range',
                                ) && (
                                  <p className="text-xs text-[#667085]">
                                    No source ranges painted yet.
                                  </p>
                                )}
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    updatePiece(activeRecipe.id, piece.id, [
                                      ...piece.tokens,
                                      {
                                        kind: 'source-range',
                                        fromCommand: 0,
                                        toCommand: 0,
                                      },
                                    ])
                                  }
                                >
                                  Add source range
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                variant="secondary"
                                onClick={() =>
                                  updatePiece(activeRecipe.id, piece.id, [
                                    ...piece.tokens,
                                    {
                                      kind: 'close-to-start',
                                      reason: 'interior-closure-seam',
                                    },
                                  ])
                                }
                              >
                                Add close-to-start seam
                              </Button>
                            </div>
                            <p className="mt-2 text-xs text-[#667085]">
                              Tokens:{' '}
                              {piece.tokens
                                .map((token) =>
                                  token.kind === 'source-range'
                                    ? `${token.fromCommand}–${token.toCommand}`
                                    : token.kind,
                                )
                                .join(', ') || 'none'}
                            </p>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </Card>
            <Card className="mt-4">
              <h2 className="font-bold text-[#39465b]">
                Validation and review
              </h2>
              <p className="mt-2 text-sm">
                {[
                  ...new Set([
                    ...state.validation.blockers,
                    ...state.review.blockers,
                  ]),
                ].length
                  ? `Blocked: ${[...new Set([...state.validation.blockers, ...state.review.blockers])].join(', ')}`
                  : 'No automatic blockers. Human visual approval is still required.'}
              </p>
              <label className="mt-3 block text-sm font-semibold text-[#39465b]">
                Review note
                <textarea
                  className="mt-1 min-h-20 w-full rounded border p-2 text-sm font-normal"
                  value={state.review.notes ?? ''}
                  onChange={(event) =>
                    setState(
                      (current) =>
                        current && {
                          ...current,
                          review: {
                            ...current.review,
                            notes: event.target.value,
                          },
                        },
                    )
                  }
                  placeholder="Why this glyph needs later split work…"
                />
              </label>
              <p className="mt-1 text-xs text-[#667085]">
                SVG paths use evenodd fill to preserve counters/holes.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={toggleNeedsSplit}>
                  {state.review.blockers.includes('needs-split')
                    ? 'Clear needs split'
                    : 'Mark as needs split'}
                </Button>
                <Button onClick={() => void save(false)}>Save review</Button>
                <Button
                  variant="secondary"
                  disabled={
                    state.validation.blockers.length > 0 ||
                    state.review.blockers.includes('needs-split')
                  }
                  onClick={() => void save(true)}
                >
                  Approve after visual review
                </Button>
              </div>
            </Card>
          </main>
        )}
      </section>
    </PageSurface>
  )
}
