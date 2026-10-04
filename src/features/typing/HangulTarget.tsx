import { useEffect, useMemo, useState } from 'react'
import type { TypingSessionState } from '../../domain/korean/typing-session'
import {
  loadJamoSvgGlyphs,
  peekJamoSvgGlyphs,
} from '../../infrastructure/jamo-svg/jamo-svg-dataset'
import DecomposedHangulTarget from './DecomposedHangulTarget'
import JamoSvgHangulTarget, { PendingHangulTiles } from './JamoSvgHangulTarget'
import {
  chooseRenderer,
  isSpaceGroup,
  svgTargetSyllables,
  targetSyllables,
  type RendererChoice,
  type SyllableGroup,
} from './hangul-target-selection'
import { isJamoSvgRendererEnabled } from './jamo-svg-flag'

export const JAMO_SVG_LOAD_TIMEOUT_MS = 1500

interface HangulTargetProps {
  session: TypingSessionState
  className?: string
}

function warn(reason: string) {
  if (import.meta.env.DEV)
    console.warn(`[jamo-svg] Using Canvas for this target: ${reason}.`)
}

/** Chooses the SVG or legacy Canvas renderer for the whole target (DEC-039). */
export default function HangulTarget({
  session,
  className = '',
}: HangulTargetProps) {
  const [enabled] = useState(isJamoSvgRendererEnabled)
  const { targetText, expectedKeys } = session
  // Keyed by content: a new session for the same target (the next exercise)
  // keeps the same groups, so the renderer is not chosen again.
  const groupsKey = JSON.stringify(
    svgTargetSyllables(targetText, expectedKeys) ?? null,
  )
  const groups = useMemo(
    () => JSON.parse(groupsKey) as SyllableGroup[] | null,
    [groupsKey],
  )
  // Shards already in memory decide at once, so a new target never flashes blank tiles.
  const cachedChoice = useMemo(() => {
    if (!enabled || !groups) return undefined
    const cached = peekJamoSvgGlyphs(targetSyllables(groups))
    return cached && chooseRenderer(groups, cached)
  }, [enabled, groups])
  const [decision, setDecision] = useState<{
    targetText: string
    choice: RendererChoice
  }>()

  useEffect(() => {
    if (!enabled) return
    if (!groups) {
      warn('the target has characters other than Hangul syllables and spaces')
      return
    }
    if (cachedChoice) {
      if (cachedChoice.kind === 'canvas') warn(cachedChoice.reason)
      return
    }
    let active = true
    const decide = (choice: RendererChoice) => {
      if (!active) return
      active = false
      clearTimeout(timer)
      if (choice.kind === 'canvas') warn(choice.reason)
      setDecision({ targetText, choice })
    }
    const timer = setTimeout(
      () =>
        decide({
          kind: 'canvas',
          reason: `shards did not load within ${JAMO_SVG_LOAD_TIMEOUT_MS} ms`,
        }),
      JAMO_SVG_LOAD_TIMEOUT_MS,
    )
    loadJamoSvgGlyphs(targetSyllables(groups)).then(
      (loaded) => decide(chooseRenderer(groups, loaded)),
      () => decide({ kind: 'canvas', reason: 'the shard loader failed' }),
    )
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [cachedChoice, enabled, groups, targetText])

  if (!enabled || !groups)
    return <DecomposedHangulTarget session={session} className={className} />
  const choice =
    cachedChoice ??
    (decision?.targetText === targetText ? decision.choice : undefined)
  if (!choice)
    return (
      <PendingHangulTiles
        spaces={groups.map(isSpaceGroup)}
        label={targetText}
        className={className}
      />
    )
  if (choice.kind === 'canvas')
    return <DecomposedHangulTarget session={session} className={className} />
  return (
    <JamoSvgHangulTarget
      session={session}
      glyphs={choice.glyphs}
      unitsPerEm={choice.unitsPerEm}
      className={className}
    />
  )
}
