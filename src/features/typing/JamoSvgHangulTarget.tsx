import type { ReactNode } from 'react'
import type { RuntimeJamoSvgGlyph } from '../../domain/korean/jamo-svg-runtime'
import type { TypingSessionState } from '../../domain/korean/typing-session'
import {
  HANGUL_TARGET_SIZES,
  segmentTargetWords,
  type HangulTargetSize,
} from './hangul-target-layout'

const COLORS = {
  correct: '#20b981',
  current: '#c84f82',
  pending: '#c7c3bc',
}
const TILE_LOOK =
  'rounded-md border border-[#f0eaff] bg-[#f9f8ff] shadow-[0_0_24px_-16px_rgba(87,65,45,0.35)]'

const tileClass = (size: HangulTargetSize) =>
  `${HANGUL_TARGET_SIZES[size].tile} ${TILE_LOOK}`

const spaceClass = (size: HangulTargetSize) =>
  `flex items-end ${HANGUL_TARGET_SIZES[size].space}`

/** Lays tiles out so lines wrap only between words. */
export function TargetWords<T>({
  items,
  isSpace,
  size,
  renderTile,
}: {
  items: T[]
  isSpace: (item: T) => boolean
  size: HangulTargetSize
  renderTile: (item: T) => ReactNode
}) {
  const { gap } = HANGUL_TARGET_SIZES[size]
  return segmentTargetWords(items, isSpace).map((segment, index) =>
    segment.kind === 'space' ? (
      renderTile(segment.item)
    ) : (
      // A word too long for a line on its own still wraps inside itself.
      <span
        key={`word-${index}`}
        className={`flex flex-wrap justify-center ${gap}`}
      >
        {segment.items.map(renderTile)}
      </span>
    ),
  )
}

function stateFor(index: number, keyIndex: number) {
  if (index < keyIndex) return 'correct'
  if (index === keyIndex) return 'current'
  return 'pending'
}

function fillFor(index: number, keyIndex: number) {
  return COLORS[stateFor(index, keyIndex)]
}

interface JamoSvgHangulTargetProps {
  session: TypingSessionState
  glyphs: Map<string, RuntimeJamoSvgGlyph>
  unitsPerEm: number
  className?: string
  size?: HangulTargetSize
}

/** Renders each syllable as Pretendard SVG paths, one per typed key. */
export default function JamoSvgHangulTarget({
  session,
  glyphs,
  unitsPerEm,
  className = '',
  size = 'regular',
}: JamoSvgHangulTargetProps) {
  const characters = Array.from(session.targetText)
  const keyIndexes = new Map<number, number[]>()
  session.expectedKeys.forEach((key, index) => {
    const list = keyIndexes.get(key.syllableIndex) ?? []
    list.push(index)
    keyIndexes.set(key.syllableIndex, list)
  })

  return (
    <div
      className={`flex flex-wrap justify-center ${HANGUL_TARGET_SIZES[size].gap} ${className}`}
      aria-label={session.targetText}
      role="img"
    >
      <TargetWords
        items={[...keyIndexes.entries()]}
        isSpace={([syllableIndex]) => characters[syllableIndex] === ' '}
        size={size}
        renderTile={([syllableIndex, indexes]) => {
          const syllable = characters[syllableIndex] ?? ''
          if (syllable === ' ') {
            // A space is a typed step too: a narrow gap with a state-colored bar.
            const state = stateFor(indexes[0], session.keyIndex)
            return (
              <span
                key={syllableIndex}
                className={spaceClass(size)}
                data-testid="space-step"
                data-state={state}
                aria-hidden="true"
              >
                <span
                  className="h-1.5 w-full rounded-full"
                  style={{ backgroundColor: COLORS[state] }}
                />
              </span>
            )
          }
          const glyph = glyphs.get(syllable)
          if (!glyph) return null
          return (
            <svg
              key={syllableIndex}
              viewBox={`0 0 ${glyph.width} ${unitsPerEm}`}
              className={`${tileClass(size)} ${HANGUL_TARGET_SIZES[size].padding}`}
              data-syllable={syllable}
              aria-hidden="true"
            >
              {glyph.paths.map((path, step) => (
                <path
                  key={step}
                  d={path.d}
                  fillRule="evenodd"
                  fill={fillFor(indexes[step], session.keyIndex)}
                />
              ))}
            </svg>
          )
        }}
      />
    </div>
  )
}

export function PendingHangulTiles({
  spaces,
  label,
  className = '',
  size = 'regular',
}: {
  /** One entry per typed character; true where it is a space. */
  spaces: boolean[]
  label: string
  className?: string
  size?: HangulTargetSize
}) {
  return (
    <div
      className={`flex flex-wrap justify-center ${HANGUL_TARGET_SIZES[size].gap} ${className}`}
      aria-label={label}
      aria-busy="true"
      role="img"
    >
      <TargetWords
        items={spaces.map((isSpace, index) => ({ isSpace, index }))}
        isSpace={({ isSpace }) => isSpace}
        size={size}
        renderTile={({ isSpace, index }) =>
          isSpace ? (
            <span
              key={index}
              className={spaceClass(size)}
              data-testid="pending-space-tile"
            />
          ) : (
            <div
              key={index}
              className={tileClass(size)}
              data-testid="pending-hangul-tile"
            />
          )
        }
      />
    </div>
  )
}
