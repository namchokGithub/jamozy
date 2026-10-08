import type { RuntimeJamoSvgGlyph } from '../../domain/korean/jamo-svg-runtime'
import type { TypingSessionState } from '../../domain/korean/typing-session'

const COLORS = {
  correct: '#20b981',
  current: '#c84f82',
  pending: '#c7c3bc',
}
const TILE_CLASS =
  'h-26 w-26 rounded-md border border-[#f0eaff] bg-[#f9f8ff] shadow-[0_0_24px_-16px_rgba(87,65,45,0.35)]'

const SPACE_CLASS = 'flex h-26 w-8 items-end pb-3'

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
        if (syllable === ' ') {
          // A space is a typed step too: a narrow gap with a state-colored bar.
          const state = stateFor(indexes[0], session.keyIndex)
          return (
            <span
              key={syllableIndex}
              className={SPACE_CLASS}
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
  spaces,
  label,
  className = '',
}: {
  /** One entry per typed character; true where it is a space. */
  spaces: boolean[]
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
      {spaces.map((isSpace, index) =>
        isSpace ? (
          <span
            key={index}
            className={SPACE_CLASS}
            data-testid="pending-space-tile"
          />
        ) : (
          <div
            key={index}
            className={TILE_CLASS}
            data-testid="pending-hangul-tile"
          />
        ),
      )}
    </div>
  )
}
