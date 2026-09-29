/* eslint-disable react-refresh/only-export-components */
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
export type GuideShape = 'rect' | 'ellipse'
export type GuideMode = 'add' | 'subtract'

export interface GuideOperation {
  mode: GuideMode
  shape: GuideShape
  normRect: { x: number; y: number; w: number; h: number }
}

export interface SyllableGuide {
  steps: Array<{ order: number; key: string; ops: GuideOperation[] }>
}

export interface GuideDiagnostics {
  inkPixels: number
  unassignedPixels: number
  overlappingPixels: number
  fallbackPixels: number
}

export type GuideInspectionMode =
  | 'original'
  | 'colored'
  | 'ownership'
  | 'unassigned'
  | 'overlap'
  | 'fallback'

const TILE_SIZE = 104
const HORIZONTAL_VOWELS = new Set(['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ'])
const COLORS = {
  correct: '#20b981',
  current: '#e990b6',
  pending: '#c7c3bc',
}
const COLOR_CHANNELS = {
  correct: [32, 185, 129],
  current: [233, 144, 182],
  pending: [199, 195, 188],
}

const rect = (x: number, y: number, w: number, h: number): GuideOperation => ({
  mode: 'add',
  shape: 'rect',
  normRect: { x, y, w, h },
})

function guide(keys: string[], regions: Rect[]): SyllableGuide {
  return {
    steps: keys.map((key, order) => ({
      order,
      key,
      ops: [
        rect(
          regions[order].x,
          regions[order].y,
          regions[order].width,
          regions[order].height,
        ),
      ],
    })),
  }
}

const VERTICAL = [
  { x: 0, y: 0, width: 0.56, height: 1 },
  { x: 0.44, y: 0, width: 0.56, height: 1 },
]
const VERTICAL_FINAL = [
  { x: 0, y: 0, width: 0.56, height: 0.7 },
  { x: 0.44, y: 0, width: 0.56, height: 0.7 },
  { x: 0.05, y: 0.62, width: 0.9, height: 0.38 },
]
const HORIZONTAL = [
  { x: 0, y: 0, width: 1, height: 0.54 },
  { x: 0, y: 0.42, width: 1, height: 0.58 },
]
const HORIZONTAL_FINAL = [
  { x: 0, y: 0, width: 1, height: 0.4 },
  { x: 0, y: 0.32, width: 1, height: 0.42 },
  { x: 0.05, y: 0.65, width: 0.9, height: 0.35 },
]
// Temporary seed-guide set: only syllables currently present in sample lesson/review content.
export const SYLLABLE_GUIDES: Record<string, SyllableGuide> = {
  안: guide(['ㅇ', 'ㅏ', 'ㄴ'], VERTICAL_FINAL),
  녕: guide(['ㄴ', 'ㅕ', 'ㅇ'], [
    { x: 0, y: 0, width: 0.58, height: 0.62 },
    { x: 0.58, y: 0, width: 0.42, height: 0.62 },
    { x: 0, y: 0.62, width: 1, height: 0.38 },
  ]),
  하: guide(['ㅎ', 'ㅏ'], [
    { x: 0, y: 0, width: 0.62, height: 1 },
    { x: 0.62, y: 0, width: 0.38, height: 1 },
  ]),
  세: guide(['ㅅ', 'ㅔ'], VERTICAL),
  요: guide(['ㅇ', 'ㅛ'], HORIZONTAL),
  감: guide(['ㄱ', 'ㅏ', 'ㅁ'], VERTICAL_FINAL),
  사: guide(['ㅅ', 'ㅏ'], VERTICAL),
  합: guide(['ㅎ', 'ㅏ', 'ㅂ'], VERTICAL_FINAL),
  니: guide(['ㄴ', 'ㅣ'], VERTICAL),
  다: guide(['ㄷ', 'ㅏ'], VERTICAL),
  죄: guide(['ㅈ', 'ㅗ', 'ㅣ'], [
    { x: 0, y: 0, width: 1, height: 0.38 },
    { x: 0, y: 0.38, width: 0.6, height: 0.62 },
    { x: 0.6, y: 0.38, width: 0.4, height: 0.62 },
  ]),
  송: guide(['ㅅ', 'ㅗ', 'ㅇ'], HORIZONTAL_FINAL),
  랑: guide(['ㄹ', 'ㅏ', 'ㅇ'], VERTICAL_FINAL),
  친: guide(['ㅊ', 'ㅣ', 'ㄴ'], VERTICAL_FINAL),
  구: guide(['ㄱ', 'ㅜ'], HORIZONTAL),
  학: guide(['ㅎ', 'ㅏ', 'ㄱ'], VERTICAL_FINAL),
  교: guide(['ㄱ', 'ㅛ'], HORIZONTAL),
}

function colorFor(index: number, keyIndex: number) {
  if (index < keyIndex) return 'correct'
  if (index === keyIndex) return 'current'
  return 'pending'
}

const HANGUL_FONT = '"Noto Sans KR"'

function setFont(context: CanvasRenderingContext2D, size: number) {
  context.font = `700 ${size}px ${HANGUL_FONT}`
}

export function waitForHangulFont(text: string) {
  if (typeof document === 'undefined' || !document.fonts) return Promise.resolve()
  return document.fonts
    .load(`700 ${TILE_SIZE}px ${HANGUL_FONT}`, text)
    .then(() => undefined)
}

function fitGlyph(
  context: CanvasRenderingContext2D,
  glyph: string,
  rect: Rect,
  pixelScale: number,
) {
  let size = Math.min(rect.width, rect.height) * 1.25
  setFont(context, size)
  let metrics = context.measureText(glyph)
  const width =
    metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight ||
    metrics.width
  const height =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent || size
  size *= Math.min(1, (rect.width - 8) / width, (rect.height - 8) / height)
  setFont(context, size)
  metrics = context.measureText(glyph)

  return {
    x:
      Math.round(
        (rect.x +
          rect.width / 2 -
          (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) /
            2) *
          pixelScale,
      ) / pixelScale,
    y:
      Math.round(
        (rect.y +
          rect.height / 2 -
          (metrics.actualBoundingBoxDescent - metrics.actualBoundingBoxAscent) /
            2) *
          pixelScale,
      ) / pixelScale,
  }
}

function contains(operation: GuideOperation, x: number, y: number) {
  const { x: ox, y: oy, w, h } = operation.normRect
  if (operation.shape === 'rect')
    return x >= ox && x <= ox + w && y >= oy && y <= oy + h
  const dx = (x - (ox + w / 2)) / (w / 2)
  const dy = (y - (oy + h / 2)) / (h / 2)
  return dx * dx + dy * dy <= 1
}

function stepOwnsPixel(
  step: SyllableGuide['steps'][number],
  x: number,
  y: number,
) {
  const added = step.ops.some(
    (operation) => operation.mode === 'add' && contains(operation, x, y),
  )
  const subtracted = step.ops.some(
    (operation) => operation.mode === 'subtract' && contains(operation, x, y),
  )
  return added && !subtracted
}

function stepCenter(step: SyllableGuide['steps'][number]) {
  const additions = step.ops.filter((operation) => operation.mode === 'add')
  const totalArea = additions.reduce(
    (sum, operation) => sum + operation.normRect.w * operation.normRect.h,
    0,
  )
  return additions.reduce(
    (center, operation) => {
      const area = operation.normRect.w * operation.normRect.h
      return {
        x:
          center.x +
          ((operation.normRect.x + operation.normRect.w / 2) * area) /
            totalArea,
        y:
          center.y +
          ((operation.normRect.y + operation.normRect.h / 2) * area) /
            totalArea,
      }
    },
    { x: 0, y: 0 },
  )
}

function guidePixelOwnership(guide: SyllableGuide, x: number, y: number) {
  const owners = guide.steps.filter((step) => stepOwnsPixel(step, x, y))
  const candidates = owners.length > 0 ? owners : guide.steps
  const step = candidates.reduce((nearest, candidate) => {
    const stepPoint = stepCenter(candidate)
    const nearestPoint = stepCenter(nearest)
    const distance = (stepPoint.x - x) ** 2 + (stepPoint.y - y) ** 2
    const nearestDistance =
      (nearestPoint.x - x) ** 2 + (nearestPoint.y - y) ** 2
    return distance < nearestDistance ? candidate : nearest
  })
  return { step, ownerCount: owners.length, usedFallback: owners.length === 0 }
}

function inkBounds(pixels: Uint8ClampedArray, width: number, height: number) {
  let left = width
  let top = height
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] === 0) continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }
  return right < left
    ? null
    : { left, top, width: right - left + 1, height: bottom - top + 1 }
}

function setRects(
  result: Map<number, Rect>,
  keys: PositionedKey[],
  rect: Rect,
) {
  keys.forEach((key, index) => {
    result.set(key.index, {
      x: rect.x + (rect.width / keys.length) * index,
      y: rect.y,
      width: rect.width / keys.length,
      height: rect.height,
    })
  })
}

function getFallbackRegions(keys: PositionedKey[]) {
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
    const vowelRow = {
      x: body.x,
      y: body.y + body.height * 0.48,
      width: body.width,
      height: body.height * 0.52,
    }
    const horizontalWidth =
      vertical.length > 0 ? vowelRow.width * 0.58 : vowelRow.width
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

function guideMatches(guide: SyllableGuide | undefined, keys: PositionedKey[]) {
  return (
    guide?.steps.length === keys.length &&
    guide.steps.every(
      (step, index) => step.order === index && step.key === keys[index].jamo,
    )
  )
}

const OWNERSHIP_CHANNELS = [
  [37, 99, 235],
  [16, 185, 129],
  [245, 158, 11],
  [168, 85, 247],
  [236, 72, 153],
]
const DIAGNOSTIC_CHANNELS = {
  active: [220, 38, 38],
  inactive: [226, 232, 240],
}

function drawGuideRaster(
  context: CanvasRenderingContext2D,
  glyph: string,
  keys: PositionedKey[],
  keyIndex: number,
  backingSize: number,
  pixelScale: number,
  placement: { x: number; y: number },
  guide: SyllableGuide,
  mode: GuideInspectionMode,
): GuideDiagnostics | null {
  const source = document.createElement('canvas')
  source.width = backingSize
  source.height = backingSize
  const sourceContext = source.getContext('2d')
  if (!sourceContext) return null
  sourceContext.setTransform(pixelScale, 0, 0, pixelScale, 0, 0)
  sourceContext.textAlign = 'left'
  sourceContext.textBaseline = 'alphabetic'
  sourceContext.font = context.font
  sourceContext.fillStyle = '#39465b'
  sourceContext.fillText(glyph, placement.x, placement.y)

  const sourcePixels = sourceContext.getImageData(
    0,
    0,
    backingSize,
    backingSize,
  )
  const bounds = inkBounds(sourcePixels.data, backingSize, backingSize)
  if (!bounds) return null
  const output = context.createImageData(backingSize, backingSize)
  const diagnostics: GuideDiagnostics = {
    inkPixels: 0,
    unassignedPixels: 0,
    overlappingPixels: 0,
    fallbackPixels: 0,
  }
  for (let y = bounds.top; y < bounds.top + bounds.height; y += 1) {
    for (let x = bounds.left; x < bounds.left + bounds.width; x += 1) {
      const offset = (y * backingSize + x) * 4
      const alpha = sourcePixels.data[offset + 3]
      if (alpha === 0) continue
      diagnostics.inkPixels += 1
      const ownership = guidePixelOwnership(
        guide,
        (x - bounds.left) / bounds.width,
        (y - bounds.top) / bounds.height,
      )
      if (ownership.ownerCount === 0) diagnostics.unassignedPixels += 1
      if (ownership.ownerCount > 1) diagnostics.overlappingPixels += 1
      if (ownership.usedFallback) diagnostics.fallbackPixels += 1

      let channels: number[]
      if (mode === 'original') {
        channels = [
          sourcePixels.data[offset],
          sourcePixels.data[offset + 1],
          sourcePixels.data[offset + 2],
        ]
      } else if (mode === 'colored') {
        channels = COLOR_CHANNELS[colorFor(keys[ownership.step.order].index, keyIndex)]
      } else if (mode === 'ownership') {
        channels =
          ownership.ownerCount > 1
            ? DIAGNOSTIC_CHANNELS.active
            : OWNERSHIP_CHANNELS[ownership.step.order % OWNERSHIP_CHANNELS.length]
      } else if (mode === 'unassigned') {
        channels =
          ownership.ownerCount === 0
            ? DIAGNOSTIC_CHANNELS.active
            : DIAGNOSTIC_CHANNELS.inactive
      } else if (mode === 'overlap') {
        channels =
          ownership.ownerCount > 1
            ? DIAGNOSTIC_CHANNELS.active
            : DIAGNOSTIC_CHANNELS.inactive
      } else {
        channels = ownership.usedFallback
          ? DIAGNOSTIC_CHANNELS.active
          : DIAGNOSTIC_CHANNELS.inactive
      }
      output.data[offset] = channels[0]
      output.data[offset + 1] = channels[1]
      output.data[offset + 2] = channels[2]
      output.data[offset + 3] = alpha
    }
  }
  context.putImageData(output, 0, 0)
  return diagnostics
}

function drawWithGuide(
  context: CanvasRenderingContext2D,
  glyph: string,
  keys: PositionedKey[],
  keyIndex: number,
  backingSize: number,
  pixelScale: number,
  placement: { x: number; y: number },
  guide: SyllableGuide,
) {
  return Boolean(
    drawGuideRaster(
      context,
      glyph,
      keys,
      keyIndex,
      backingSize,
      pixelScale,
      placement,
      guide,
      'colored',
    ),
  )
}

function drawFallback(
  context: CanvasRenderingContext2D,
  glyph: string,
  keys: PositionedKey[],
  keyIndex: number,
  placement: { x: number; y: number },
) {
  const paint = (color: keyof typeof COLORS) => {
    context.fillStyle = COLORS[color]
    context.fillText(glyph, placement.x, placement.y)
  }
  paint('pending')
  const regions = getFallbackRegions(keys)
  keys.forEach((key) => {
    const region = regions.get(key.index)
    const color = colorFor(key.index, keyIndex)
    if (!region || color === 'pending') return
    context.save()
    context.beginPath()
    context.rect(region.x, region.y, region.width, region.height)
    context.clip()
    paint(color)
    context.restore()
  })
}

function drawSyllable(
  canvas: HTMLCanvasElement,
  glyph: string,
  keys: PositionedKey[],
  keyIndex: number,
) {
  const ratio = window.devicePixelRatio || 1
  const backingSize = Math.round(TILE_SIZE * ratio)
  const pixelScale = backingSize / TILE_SIZE
  canvas.width = backingSize
  canvas.height = backingSize
  const context = canvas.getContext('2d')
  if (!context) return
  context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0)
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'

  const content: Rect = { x: 10, y: 10, width: 84, height: 84 }
  const placement = fitGlyph(context, glyph, content, pixelScale)
  const guide = SYLLABLE_GUIDES[glyph]
  if (
    guideMatches(guide, keys) &&
    drawWithGuide(
      context,
      glyph,
      keys,
      keyIndex,
      backingSize,
      pixelScale,
      placement,
      guide,
    )
  )
    return
  drawFallback(context, glyph, keys, keyIndex, placement)
}

/** Draws one inspection view with the same glyph, guide, and pixel assignment path as the learner target. */
export function renderGuideInspection(
  canvas: HTMLCanvasElement,
  glyph: string,
  expectedKeys: ExpectedKey[],
  keyIndex: number,
  guide: SyllableGuide,
  mode: GuideInspectionMode,
): GuideDiagnostics | null {
  const ratio = window.devicePixelRatio || 1
  const backingSize = Math.round(TILE_SIZE * ratio)
  const pixelScale = backingSize / TILE_SIZE
  canvas.width = backingSize
  canvas.height = backingSize
  const context = canvas.getContext('2d')
  if (!context) return null
  context.setTransform(pixelScale, 0, 0, pixelScale, 0, 0)
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  const content: Rect = { x: 10, y: 10, width: 84, height: 84 }
  const placement = fitGlyph(context, glyph, content, pixelScale)
  return drawGuideRaster(
    context,
    glyph,
    expectedKeys.map((key, index) => ({ ...key, index })),
    keyIndex,
    backingSize,
    pixelScale,
    placement,
    guide,
    mode,
  )
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
    let cancelled = false
    void waitForHangulFont(glyph).then(() => {
      if (!cancelled && canvasRef.current)
        drawSyllable(canvasRef.current, glyph, keys, keyIndex)
    })
    return () => {
      cancelled = true
    }
  }, [glyph, keys, keyIndex])

  return (
    <canvas
      ref={canvasRef}
      width={TILE_SIZE}
      height={TILE_SIZE}
      className="h-26 w-26 rounded-md border border-[#bfd7fb] bg-[#fafcff]"
      aria-hidden="true"
    />
  )
}

/** Renders a precomposed glyph, then assigns its ink pixels to guided typing steps. */
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
