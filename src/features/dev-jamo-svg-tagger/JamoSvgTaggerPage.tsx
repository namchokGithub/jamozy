import { useEffect, useMemo, useRef, useState } from 'react'
// import { Link } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { Modal } from '../../components/ui/Modal'
import { PageSurface } from '../../components/ui/PageSurface'
import { retainSourceAfterSave } from './tagger-state'
import { counterContours } from '../../../tools/jamo-svg/compile'
import {
  commandCoverage as coverageOf,
  removeSourceRange,
} from '../../../tools/jamo-svg/split-workbench'
import type {
  CachedContour,
  CachedGlyph,
  RecipeToken,
} from '../../../tools/jamo-svg/types'

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
    counterContours?: Array<{ contourId: number; contourHash: string }>
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
  svgClassName = 'h-48 w-full',
}: {
  svgClassName?: string
  glyph: Glyph
  paths: Array<{ d: string; jamo?: string }>
  colored?: boolean
  overlay?: boolean
}) {
  return (
    <svg
      className={svgClassName}
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
function SourceRangeEditor({
  fromCommand,
  toCommand,
  onUpdate,
  onRemove,
}: {
  fromCommand: number
  toCommand: number
  onUpdate: (fromCommand: number, toCommand: number) => void
  onRemove: () => void
}) {
  const [fromDraft, setFromDraft] = useState(String(fromCommand))
  const [toDraft, setToDraft] = useState(String(toCommand))
  const update = () => {
    const nextFrom = Number(fromDraft)
    const nextTo = Number(toDraft)
    if (!Number.isInteger(nextFrom) || !Number.isInteger(nextTo)) return
    onUpdate(nextFrom, nextTo)
  }
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-xs font-semibold">
        Range from
        <input
          className="mt-1 w-full rounded border p-2 font-normal"
          type="text"
          value={fromDraft}
          onChange={(event) => setFromDraft(event.target.value)}
        />
      </label>
      <label className="text-xs font-semibold">
        Range to
        <input
          className="mt-1 w-full rounded border p-2 font-normal"
          type="text"
          value={toDraft}
          onChange={(event) => setToDraft(event.target.value)}
        />
      </label>
      <div className="flex flex-col justify-end gap-1">
        <Button
          className="rounded px-2 py-1 text-xs"
          variant="secondary"
          onClick={update}
        >
          Update
        </Button>
        <Button
          className="rounded px-2 py-1 text-xs"
          variant="secondary"
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    </div>
  )
}
/**
 * Per-contour colors in a recipe: the source contour first, then each counter.
 * `selected` marks commands in a range; `idle` marks the rest of that contour.
 */
const contourPalette = [
  { selected: '#e66c58', idle: '#4c8f8b' },
  { selected: '#7c3aed', idle: '#b9a7ef' },
  { selected: '#d97706', idle: '#f2c98a' },
]
const contourColor = (order: number) =>
  contourPalette[order % contourPalette.length]
function CommandRangePainter({
  glyph,
  contour,
  counters = [],
  ranges,
  inspect = false,
  onAddSelectedRange,
  onAddNewRange,
}: {
  glyph: Glyph
  contour: CachedContour
  /** Counters the recipe partitions with `contour`; drawn and selectable too. */
  counters?: CachedContour[]
  ranges: Array<{ fromCommand: number; toCommand: number; contourId?: number }>
  inspect?: boolean
  onAddSelectedRange?: (
    fromCommand: number,
    toCommand: number,
    contourId: number,
  ) => void
  onAddNewRange?: (
    fromCommand: number,
    toCommand: number,
    contourId: number,
  ) => void
}) {
  const [inspectRange, setInspectRange] = useState<
    { contourId: number; start: number; end: number } | undefined
  >()
  const dragRange = useRef<
    { contourId: number; start: number; end: number } | undefined
  >(undefined)
  const selected = (contourId: number, index: number) => {
    if (inspectRange)
      return (
        inspectRange.contourId === contourId &&
        index >= Math.min(inspectRange.start, inspectRange.end) &&
        index <= Math.max(inspectRange.start, inspectRange.end)
      )
    return ranges.some(
      (range) =>
        (range.contourId ?? contour.id) === contourId &&
        index >= range.fromCommand &&
        index <= range.toCommand,
    )
  }
  const drawn = [contour, ...counters]
  const label = (contourId: number) =>
    contourId === contour.id ? '' : `Contour ${contourId + 1} `
  const finish = () => {
    dragRange.current = undefined
  }
  // Inspect mode zooms to the contour itself; marks keep the same on-screen
  // size by scaling with the zoomed view.
  const pad = 140
  const view = inspect
    ? {
        x: contour.bounds.x1 - pad,
        y: contour.bounds.y1 - pad,
        width: contour.bounds.x2 - contour.bounds.x1 + pad * 2,
        height: contour.bounds.y2 - contour.bounds.y1 + pad * 2,
      }
    : { x: 0, y: 0, width: glyph.advanceWidth, height: 2048 }
  const scale = inspect ? Math.max(view.width, view.height) / 2048 : 1
  return (
    <div className="mt-3 rounded border border-[#d8e3f2] bg-[#f9fbff] p-3">
      <p className="text-xs font-semibold text-[#39465b]">
        {inspect ? 'Inspect source commands' : 'Paint source commands'}
      </p>
      <p className="mt-1 text-xs text-[#667085]">
        {inspect
          ? 'Click or drag to highlight a command range (darker color). This does not change any source range.'
          : 'Preview only: reads the source ranges entered below.'}
      </p>
      <svg
        className={`mt-2 w-full touch-none ${inspect ? 'h-80' : 'h-36'}`}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        role="img"
        aria-label="Paint a source-command range"
        onPointerUp={inspect ? finish : undefined}
        onPointerMove={
          inspect
            ? (event) => {
                const target = event.target as Element
                const attribute = target.getAttribute('data-command-index')
                if (attribute === null) return
                const commandIndex = Number(attribute)
                if (
                  event.buttons === 1 &&
                  dragRange.current &&
                  Number(target.getAttribute('data-contour-id')) ===
                    dragRange.current.contourId &&
                  Number.isInteger(commandIndex)
                ) {
                  dragRange.current.end = commandIndex
                  setInspectRange({ ...dragRange.current })
                }
              }
            : undefined
        }
        onPointerLeave={
          inspect
            ? (event) => {
                if (event.buttons === 0) finish()
              }
            : undefined
        }
      >
        {drawn.map((item) => (
          <g key={item.id}>
            <path
              d={item.d}
              fill="none"
              stroke="#c4cfdf"
              strokeWidth={18 * scale}
            />
            {item.commands.map((_, index) => {
              const segment = commandSegmentPath(item.commands, index)
              if (!segment) return null
              const palette = contourColor(drawn.indexOf(item))
              const color = selected(item.id, index)
                ? palette.selected
                : palette.idle
              return segment.point ? (
                <g key={index}>
                  {/* {index === 0 && (
                <text
                  x={segment.point.x + 84 * scale}
                  y={segment.point.y - 64 * scale}
                  fontSize={96 * scale}
                  fontWeight={700}
                  fill={color}
                  pointerEvents="none"
                >
                  start 0
                </text>
              )} */}
                  <circle
                    cx={segment.point.x}
                    cy={segment.point.y}
                    r={(index === 0 ? 64 : 22) * scale}
                    fill={color}
                    stroke={index === 0 ? '#ffffff' : undefined}
                    strokeWidth={index === 0 ? 12 * scale : undefined}
                    className={inspect ? 'cursor-crosshair' : undefined}
                    onPointerDown={() => {
                      if (!inspect) return
                      dragRange.current = {
                        contourId: item.id,
                        start: index,
                        end: index,
                      }
                      setInspectRange({
                        contourId: item.id,
                        start: index,
                        end: index,
                      })
                    }}
                    data-command-index={index}
                    data-contour-id={item.id}
                  />
                </g>
              ) : (
                <path
                  key={index}
                  d={segment.d}
                  fill="none"
                  stroke={color}
                  strokeWidth={28 * scale}
                  strokeLinecap="round"
                  className={inspect ? 'cursor-crosshair' : undefined}
                  onPointerDown={() => {
                    if (!inspect) return
                    dragRange.current = {
                      contourId: item.id,
                      start: index,
                      end: index,
                    }
                    setInspectRange({
                      contourId: item.id,
                      start: index,
                      end: index,
                    })
                  }}
                  data-command-index={index}
                  data-contour-id={item.id}
                />
              )
            })}
          </g>
        ))}
      </svg>
      <div className="flex items-center gap-2 text-xs text-[#667085]">
        <p>
          {inspectRange
            ? `Selected ${label(inspectRange.contourId)}commands ${Math.min(inspectRange.start, inspectRange.end)}–${Math.max(inspectRange.start, inspectRange.end)}.`
            : ranges.length > 0
              ? `Source ranges: ${ranges.map((range) => `${label(range.contourId ?? contour.id)}${range.fromCommand}–${range.toCommand}`).join(', ')}.`
              : 'Click a segment, or drag from the first segment to the last.'}
        </p>
        {inspectRange && onAddSelectedRange && (
          <button
            type="button"
            className="rounded border border-[#d8e3f2] bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#39465b] hover:border-[#a85d4e] hover:text-[#8d4c43]"
            onClick={() =>
              onAddSelectedRange(
                Math.min(inspectRange.start, inspectRange.end),
                Math.max(inspectRange.start, inspectRange.end),
                inspectRange.contourId,
              )
            }
          >
            Add to latest range
          </button>
        )}
        {inspectRange && onAddNewRange && (
          <button
            type="button"
            className="rounded border border-[#d8e3f2] bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#39465b] hover:border-[#a85d4e] hover:text-[#8d4c43]"
            onClick={() =>
              onAddNewRange(
                Math.min(inspectRange.start, inspectRange.end),
                Math.max(inspectRange.start, inspectRange.end),
                inspectRange.contourId,
              )
            }
          >
            Add new range
          </button>
        )}
      </div>
    </div>
  )
}
function DraftSegmentationPreview({
  glyph,
  review,
  svgClassName = 'h-48 w-full',
}: {
  svgClassName?: string
  glyph: Glyph
  review: Review
}) {
  return (
    <svg
      className={svgClassName}
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
          const piece = recipe?.pieces.find(
            (item) => item.id === geometry.pieceId,
          )
          if (!recipe || !piece) return []
          // Ranges may sit on a declared counter; resolve each one's contour.
          const recipeContours = glyph.contours.filter(
            (item) =>
              item.id === recipe.sourceContourId ||
              recipe.counterContours?.some(
                ({ contourId }) => contourId === item.id,
              ),
          )
          return recipeContours.flatMap((contour) =>
            contour.commands.flatMap((_, commandIndex) => {
              const selected = piece.tokens.some(
                (token) =>
                  token.kind === 'source-range' &&
                  (token.contourId ?? recipe.sourceContourId) === contour.id &&
                  commandIndex >= token.fromCommand &&
                  commandIndex <= token.toCommand,
              )
              if (!selected) return []
              const segment = commandSegmentPath(contour.commands, commandIndex)
              if (!segment) return []
              const key = `piece-${step.order}-${piece.id}-${contour.id}-${commandIndex}`
              return segment.point
                ? [
                    <circle
                      key={key}
                      cx={segment.point.x}
                      cy={segment.point.y}
                      r="20"
                      fill={color}
                    />,
                  ]
                : [
                    <path
                      key={key}
                      d={segment.d}
                      fill="none"
                      stroke={color}
                      strokeWidth="24"
                      strokeLinecap="round"
                    />,
                  ]
            }),
          )
        }),
      )}
    </svg>
  )
}
const QUEUE_PAGE_SIZE = 12
const reviewStatuses = [
  'unreviewed',
  'proposed',
  'reviewing',
  'approved',
  'stale',
] as const
/** What each validation blocker means and where to fix it in the Tagger. */
const blockerHints: Record<string, string> = {
  'invalid-split-recipe':
    'A split recipe is not a valid partition. Keep every range inside its contour, use every command exactly once, start counter ranges at 1, and point seams only at the recipe’s own contours.',
  'duplicate-ownership':
    'A contour or piece belongs to more than one step, or a contour used by a split recipe is also assigned whole in Contour ownership.',
  'unassigned-source-geometry':
    'A contour or split piece has no step. Assign it in Contour ownership or Split Workbench.',
  'empty-physical-step': 'A typing step has no geometry yet.',
  'counter-owner-mismatch':
    'A counter (hole) belongs to a different step than the outline around it. Split that outline instead.',
  'reconstruction-mismatch':
    'A step’s compiled path is empty or does not start with a move.',
  'needs-split':
    'The review is marked “needs split”. Clear it once the split is finished.',
  'ambiguous-ownership': 'Review steps do not match this glyph’s typing steps.',
  'fingerprint-mismatch':
    'The review was made for different source geometry. Re-review this glyph.',
}
const commandList = (indexes: number[]) => indexes.join(', ')
/** Concrete split-recipe problems, so a failed save can say where to look. */
function recipeIssues(state: State): string[] {
  const issues: string[] = []
  const consumed = new Set<number>()
  for (const recipe of state.review.splitRecipes) {
    const ids = [
      recipe.sourceContourId,
      ...(recipe.counterContours ?? []).map(({ contourId }) => contourId),
    ]
    for (const id of ids) {
      const contour = state.source.contours.find((item) => item.id === id)
      if (!contour) continue
      consumed.add(id)
      const isCounter = id !== recipe.sourceContourId
      const name = `Contour ${id + 1}${isCounter ? ' (counter)' : ''}`
      const ranges = recipe.pieces.flatMap(({ id: pieceId, tokens }) =>
        tokens.flatMap((token) =>
          token.kind === 'source-range' &&
          (token.contourId ?? recipe.sourceContourId) === id
            ? [{ pieceId, token }]
            : [],
        ),
      )
      for (const { pieceId, token } of ranges) {
        if (token.toCommand >= contour.commands.length)
          issues.push(
            `${name}, ${pieceId}: range ${token.fromCommand}–${token.toCommand} ends past the last command (${contour.commands.length - 1}).`,
          )
        if (isCounter && token.fromCommand < 1)
          issues.push(
            `${name}, ${pieceId}: range ${token.fromCommand}–${token.toCommand} uses command 0 (the counter start); start it at 1.`,
          )
      }
      const counts = coverageOf(contour, recipe.pieces, recipe.sourceContourId)
      const missing = counts.flatMap((count, index) =>
        count === 0 && !(isCounter && index === 0) ? [index] : [],
      )
      const repeated = counts.flatMap((count, index) =>
        count > 1 ? [index] : [],
      )
      if (missing.length)
        issues.push(`${name}: commands ${commandList(missing)} are not used.`)
      if (repeated.length)
        issues.push(
          `${name}: commands ${commandList(repeated)} are used more than once.`,
        )
    }
  }
  for (const step of state.review.steps)
    for (const ref of step.geometry)
      if (ref.kind === 'contour' && consumed.has(ref.contourId))
        issues.push(
          `Contour ${ref.contourId + 1} is used by a split recipe but also assigned whole to ${step.jamo}; clear it in Contour ownership.`,
        )
  return issues
}
const compactButton =
  'rounded-full border border-[#d8dce6] px-3 py-1 text-xs font-semibold text-[#39465b] hover:bg-[#f7f7fa] disabled:cursor-not-allowed disabled:opacity-40'
const statusSnapshotOf = (items: QueueEntry[]) =>
  new Map(
    items.map((item) => [item.syllable, item.reviewStatus ?? 'unreviewed']),
  )
export default function JamoSvgTaggerPage() {
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'needs-split'>('all')
  // Empty means every status.
  const [statusFilter, setStatusFilter] = useState<string[]>(['unreviewed'])
  // Status membership is captured when the filter is applied, so saving the
  // selected glyph does not drop it out of the list mid-review.
  const [statusSnapshot, setStatusSnapshot] = useState<Map<string, string>>(
    new Map(),
  )
  const [index, setIndex] = useState(0)
  const [freezePreviews, setFreezePreviews] = useState(true)
  const [state, setState] = useState<State | null>(null)
  const [revision, setRevision] = useState<string>()
  const [error, setError] = useState<string>()
  const [saveFailure, setSaveFailure] = useState<{
    action: 'Save' | 'Approve'
    message: string
    blockers: string[]
    issues: string[]
  }>()
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [overlay, setOverlay] = useState(true)
  const [splitContourId, setSplitContourId] = useState<number>()
  const previewSequence = useRef(0)
  const filteredQueue = useMemo(
    () =>
      queue.filter(
        (item) =>
          (filter === 'all' || item.blockers?.includes('needs-split')) &&
          (statusFilter.length === 0 ||
            statusFilter.includes(
              statusSnapshot.get(item.syllable) ?? 'unreviewed',
            )) &&
          (!query ||
            item.syllable.includes(query) ||
            `U+${item.syllable.codePointAt(0)?.toString(16).toUpperCase()}`.includes(
              query.toUpperCase(),
            )),
      ),
    [filter, queue, query, statusFilter, statusSnapshot],
  )
  const selected = filteredQueue[index]
  const queueLength = filteredQueue.length
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        ![
          'ArrowLeft',
          'ArrowRight',
          'a',
          'd',
          's',
          'f',
          'ฟ',
          'ก',
          'ห',
          'ด',
        ].includes(event.key)
      )
        return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return
      const target = event.target as HTMLElement | null
      if (
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      )
        return
      event.preventDefault()
      if (event.key === 's' || event.key === 'ห') {
        void save()
        return
      }
      if (event.key === 'f' || event.key === 'ด') {
        void save(true)
        return
      }
      setIndex((current) =>
        event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'ฟ'
          ? Math.max(0, current - 1)
          : Math.min(Math.max(0, queueLength - 1), current + 1),
      )
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [queueLength, save])
  const page = Math.floor(index / QUEUE_PAGE_SIZE)
  const pageCount = Math.max(
    1,
    Math.ceil(filteredQueue.length / QUEUE_PAGE_SIZE),
  )
  const pageItems = filteredQueue.slice(
    page * QUEUE_PAGE_SIZE,
    (page + 1) * QUEUE_PAGE_SIZE,
  )
  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const item of queue) {
      const status = item.reviewStatus ?? 'unreviewed'
      counts.set(status, (counts.get(status) ?? 0) + 1)
    }
    return counts
  }, [queue])
  const applyStatusFilter = (statuses: string[]) => {
    setStatusFilter(statuses)
    setStatusSnapshot(statusSnapshotOf(queue))
    setIndex(0)
  }
  useEffect(() => {
    void api<{ entries: QueueEntry[] }>('/queue')
      .then(({ entries }) => {
        const snapshot = statusSnapshotOf(entries)
        const has = (status: string) => [...snapshot.values()].includes(status)
        setQueue(entries)
        setStatusSnapshot(snapshot)
        setStatusFilter(
          has('unreviewed')
            ? ['unreviewed']
            : has('reviewing')
              ? ['reviewing']
              : [],
        )
      })
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
  useEffect(() => {
    if (!showSaveSuccess) return
    const timeout = window.setTimeout(() => setShowSaveSuccess(false), 2000)
    return () => window.clearTimeout(timeout)
  }, [showSaveSuccess])
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
  const enclosedCounters =
    state && activeContour
      ? counterContours(state.source as unknown as CachedGlyph)
          .filter(({ outerId }) => outerId === activeContour.id)
          .flatMap(({ counterId }) =>
            state.source.contours.filter(({ id }) => id === counterId),
          )
      : []
  const declaredCounters = enclosedCounters.filter(({ id }) =>
    activeRecipe?.counterContours?.some((item) => item.contourId === id),
  )
  const recipeContours = activeContour
    ? [activeContour, ...declaredCounters]
    : []
  const contourName = (contourId: number) =>
    `Contour ${contourId + 1}${contourId === activeRecipe?.sourceContourId ? '' : ' (counter)'}`
  // A counter's leading M carries no geometry and is never consumed.
  const coverageLines =
    activeRecipe && activeContour
      ? recipeContours.map((contour) => {
          const allCounts = coverageOf(
            contour,
            activeRecipe.pieces,
            activeRecipe.sourceContourId,
          )
          const isCounter = contour.id !== activeContour.id
          const counts = allCounts.slice(isCounter ? 1 : 0)
          // Validation rejects any counter range that consumes its start M.
          const usesCounterStart = isCounter && allCounts[0] > 0
          const outOfRange = activeRecipe.pieces
            .flatMap(({ tokens }) => tokens)
            .filter(
              (token) =>
                token.kind === 'source-range' &&
                (token.contourId ?? activeRecipe.sourceContourId) ===
                  contour.id &&
                token.toCommand >= contour.commands.length,
            ).length
          return { contour, counts, outOfRange, usesCounterStart }
        })
      : []
  const toggleCounter = (counterId: number) => {
    if (!state || !activeRecipe) return
    const counter = state.source.contours.find(({ id }) => id === counterId)
    if (!counter) return
    const declared = activeRecipe.counterContours?.some(
      (item) => item.contourId === counterId,
    )
    const review = beginReview({
      ...state.review,
      splitRecipes: state.review.splitRecipes.map((recipe) =>
        recipe.id !== activeRecipe.id
          ? recipe
          : {
              ...recipe,
              counterContours: declared
                ? recipe.counterContours?.filter(
                    (item) => item.contourId !== counterId,
                  )
                : [
                    ...(recipe.counterContours ?? []),
                    { contourId: counterId, contourHash: counter.commandHash },
                  ],
              // Removing a counter also removes every range and seam on it.
              pieces: declared
                ? recipe.pieces.map((piece) => ({
                    ...piece,
                    tokens: piece.tokens.filter((token) =>
                      token.kind === 'source-range'
                        ? token.contourId !== counterId
                        : token.kind === 'close-to-start' ||
                          token.anchor.contourId !== counterId,
                    ),
                  }))
                : recipe.pieces,
            },
      ),
      // A consumed counter can no longer be owned whole.
      steps: declared
        ? state.review.steps
        : state.review.steps.map((step) => ({
            ...step,
            geometry: step.geometry.filter(
              (ref) => ref.kind !== 'contour' || ref.contourId !== counterId,
            ),
          })),
    })
    updateDraft(review)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  async function save(approve = false) {
    if (!state) return
    previewSequence.current += 1
    const review = approve
      ? { ...state.review, notes: undefined }
      : state.review
    try {
      const result = await api<SaveResponse>(approve ? '/approve' : '/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review,
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
      if (approve) window.scrollTo({ top: 0, behavior: 'smooth' })
      else setShowSaveSuccess(true)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Save failed.'
      setError(message)
      setSaveFailure({
        action: approve ? 'Approve' : 'Save',
        message,
        blockers: [
          ...new Set([
            ...Object.keys(blockerHints).filter((blocker) =>
              message.includes(blocker),
            ),
            ...state.validation.blockers,
          ]),
        ],
        issues: recipeIssues(state),
      })
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
    state?.review.status !== 'approved' &&
    Boolean(state?.review.notes?.trim()) &&
    !state?.review.blockers.includes('needs-split')
  const canApprove = Boolean(
    state &&
    state.review.status !== 'approved' &&
    state.validation.blockers.length === 0 &&
    !state.review.blockers.includes('needs-split'),
  )
  const previewSvgClass = freezePreviews ? 'h-32 w-full' : 'h-48 w-full'
  const hasCompleteCompiledPreview = Boolean(
    state &&
    state.source.physicalSteps.every((step) =>
      Boolean(state.compiled.paths[step.order]?.d),
    ),
  )
  return (
    <PageSurface className="overflow-visible!" contentClassName="max-w-7xl">
      <Modal
        open={Boolean(saveFailure)}
        title={`${saveFailure?.action ?? 'Save'} failed`}
        onClose={() => setSaveFailure(undefined)}
      >
        {saveFailure && (
          <div className="mt-3 max-h-[60vh] space-y-3 overflow-auto text-sm text-[#39465b]">
            <p className="rounded bg-[#fff4f2] p-2 font-mono text-xs text-[#9d3b32]">
              {saveFailure.message}
            </p>
            {saveFailure.blockers.length > 0 && (
              <div>
                <p className="font-semibold">Blockers</p>
                <ul className="mt-1 space-y-1.5">
                  {saveFailure.blockers.map((blocker) => (
                    <li key={blocker}>
                      <code className="text-xs font-semibold">{blocker}</code>
                      {blockerHints[blocker] && (
                        <span className="block text-xs text-[#667085]">
                          {blockerHints[blocker]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {saveFailure.issues.length > 0 && (
              <div>
                <p className="font-semibold">Where to look</p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                  {saveFailure.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>
      {showSaveSuccess && (
        <div
          role="status"
          className="fixed top-4 right-4 z-50 rounded-lg bg-[#39465b] px-4 py-3 text-sm font-semibold text-white shadow-lg"
        >
          Preview saved
        </div>
      )}
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
        {/* <Link
          to="/"
          className="text-sm font-semibold text-[#8d4c43] hover:underline"
        >
          Back to learner
        </Link> */}
      </header>
      {state && (
        <div
          className={
            freezePreviews
              ? 'sticky top-0 z-30 -mx-4 mt-4 bg-[#fffaf1]/95 px-4 py-3 shadow-[0_12px_20px_-18px_rgba(54,41,31,0.7)] backdrop-blur sm:-mx-6 sm:px-6'
              : 'mt-4'
          }
        >
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <p className="font-semibold text-[#39465b]">
              {state.source.syllable} · U+
              {state.source.syllable
                .codePointAt(0)
                ?.toString(16)
                .toUpperCase()}{' '}
              · {state.review.status}
            </p>
            <div className="flex items-center gap-4 text-xs font-semibold">
              {error && (
                <span
                  role="alert"
                  title={error}
                  className="max-w-md truncate font-semibold text-[#c0362c]"
                >
                  {error}
                </span>
              )}
              <label className="text-[#39465b]">
                <input
                  type="checkbox"
                  checked={freezePreviews}
                  onChange={(event) => setFreezePreviews(event.target.checked)}
                />{' '}
                Freeze previews
              </label>
            </div>
          </div>
          <section className="grid gap-3 md:grid-cols-4">
            <Card className="p-4">
              <h2 className="font-bold text-[#39465b]">Source glyph</h2>
              <GlyphPreview
                svgClassName={previewSvgClass}
                glyph={state.source}
                paths={[{ d: state.source.sourcePath }]}
              />
            </Card>
            <Card className="p-4">
              <h2 className="font-bold text-[#39465b]">
                Per-jamo result{' '}
                {state.source.physicalSteps.map(({ jamo }) => jamo).join(' / ')}
              </h2>
              <p
                className={`mt-1 text-xs text-[#667085] ${freezePreviews ? 'sr-only' : ''}`}
              >
                {hasCompleteCompiledPreview
                  ? 'Combined compiled/exportable geometry, colored by physical step.'
                  : 'Draft segmentation from selected source commands, colored by physical step.'}
              </p>
              {hasCompleteCompiledPreview ? (
                <GlyphPreview
                  svgClassName={previewSvgClass}
                  glyph={state.source}
                  colored
                  paths={state.compiled.paths}
                />
              ) : (
                <DraftSegmentationPreview
                  svgClassName={previewSvgClass}
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
            <Card className="p-4">
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
                svgClassName={previewSvgClass}
                glyph={state.source}
                overlay={overlay}
                paths={state.compiled.paths}
              />
            </Card>
            <Card className="p-4">
              <h2 className="font-bold text-[#39465b]">
                Validation and review
              </h2>
              <p className="mt-1 text-xs">
                {[
                  ...new Set([
                    ...state.validation.blockers,
                    ...state.review.blockers,
                  ]),
                ].length
                  ? `Blocked: ${[...new Set([...state.validation.blockers, ...state.review.blockers])].join(', ')}`
                  : 'No automatic blockers. Human visual approval is still required.'}
              </p>
              <label className="mt-2 block text-xs font-semibold text-[#39465b]">
                Review note
                <textarea
                  className="mt-1 min-h-14 w-full rounded border p-2 text-xs font-normal"
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
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={compactButton + ' hidden'}
                  onClick={toggleNeedsSplit}
                >
                  {state.review.blockers.includes('needs-split')
                    ? 'Clear needs split'
                    : 'Mark as needs split'}
                </button>
                <button
                  type="button"
                  className={`${compactButton} border-[#a85d4e] bg-[#a85d4e] text-white hover:bg-[#8d4c43]`}
                  onClick={() => void save(false)}
                >
                  Save
                </button>
                <button
                  type="button"
                  className={compactButton}
                  disabled={!canApprove}
                  onClick={() => void save(true)}
                >
                  Approve after visual review
                </button>
              </div>
            </Card>
          </section>
        </div>
      )}
      {error && !state && <Card className="mt-4 text-[#9d3b32]">{error}</Card>}
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
          <label className="mt-3 text-xs font-semibold text-[#39465b] hidden">
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
          <fieldset className="mt-3 text-xs text-[#39465b]">
            <legend className="font-semibold">
              Status{' '}
              <button
                type="button"
                className="ml-1 font-normal text-[#8d4c43] hover:underline"
                onClick={() => applyStatusFilter([])}
              >
                {statusFilter.length === 0 ? 'all shown' : 'show all'}
              </button>
            </legend>
            <div className="mt-1 grid grid-cols-2 gap-1">
              {reviewStatuses.map((status) => (
                <label
                  key={status}
                  className="flex items-center gap-1.5 rounded border px-2 py-1"
                >
                  <input
                    type="checkbox"
                    checked={statusFilter.includes(status)}
                    onChange={() =>
                      applyStatusFilter(
                        statusFilter.includes(status)
                          ? statusFilter.filter((item) => item !== status)
                          : [...statusFilter, status],
                      )
                    }
                  />
                  <span className="capitalize">{status}</span>
                  <span className="ml-auto text-[#667085]">
                    {statusCounts.get(status) ?? 0}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="mt-3 text-xs text-[#667085]">
            {selected ? `${index + 1} / ${filteredQueue.length}` : '0'} shown ·{' '}
            {state?.review.status ?? 'loading'}
          </p>
          <div className="mt-3 space-y-1">
            {pageItems.map((item, itemIndex) => (
              <button
                key={item.syllable}
                onClick={() => setIndex(page * QUEUE_PAGE_SIZE + itemIndex)}
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
                  {item.reviewStatus !== 'approved' && (
                    <>
                      <span
                        className={
                          item.reviewStatus === 'reviewing'
                            ? 'font-semibold text-[#c2620a]'
                            : undefined
                        }
                      >
                        {item.reviewStatus ?? 'unreviewed'}
                      </span>{' '}
                      ·{' '}
                    </>
                  )}
                  P{item.priority}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#667085]">
            <button
              className="rounded border px-2 py-1 font-semibold text-[#39465b] disabled:opacity-40"
              disabled={page === 0}
              onClick={() => setIndex((page - 1) * QUEUE_PAGE_SIZE)}
            >
              ‹ Page
            </button>
            <span>
              Page {page + 1} / {pageCount}
            </span>
            <button
              className="rounded border px-2 py-1 font-semibold text-[#39465b] disabled:opacity-40"
              disabled={page >= pageCount - 1}
              onClick={() => setIndex((page + 1) * QUEUE_PAGE_SIZE)}
            >
              Page ›
            </button>
          </div>
          <button
            className="mt-2 text-xs font-semibold text-[#8d4c43] hover:underline"
            onClick={() => applyStatusFilter(statusFilter)}
          >
            Refresh status filter
          </button>
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
                      {coverageLines.map(
                        (
                          { contour, counts, outOfRange, usesCounterStart },
                          order,
                        ) => (
                          <p className="text-xs" key={contour.id}>
                            {recipeContours.length > 1 && (
                              <span
                                aria-hidden="true"
                                className="mr-1.5 inline-block size-2.5 rounded-full align-middle"
                                style={{
                                  backgroundColor: contourColor(order).selected,
                                }}
                              />
                            )}
                            {recipeContours.length > 1
                              ? `${contourName(contour.id)} coverage: `
                              : 'Coverage: '}
                            {counts.filter((count) => count === 1).length}/
                            {counts.length} exactly once ·{' '}
                            {counts.filter((count) => count === 0).length}{' '}
                            uncovered ·{' '}
                            {counts.filter((count) => count > 1).length}{' '}
                            duplicate
                            {outOfRange > 0 && (
                              <span className="font-semibold text-[#c0362c]">
                                {' '}
                                · {outOfRange} out of range
                              </span>
                            )}
                            {usesCounterStart && (
                              <span className="font-semibold text-[#c0362c]">
                                {' '}
                                · command 0 (start) is used — counter ranges
                                must start at 1
                              </span>
                            )}
                          </p>
                        ),
                      )}
                      {enclosedCounters.length > 0 && (
                        <div className="rounded border border-dashed border-[#d8e3f2] p-2 text-xs">
                          <strong>Counters inside this contour</strong>
                          {enclosedCounters.map((counter) => (
                            <label key={counter.id} className="mt-1 block">
                              <input
                                type="checkbox"
                                checked={declaredCounters.some(
                                  ({ id }) => id === counter.id,
                                )}
                                onChange={() => toggleCounter(counter.id)}
                              />{' '}
                              Split with Contour {counter.id + 1} (
                              {counter.commands.length} commands; command 0 is
                              its start and is never consumed)
                            </label>
                          ))}
                        </div>
                      )}
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
                        ) => {
                          const nextFrom = Math.min(fromCommand, toCommand)
                          const nextTo = Math.max(fromCommand, toCommand)
                          const previousRangeIndex = piece.tokens.reduce(
                            (latestIndex, token, index) =>
                              index < tokenIndex &&
                              token.kind === 'source-range'
                                ? index
                                : latestIndex,
                            -1,
                          )
                          const edited = piece.tokens[tokenIndex]
                          const rangeContourId =
                            edited?.kind === 'source-range'
                              ? (edited.contourId ??
                                activeRecipe.sourceContourId)
                              : activeRecipe.sourceContourId
                          const tokens = piece.tokens
                            .map((token, index) =>
                              index === tokenIndex &&
                              token.kind === 'source-range'
                                ? {
                                    ...token,
                                    fromCommand: nextFrom,
                                    toCommand: nextTo,
                                  }
                                : token,
                            )
                            .filter(
                              (token, index) =>
                                !(
                                  index === previousRangeIndex + 1 &&
                                  token.kind === 'line-to-anchor'
                                ),
                            )
                          if (previousRangeIndex !== -1 && nextFrom > 0) {
                            tokens.splice(previousRangeIndex + 1, 0, {
                              kind: 'line-to-anchor',
                              anchor: {
                                contourId: rangeContourId,
                                commandIndex: nextFrom - 1,
                                point: 'end',
                              },
                              reason: 'interior-closure-seam',
                            })
                          }
                          updatePiece(activeRecipe.id, piece.id, tokens)
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
                            <div className="mt-3 grid gap-3 lg:grid-cols-2">
                              <div>
                                <CommandRangePainter
                                  glyph={state.source}
                                  contour={activeContour}
                                  counters={declaredCounters}
                                  ranges={ranges}
                                />
                                <div className="mt-2">
                                  <p className="text-xs font-semibold text-[#39465b]">
                                    Source ranges
                                  </p>
                                  <div className="mt-1 space-y-2">
                                    {piece.tokens.map((token, tokenIndex) => {
                                      if (token.kind !== 'source-range')
                                        return null
                                      const nextToken =
                                        piece.tokens[tokenIndex + 1]
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
                                      const nextRangeContourId =
                                        nextRange?.kind === 'source-range'
                                          ? (nextRange.contourId ??
                                            activeRecipe.sourceContourId)
                                          : activeRecipe.sourceContourId
                                      const suggestedAnchor =
                                        nextRange && nextRange.fromCommand > 0
                                          ? `${nextRangeContourId}:${nextRange.fromCommand - 1}`
                                          : undefined
                                      const anchorLabel = (value: string) => {
                                        const [contourId, commandIndex] = value
                                          .split(':')
                                          .map(Number)
                                        return `${recipeContours.length > 1 ? `${contourName(contourId)} · ` : ''}command ${commandIndex} end`
                                      }
                                      return (
                                        <div
                                          key={`${piece.id}-${tokenIndex}`}
                                          className="rounded border border-[#d8e3f2] p-2"
                                        >
                                          {recipeContours.length > 1 && (
                                            <label className="mb-1 flex items-center text-xs font-semibold">
                                              <span
                                                aria-hidden="true"
                                                className="mr-1.5 inline-block size-2.5 rounded-full"
                                                style={{
                                                  backgroundColor: contourColor(
                                                    Math.max(
                                                      0,
                                                      recipeContours.findIndex(
                                                        ({ id }) =>
                                                          id ===
                                                          (token.contourId ??
                                                            activeRecipe.sourceContourId),
                                                      ),
                                                    ),
                                                  ).selected,
                                                }}
                                              />
                                              Contour
                                              <select
                                                className="ml-2 rounded border p-1 font-normal"
                                                value={
                                                  token.contourId ??
                                                  activeRecipe.sourceContourId
                                                }
                                                onChange={(event) => {
                                                  const contourId = Number(
                                                    event.target.value,
                                                  )
                                                  const onSource =
                                                    contourId ===
                                                    activeRecipe.sourceContourId
                                                  updatePiece(
                                                    activeRecipe.id,
                                                    piece.id,
                                                    piece.tokens.map(
                                                      (item, index) =>
                                                        index === tokenIndex &&
                                                        item.kind ===
                                                          'source-range'
                                                          ? {
                                                              kind: 'source-range',
                                                              fromCommand:
                                                                onSource
                                                                  ? item.fromCommand
                                                                  : Math.max(
                                                                      1,
                                                                      item.fromCommand,
                                                                    ),
                                                              toCommand:
                                                                Math.max(
                                                                  onSource
                                                                    ? item.fromCommand
                                                                    : 1,
                                                                  item.toCommand,
                                                                ),
                                                              ...(onSource
                                                                ? {}
                                                                : {
                                                                    contourId,
                                                                  }),
                                                            }
                                                          : item,
                                                    ),
                                                  )
                                                }}
                                              >
                                                {recipeContours.map(
                                                  (contour) => (
                                                    <option
                                                      key={contour.id}
                                                      value={contour.id}
                                                    >
                                                      {contourName(contour.id)}
                                                    </option>
                                                  ),
                                                )}
                                              </select>
                                            </label>
                                          )}
                                          <SourceRangeEditor
                                            key={`${token.contourId ?? ''}-${token.fromCommand}-${token.toCommand}`}
                                            fromCommand={token.fromCommand}
                                            toCommand={token.toCommand}
                                            onUpdate={(
                                              fromCommand,
                                              toCommand,
                                            ) =>
                                              updateSourceRange(
                                                tokenIndex,
                                                fromCommand,
                                                toCommand,
                                              )
                                            }
                                            onRemove={() =>
                                              updatePiece(
                                                activeRecipe.id,
                                                piece.id,
                                                removeSourceRange(
                                                  piece.tokens,
                                                  tokenIndex,
                                                ),
                                              )
                                            }
                                          />
                                          {seamAfterRange ? (
                                            <div className="mt-2 flex items-center justify-between gap-2 rounded bg-[#fff8ed] p-2 text-xs">
                                              <span>
                                                Seam before next range →{' '}
                                                {anchorLabel(
                                                  `${seamAfterRange.anchor.contourId}:${seamAfterRange.anchor.commandIndex}`,
                                                )}
                                              </span>
                                              <Button
                                                variant="secondary"
                                                onClick={() =>
                                                  updatePiece(
                                                    activeRecipe.id,
                                                    piece.id,
                                                    piece.tokens.filter(
                                                      (_, index) =>
                                                        index !==
                                                        tokenIndex + 1,
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
                                                (usually{' '}
                                                {suggestedAnchor
                                                  ? anchorLabel(suggestedAnchor)
                                                  : 'command 0 end'}
                                                )
                                              </span>
                                              <select
                                                className="mt-1 w-full rounded border p-2 font-normal"
                                                defaultValue={
                                                  suggestedAnchor?.toString() ??
                                                  ''
                                                }
                                                onChange={(event) => {
                                                  if (event.target.value === '')
                                                    return
                                                  const [
                                                    contourId,
                                                    commandIndex,
                                                  ] = event.target.value
                                                    .split(':')
                                                    .map(Number)
                                                  const tokens = [
                                                    ...piece.tokens,
                                                  ]
                                                  tokens.splice(
                                                    tokenIndex + 1,
                                                    0,
                                                    {
                                                      kind: 'line-to-anchor',
                                                      anchor: {
                                                        contourId,
                                                        commandIndex,
                                                        point: 'end',
                                                      },
                                                      reason:
                                                        'interior-closure-seam',
                                                    },
                                                  )
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
                                                {suggestedAnchor !==
                                                  undefined && (
                                                  <option
                                                    value={suggestedAnchor}
                                                  >
                                                    Suggested:{' '}
                                                    {anchorLabel(
                                                      suggestedAnchor,
                                                    )}
                                                  </option>
                                                )}
                                                {recipeContours.flatMap(
                                                  (contour) =>
                                                    contour.commands.map(
                                                      (_, commandIndex) => {
                                                        const value = `${contour.id}:${commandIndex}`
                                                        return value ===
                                                          suggestedAnchor ? null : (
                                                          <option
                                                            key={value}
                                                            value={value}
                                                          >
                                                            {anchorLabel(value)}
                                                          </option>
                                                        )
                                                      },
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
                              </div>
                              <CommandRangePainter
                                glyph={state.source}
                                contour={activeContour}
                                counters={declaredCounters}
                                ranges={[]}
                                inspect
                                onAddSelectedRange={(
                                  fromCommand,
                                  toCommand,
                                  contourId,
                                ) => {
                                  const onCounter =
                                    contourId !== activeRecipe.sourceContourId
                                  // A counter's command 0 is its start M and is never consumed.
                                  const range = {
                                    kind: 'source-range' as const,
                                    fromCommand: onCounter
                                      ? Math.max(1, fromCommand)
                                      : fromCommand,
                                    toCommand: onCounter
                                      ? Math.max(1, toCommand)
                                      : toCommand,
                                    ...(contourId ===
                                    activeRecipe.sourceContourId
                                      ? {}
                                      : { contourId }),
                                  }
                                  const latestSourceRangeIndex =
                                    piece.tokens.reduce(
                                      (latestIndex, token, tokenIndex) =>
                                        token.kind === 'source-range'
                                          ? tokenIndex
                                          : latestIndex,
                                      -1,
                                    )
                                  updatePiece(
                                    activeRecipe.id,
                                    piece.id,
                                    latestSourceRangeIndex === -1
                                      ? [...piece.tokens, range]
                                      : piece.tokens.map((token, tokenIndex) =>
                                          tokenIndex === latestSourceRangeIndex
                                            ? range
                                            : token,
                                        ),
                                  )
                                }}
                                onAddNewRange={(
                                  fromCommand,
                                  toCommand,
                                  contourId,
                                ) =>
                                  updatePiece(activeRecipe.id, piece.id, [
                                    ...piece.tokens,
                                    {
                                      kind: 'source-range',
                                      fromCommand:
                                        contourId ===
                                        activeRecipe.sourceContourId
                                          ? fromCommand
                                          : Math.max(1, fromCommand),
                                      toCommand:
                                        contourId ===
                                        activeRecipe.sourceContourId
                                          ? toCommand
                                          : Math.max(1, toCommand),
                                      ...(contourId ===
                                      activeRecipe.sourceContourId
                                        ? {}
                                        : { contourId }),
                                    },
                                  ])
                                }
                              />
                            </div>
                            <div className="mt-2 flex-wrap gap-2 hidden">
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
                                    ? `${token.contourId === undefined ? '' : `C${token.contourId + 1} `}${token.fromCommand}–${token.toCommand}`
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
          </main>
        )}
      </section>
    </PageSurface>
  )
}
