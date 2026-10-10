/**
 * How big the Hangul target's syllable tiles are. Tiles have a real size
 * rather than a CSS scale, so a long target wraps where it is actually full.
 *
 * - `regular`: 104px everywhere.
 * - `compact`: 64px below `sm`, 104px from `sm` up (Lesson and Review).
 * - `homeLarge` / `homeMedium`: Home's larger tiles from `sm` up, picked by
 *   {@link homeTargetSize}; 64px below `sm`.
 */
export type HangulTargetSize =
  'regular' | 'compact' | 'homeLarge' | 'homeMedium'

interface TargetSizeClasses {
  /** Width and height of a syllable tile. */
  tile: string
  /** Inner padding of an SVG tile. */
  padding: string
  /** Size of a typed space between words. */
  space: string
  /** Gap between tiles, both inside a word and between words. */
  gap: string
}

export const HANGUL_TARGET_SIZES: Record<HangulTargetSize, TargetSizeClasses> =
  {
    regular: {
      tile: 'h-26 w-26',
      padding: 'p-1.5',
      space: 'h-26 w-8 pb-3',
      gap: 'gap-2',
    },
    compact: {
      tile: 'h-16 w-16 sm:h-26 sm:w-26',
      padding: 'p-1.5',
      space: 'h-16 w-5 pb-2 sm:h-26 sm:w-8 sm:pb-3',
      gap: 'gap-2',
    },
    // Matches Home's earlier 160% scale of a 104px tile, as real size.
    homeLarge: {
      tile: 'h-16 w-16 sm:h-[10.4rem] sm:w-[10.4rem]',
      padding: 'p-1.5 sm:p-2.5',
      space: 'h-16 w-5 pb-2 sm:h-[10.4rem] sm:w-[3.2rem] sm:pb-5',
      gap: 'gap-2 sm:gap-3',
    },
    homeMedium: {
      tile: 'h-16 w-16 sm:h-30 sm:w-30',
      padding: 'p-1.5 sm:p-2',
      space: 'h-16 w-5 pb-2 sm:h-30 sm:w-10 sm:pb-4',
      gap: 'gap-2',
    },
  }

/**
 * Home shows short targets large and steps down for longer ones, so a
 * sentence still fits the card. Spaces count, since each takes a step.
 */
export function homeTargetSize(targetText: string): HangulTargetSize {
  const length = Array.from(targetText).length
  if (length <= 5) return 'homeLarge'
  if (length <= 8) return 'homeMedium'
  return 'compact'
}

export type TargetSegment<T> =
  { kind: 'word'; items: T[] } | { kind: 'space'; item: T }

/**
 * Splits a target's tiles into words and the spaces between them, so a line
 * can break only at a space and never inside a word.
 */
export function segmentTargetWords<T>(
  items: T[],
  isSpace: (item: T) => boolean,
): TargetSegment<T>[] {
  const segments: TargetSegment<T>[] = []
  for (const item of items) {
    if (isSpace(item)) {
      segments.push({ kind: 'space', item })
      continue
    }
    const last = segments.at(-1)
    if (last?.kind === 'word') last.items.push(item)
    else segments.push({ kind: 'word', items: [item] })
  }
  return segments
}
