import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import { buildExpectedKeys } from '../../domain/korean/target-sequence'
import {
  renderGuideInspection,
  waitForHangulFont,
  type GuideDiagnostics,
  type GuideInspectionMode,
} from './DecomposedHangulTarget'
import {
  SYLLABLE_GUIDES,
  type GuideMode,
  type GuideOperation,
  type GuideShape,
  type SyllableGuide,
} from './hangul-segmentation-guides'

const TUNABLE_SYLLABLES = ['녕', '하', '죄'] as const
const INSPECTION_VIEWS: Array<{ mode: GuideInspectionMode; label: string }> = [
  { mode: 'original', label: 'Original glyph' },
  { mode: 'colored', label: 'Colored result' },
  { mode: 'ownership', label: 'Ownership by step' },
  { mode: 'unassigned', label: 'Unassigned pixels' },
  { mode: 'overlap', label: 'Overlapping pixels' },
  { mode: 'fallback', label: 'Nearest-center fallback' },
]

function copyGuide(guide: SyllableGuide): SyllableGuide {
  return JSON.parse(JSON.stringify(guide)) as SyllableGuide
}

function percent(value: number, total: number) {
  return total === 0 ? '0.0%' : `${((value / total) * 100).toFixed(1)}%`
}

function GuideCanvas({
  glyph,
  guide,
  expectedKeys,
  keyIndex,
  mode,
  onDiagnostics,
}: {
  glyph: string
  guide: SyllableGuide
  expectedKeys: ReturnType<typeof buildExpectedKeys>
  keyIndex: number
  mode: GuideInspectionMode
  onDiagnostics?: (diagnostics: GuideDiagnostics | null) => void
}) {
  const [imageUrl, setImageUrl] = useState('')

  useEffect(() => {
    let cancelled = false
    void waitForHangulFont(glyph).then(() => {
      if (cancelled) return
      const canvas = document.createElement('canvas')
      const diagnostics = renderGuideInspection(
        canvas,
        glyph,
        expectedKeys,
        keyIndex,
        guide,
        mode,
      )
      if (cancelled) return
      setImageUrl(canvas.toDataURL())
      onDiagnostics?.(diagnostics)
    })
    return () => {
      cancelled = true
    }
  }, [expectedKeys, glyph, guide, keyIndex, mode, onDiagnostics])

  return (
    <img
      src={imageUrl}
      className="h-26 w-26 rounded-md border border-[#bfd7fb] bg-[#fafcff]"
      aria-label={`${glyph} ${mode} inspection`}
    />
  )
}

function OperationEditor({
  operation,
  onChange,
  onRemove,
}: {
  operation: GuideOperation
  onChange: (next: GuideOperation) => void
  onRemove: () => void
}) {
  const updateNumber = (field: 'x' | 'y' | 'w' | 'h', value: string) => {
    const parsed = Number(value)
    onChange({
      ...operation,
      normRect: {
        ...operation.normRect,
        [field]: Number.isFinite(parsed) ? parsed : 0,
      },
    })
  }

  return (
    <div className="rounded-lg border border-[#eadfd4] bg-white p-3">
      <div className="flex flex-wrap gap-2">
        <label className="text-xs font-semibold text-[#667085]">
          Mode
          <select
            className="mt-1 block rounded border border-[#d8e3f2] bg-white px-2 py-1 text-sm text-[#39465b]"
            value={operation.mode}
            onChange={(event) =>
              onChange({ ...operation, mode: event.target.value as GuideMode })
            }
          >
            <option value="add">Add</option>
            <option value="subtract">Subtract</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-[#667085]">
          Shape
          <select
            className="mt-1 block rounded border border-[#d8e3f2] bg-white px-2 py-1 text-sm text-[#39465b]"
            value={operation.shape}
            onChange={(event) =>
              onChange({ ...operation, shape: event.target.value as GuideShape })
            }
          >
            <option value="rect">Rectangle</option>
            <option value="ellipse">Ellipse</option>
          </select>
        </label>
        <Button variant="ghost" className="self-end px-2 py-1" onClick={onRemove}>
          Remove
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {(['x', 'y', 'w', 'h'] as const).map((field) => (
          <label key={field} className="text-xs font-semibold text-[#667085]">
            {field.toUpperCase()}
            <input
              type="number"
              step="0.01"
              value={operation.normRect[field]}
              onChange={(event) => updateNumber(field, event.target.value)}
              className="mt-1 block w-full rounded border border-[#d8e3f2] px-2 py-1 text-sm text-[#39465b]"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

export default function HangulGuideTunerPage() {
  const [glyph, setGlyph] = useState<(typeof TUNABLE_SYLLABLES)[number]>('녕')
  const [guide, setGuide] = useState(() => copyGuide(SYLLABLE_GUIDES.녕))
  const [keyIndex, setKeyIndex] = useState(0)
  const [diagnostics, setDiagnostics] = useState<GuideDiagnostics | null>(null)
  const expectedKeys = useMemo(() => buildExpectedKeys(glyph), [glyph])

  const selectGlyph = (nextGlyph: (typeof TUNABLE_SYLLABLES)[number]) => {
    setGlyph(nextGlyph)
    setGuide(copyGuide(SYLLABLE_GUIDES[nextGlyph]))
    setKeyIndex(0)
    setDiagnostics(null)
  }

  const replaceOperation = (
    stepIndex: number,
    operationIndex: number,
    next: GuideOperation,
  ) => {
    setGuide((current) => ({
      steps: current.steps.map((step, index) =>
        index !== stepIndex
          ? step
          : {
              ...step,
              ops: step.ops.map((operation, opIndex) =>
                opIndex === operationIndex ? next : operation,
              ),
            },
      ),
    }))
  }

  const removeOperation = (stepIndex: number, operationIndex: number) => {
    setGuide((current) => ({
      steps: current.steps.map((step, index) =>
        index !== stepIndex
          ? step
          : { ...step, ops: step.ops.filter((_, opIndex) => opIndex !== operationIndex) },
      ),
    }))
  }

  const addOperation = (stepIndex: number, mode: GuideMode, shape: GuideShape) => {
    setGuide((current) => ({
      steps: current.steps.map((step, index) =>
        index !== stepIndex
          ? step
          : {
              ...step,
              ops: [
                ...step.ops,
                { mode, shape, normRect: { x: 0.25, y: 0.25, w: 0.25, h: 0.25 } },
              ],
            },
      ),
    }))
  }

  const reportDiagnostics = useCallback((next: GuideDiagnostics | null) => {
    setDiagnostics(next)
  }, [])

  const copyJson = async () => {
    await navigator.clipboard.writeText(JSON.stringify({ [glyph]: guide }, null, 2))
  }

  return (
    <PageSurface contentClassName="max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-[#a85d4e]">Development only</p>
          <h1 className="mt-1 text-3xl font-bold text-[#39465b]">Hangul guide tuner</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#667085]">
            Edit normalized guide operations and inspect the exact pixel ownership used by the learner renderer.
          </p>
        </div>
        <Link className="text-sm font-semibold text-[#8d4c43] hover:underline" to="/">
          Back to learner
        </Link>
      </header>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[#39465b]">Syllable</span>
          {TUNABLE_SYLLABLES.map((candidate) => (
            <Button
              key={candidate}
              variant={candidate === glyph ? 'primary' : 'secondary'}
              onClick={() => selectGlyph(candidate)}
            >
              {candidate}
            </Button>
          ))}
          <label className="ml-auto text-sm font-semibold text-[#39465b]">
            Typing step {keyIndex + 1} / {expectedKeys.length + 1}
            <input
              className="ml-3 align-middle"
              type="range"
              min="0"
              max={expectedKeys.length}
              value={keyIndex}
              onChange={(event) => setKeyIndex(Number(event.target.value))}
            />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {INSPECTION_VIEWS.map(({ mode, label }) => (
            <figure key={mode} className="flex flex-col items-center gap-2">
              <GuideCanvas
                glyph={glyph}
                guide={guide}
                expectedKeys={expectedKeys}
                keyIndex={keyIndex}
                mode={mode}
                onDiagnostics={mode === 'colored' ? reportDiagnostics : undefined}
              />
              <figcaption className="text-center text-xs font-semibold text-[#667085]">{label}</figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-4 text-xs text-[#667085]">
          Ownership colors identify typing steps. Red pixels identify the relevant exception in each diagnostic view.
        </p>
      </Card>

      <Card className="mt-4">
        <h2 className="text-lg font-bold text-[#39465b]">Pixel diagnostics</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ['Ink pixels', diagnostics?.inkPixels ?? 0, ''],
            ['Unassigned', diagnostics?.unassignedPixels ?? 0, percent(diagnostics?.unassignedPixels ?? 0, diagnostics?.inkPixels ?? 0)],
            ['Overlapping', diagnostics?.overlappingPixels ?? 0, percent(diagnostics?.overlappingPixels ?? 0, diagnostics?.inkPixels ?? 0)],
            ['Fallback', diagnostics?.fallbackPixels ?? 0, percent(diagnostics?.fallbackPixels ?? 0, diagnostics?.inkPixels ?? 0)],
          ].map(([label, count, share]) => (
            <div key={label as string} className="rounded-lg bg-[#f7f8fb] p-3">
              <p className="text-xs font-semibold uppercase text-[#667085]">{label}</p>
              <p className="mt-1 text-lg font-bold text-[#39465b]">{count} {share && <span className="text-sm font-medium">({share})</span>}</p>
            </div>
          ))}
        </div>
      </Card>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1fr_19rem]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#39465b]">Guide operations</h2>
              <p className="mt-1 text-sm text-[#667085]">All coordinates are normalized to the glyph ink bounds.</p>
            </div>
            <Button variant="secondary" onClick={() => setGuide(copyGuide(SYLLABLE_GUIDES[glyph]))}>Reset guide</Button>
          </div>
          <div className="mt-4 space-y-4">
            {guide.steps.map((step, stepIndex) => (
              <section key={`${step.order}-${step.key}`} className="rounded-xl border border-[#d8e3f2] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-[#39465b]">Step {step.order + 1}: {step.key}</h3>
                  <div className="flex flex-wrap gap-1">
                    <Button variant="ghost" className="px-2 py-1" onClick={() => addOperation(stepIndex, 'add', 'rect')}>Add rect</Button>
                    <Button variant="ghost" className="px-2 py-1" onClick={() => addOperation(stepIndex, 'add', 'ellipse')}>Add ellipse</Button>
                    <Button variant="ghost" className="px-2 py-1" onClick={() => addOperation(stepIndex, 'subtract', 'rect')}>Subtract rect</Button>
                    <Button variant="ghost" className="px-2 py-1" onClick={() => addOperation(stepIndex, 'subtract', 'ellipse')}>Subtract ellipse</Button>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {step.ops.map((operation, operationIndex) => (
                    <OperationEditor
                      key={operationIndex}
                      operation={operation}
                      onChange={(next) => replaceOperation(stepIndex, operationIndex, next)}
                      onRemove={() => removeOperation(stepIndex, operationIndex)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Card>
        <Card className="h-fit">
          <h2 className="text-lg font-bold text-[#39465b]">Export</h2>
          <p className="mt-2 text-sm text-[#667085]">Copy the tuned guide to place into the guide dataset after visual review.</p>
          <Button className="mt-4 w-full" onClick={() => void copyJson()}>Copy guide JSON</Button>
          <pre className="mt-4 max-h-96 overflow-auto rounded-lg bg-[#1f2937] p-3 text-xs text-[#f8fafc]">{JSON.stringify({ [glyph]: guide }, null, 2)}</pre>
        </Card>
      </section>
    </PageSurface>
  )
}
