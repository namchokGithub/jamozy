import { parse } from 'opentype.js'
import pretendardFontUrl from '../../assets/fonts/pretendard-latin-600-normal.ttf?url'

export interface GlyphContour {
  id: number
  d: string
  /** Jamo steps physically present in this contour, based on manual inspection. */
  spansJamoSteps?: number[]
}

export interface PretendardGlyph {
  advanceWidth: number
  unitsPerEm: number
  ascender: number
  descender: number
  /** SVG-space baseline for a CSS `line-height: 1` em box. */
  baselineY: number
  boundingBox: { x1: number; y1: number; x2: number; y2: number }
  d: string
  contours: GlyphContour[]
}

export const TARGET_SYLLABLES = {
  가: ['ㄱ', 'ㅏ'],
  하: ['ㅎ', 'ㅏ'],
  녕: ['ㄴ', 'ㅕ', 'ㅇ'],
  죄: ['ㅈ', 'ㅗ', 'ㅣ'],
  화: ['ㅎ', 'ㅗ', 'ㅏ'],
  값: ['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ'],
} as const

export type TargetSyllable = keyof typeof TARGET_SYLLABLES

export const DEFAULT_CONTOUR_ASSIGNMENTS: Record<TargetSyllable, number[]> = {
  가: [1, 0],
  하: [1, 1, 1, 0],
  녕: [0, 1, 2, 2],
  죄: [0, 1, 2],
  화: [2, 0, 1, 0],
  // Contour 2 contains both physical ㅂ and ㅅ geometry. It is deliberately
  // assigned to ㅂ so the inspection UI exposes the conflict.
  값: [1, 0, 2, 2],
}

// These are manually observed physical-jamo overlaps in the source outline;
// they are annotations only and never replace or modify Pretendard geometry.
const CONTOUR_CONFLICTS: Partial<
  Record<TargetSyllable, Record<number, number[]>>
> = {
  값: { 2: [2, 3] },
}

type OutlineCommand = {
  type: string
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

let fontPromise: Promise<ReturnType<typeof parse>> | undefined

export async function loadPretendard600(): Promise<ReturnType<typeof parse>> {
  if (!fontPromise) {
    fontPromise = fetch(pretendardFontUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Could not load local Pretendard 600 font (${response.status}).`,
          )
        }
        return response.arrayBuffer()
      })
      .then(async (buffer) => {
        const face = new FontFace(
          'Pretendard SVG PoC',
          `url(${pretendardFontUrl})`,
          {
            weight: '600',
          },
        )
        await face.load()
        document.fonts.add(face)
        return parse(buffer)
      })
  }
  return fontPromise
}

function commandToSvg(command: OutlineCommand): string {
  switch (command.type) {
    case 'M':
    case 'L':
      return `${command.type}${command.x} ${command.y}`
    case 'C':
      return `C${command.x1} ${command.y1} ${command.x2} ${command.y2} ${command.x} ${command.y}`
    case 'Q':
      return `Q${command.x1} ${command.y1} ${command.x} ${command.y}`
    case 'Z':
      return 'Z'
    default:
      throw new Error(
        `Unsupported Pretendard path command: ${String(command.type)}`,
      )
  }
}

function splitContours(commands: OutlineCommand[]): string[] {
  const contours: string[] = []
  let current: string[] = []

  for (const command of commands) {
    if (command.type === 'M' && current.length > 0) {
      contours.push(current.join(' '))
      current = []
    }
    current.push(commandToSvg(command))
    if (command.type === 'Z') {
      contours.push(current.join(' '))
      current = []
    }
  }

  if (current.length > 0) contours.push(current.join(' '))
  return contours
}

export async function extractPretendardGlyph(
  syllable: TargetSyllable,
): Promise<PretendardGlyph> {
  const font = await loadPretendard600()
  const glyph = font.charToGlyph(syllable)
  // CSS `font-size` maps the OpenType em square, not the full ascender ↔
  // descender line metrics, into one em. Distribute that line-metric leading
  // equally above and below the em box to match `line-height: 1` text layout.
  const baselineY = (font.unitsPerEm + font.ascender + font.descender) / 2
  const path = glyph.getPath(0, baselineY, font.unitsPerEm)
  const contours = splitContours(path.commands)
  const conflicts = CONTOUR_CONFLICTS[syllable] ?? {}

  return {
    advanceWidth: glyph.advanceWidth,
    unitsPerEm: font.unitsPerEm,
    ascender: font.ascender,
    descender: font.descender,
    baselineY,
    boundingBox: glyph.getBoundingBox(),
    d: contours.join(' '),
    contours: contours.map((d, id) => ({
      id,
      d,
      spansJamoSteps: conflicts[id],
    })),
  }
}
