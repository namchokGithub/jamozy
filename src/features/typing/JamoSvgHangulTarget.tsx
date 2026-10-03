import type { RuntimeJamoSvgGlyph } from '../../domain/korean/jamo-svg-runtime'
import type { TypingSessionState } from '../../domain/korean/typing-session'

const COLORS = {
  correct: '#20b981',
  current: '#e990b6',
  pending: '#c7c3bc',
}
const TILE_CLASS = 'h-26 w-26 rounded-md border border-[#bfd7fb] bg-[#fafcff]'

function fillFor(index: number, keyIndex: number) {
  if (index < keyIndex) return COLORS.correct
  if (index === keyIndex) return COLORS.current
  return COLORS.pending
}

interface JamoSvgHangulTargetProps {
  session: TypingSessionState
  glyphs: Map<string, RuntimeJamoSvgGlyph>
  unitsPerEm: number
  className?: string
}

/** Renders each syllable as Pretendard SVG paths, one per typed key. */
export default function JamoSvgHangulTarget({
  session,
  glyphs,
  unitsPerEm,
  className = '',
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
      className={`flex flex-wrap justify-center gap-2 ${className}`}
      aria-label={session.targetText}
      role="img"
    >
      {[...keyIndexes.entries()].map(([syllableIndex, indexes]) => {
        const syllable = characters[syllableIndex] ?? ''
        const glyph = glyphs.get(syllable)
        if (!glyph) return null
        return (
          <svg
            key={syllableIndex}
            viewBox={`0 0 ${glyph.width} ${unitsPerEm}`}
            className={`${TILE_CLASS} p-1.5`}
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
      })}
    </div>
  )
}

export function PendingHangulTiles({
  count,
  label,
  className = '',
}: {
  count: number
  label: string
  className?: string
}) {
  return (
    <div
      className={`flex flex-wrap justify-center gap-2 ${className}`}
      aria-label={label}
      aria-busy="true"
      role="img"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={TILE_CLASS}
          data-testid="pending-hangul-tile"
        />
      ))}
    </div>
  )
}
