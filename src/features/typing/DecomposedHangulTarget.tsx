import { useEffect, useRef } from 'react'
import type { ExpectedKey } from '../../domain/korean/target-sequence'
import type { TypingSessionState } from '../../domain/korean/typing-session'

interface DecomposedHangulTargetProps {
  session: TypingSessionState
  className?: string
}

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

type PositionedKey = ExpectedKey & { index: number }

const TILE_SIZE = 104
const HORIZONTAL_VOWELS = new Set(['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ'])
const COLORS = {
  correct: '#20b981',
  current: '#e990b6',
  pending: '#c7c3bc',
}

function colorFor(index: number, keyIndex: number) {
  if (index < keyIndex) return COLORS.correct
  if (index === keyIndex) return COLORS.current
  return COLORS.pending
}

function setFont(context: CanvasRenderingContext2D, size: number) {
  context.font = `700 ${size}px "Noto Sans KR", "Apple SD Gothic Neo", sans-serif`
}

function fitGlyph(context: CanvasRenderingContext2D, glyph: string, rect: Rect) {
  let size = Math.min(rect.width, rect.height) * 1.25
  setFont(context, size)
  let metrics = context.measureText(glyph)
  let width = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight || metrics.width
  let height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || size
  const scale = Math.min(1, (rect.width - 8) / width, (rect.height - 8) / height)

  size *= scale
  setFont(context, size)
  metrics = context.measureText(glyph)

  return {
    x: rect.x + rect.width / 2 - (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) / 2,
    y: rect.y + rect.height / 2 - (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) / 2,
  }
}

function setRects(
  result: Map<number, Rect>,
  keys: PositionedKey[],
  rect: Rect,
) {
  keys.forEach((key, index) => {
    result.set(key.index, {
      x: rect.x + rect.width / keys.length * index,
      y: rect.y,
      width: rect.width / keys.length,
      height: rect.height,
    })
  })
}

function getJamoRegions(keys: PositionedKey[]) {
  const regions = new Map<number, Rect>()
  const choseong = keys.filter((key) => key.slot === 'choseong')
  const jungseong = keys.filter((key) => key.slot === 'jungseong')
  const jongseong = keys.filter((key) => key.slot === 'jongseong')
  const content: Rect = { x: 10, y: 10, width: 84, height: 84 }

  if (keys[0]?.slot === 'literal') {
    setRects(regions, keys, content)
    return regions
  }

  const finalHeight = jongseong.length > 0 ? 24 : 0
  const body: Rect = { ...content, height: content.height - finalHeight }
  const horizontal = jungseong.filter((key) => HORIZONTAL_VOWELS.has(key.jamo))
  const vertical = jungseong.filter((key) => !HORIZONTAL_VOWELS.has(key.jamo))

  if (horizontal.length > 0) {
    setRects(regions, choseong, {
      x: body.x,
      y: body.y,
      width: body.width,
      height: body.height * 0.48,
    })
    const vowelRow: Rect = {
      x: body.x,
      y: body.y + body.height * 0.48,
      width: body.width,
      height: body.height * 0.52,
    }
    const horizontalWidth = vertical.length > 0 ? vowelRow.width * 0.58 : vowelRow.width
    setRects(regions, horizontal, { ...vowelRow, width: horizontalWidth })
    setRects(regions, vertical, {
      x: vowelRow.x + horizontalWidth,
      y: vowelRow.y,
      width: vowelRow.width - horizontalWidth,
      height: vowelRow.height,
    })
  } else {
    const initialWidth = body.width * 0.52
    setRects(regions, choseong, {
      x: body.x,
      y: body.y,
      width: initialWidth,
      height: body.height,
    })
    setRects(regions, jungseong, {
      x: body.x + initialWidth,
      y: body.y,
      width: body.width - initialWidth,
      height: body.height,
    })
  }

  setRects(regions, jongseong, {
    x: content.x,
    y: content.y + content.height - finalHeight,
    width: content.width,
    height: finalHeight,
  })

  return regions
}

function drawSyllable(
  canvas: HTMLCanvasElement,
  glyph: string,
  keys: PositionedKey[],
  keyIndex: number,
) {
  const ratio = window.devicePixelRatio || 1
  canvas.width = TILE_SIZE * ratio
  canvas.height = TILE_SIZE * ratio
  const context = canvas.getContext('2d')
  if (!context) return

  context.scale(ratio, ratio)
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'

  const content: Rect = { x: 10, y: 10, width: 84, height: 84 }
  const placement = fitGlyph(context, glyph, content)
  const paint = (color: string) => {
    context.fillStyle = color
    context.fillText(glyph, placement.x, placement.y)
  }

  // The precomposed glyph supplies the font's real contextual geometry. Each
  // semantic jamo region then repaints only its part of that glyph in-state.
  paint(COLORS.pending)
  const regions = getJamoRegions(keys)
  keys.forEach((key) => {
    const region = regions.get(key.index)
    if (!region || colorFor(key.index, keyIndex) === COLORS.pending) return
    context.save()
    context.beginPath()
    context.rect(region.x, region.y, region.width, region.height)
    context.clip()
    paint(colorFor(key.index, keyIndex))
    context.restore()
  })
}

function SyllableCanvas({
  glyph,
  keys,
  keyIndex,
}: {
  glyph: string
  keys: PositionedKey[]
  keyIndex: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (canvasRef.current) drawSyllable(canvasRef.current, glyph, keys, keyIndex)
  }, [glyph, keys, keyIndex])

  return (
    <canvas
      ref={canvasRef}
      width={TILE_SIZE}
      height={TILE_SIZE}
      className="h-[104px] w-[104px] rounded-md border border-[#bfd7fb] bg-[#fafcff]"
      aria-hidden="true"
    />
  )
}

/** Uses the precomposed syllable as font geometry and clips color by jamo role. */
export default function DecomposedHangulTarget({
  session,
  className = '',
}: DecomposedHangulTargetProps) {
  const syllables = new Map<number, PositionedKey[]>()
  const characters = Array.from(session.targetText)

  session.expectedKeys.forEach((key, index) => {
    const syllable = syllables.get(key.syllableIndex) ?? []
    syllable.push({ ...key, index })
    syllables.set(key.syllableIndex, syllable)
  })

  return (
    <div
      className={`flex flex-wrap justify-center gap-2 ${className}`}
      aria-label={session.targetText}
      role="img"
    >
      {[...syllables.entries()].map(([syllableIndex, keys]) => (
        <SyllableCanvas
          key={syllableIndex}
          glyph={characters[syllableIndex] ?? ''}
          keys={keys}
          keyIndex={session.keyIndex}
        />
      ))}
    </div>
  )
}
