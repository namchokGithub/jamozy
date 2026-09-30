import { parse } from 'opentype.js'
import pretendardFontUrl from '../../assets/fonts/pretendard-latin-600-normal.ttf?url'

export interface GlyphContour {
  id: number
  d: string
  /** Jamo steps physically present in this contour, based on manual inspection. */
  spansJamoSteps?: number[]
  splitPieceIds?: string[]
}

export interface GlyphPiece {
  id: string
  d: string
  sourceContourId: number
  /** This piece was made by closing a shared interior seam in its source contour. */
  wasSplitFromSourceContour?: boolean
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
  pieces: GlyphPiece[]
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

export const DEFAULT_PIECE_ASSIGNMENTS: Record<
  TargetSyllable,
  Record<string, number>
> = {
  가: { 'contour-0': 1, 'contour-1': 0 },
  하: { 'contour-0': 1, 'contour-1': 1, 'contour-2': 1, 'contour-3': 0 },
  녕: { 'contour-0': 0, 'contour-1': 1, 'contour-2': 2, 'contour-3': 2 },
  죄: { 'contour-0': 0, 'contour-1': 1, 'contour-2': 2 },
  화: { 'contour-0': 2, 'contour-1': 0, 'contour-2': 1, 'contour-3': 0 },
  값: {
    'contour-0': 1,
    'contour-1': 0,
    'contour-2-bieup': 2,
    'contour-2-siot': 3,
    'contour-3': 2,
  },
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

function splitContours(commands: OutlineCommand[]): OutlineCommand[][] {
  const contours: OutlineCommand[][] = []
  let current: OutlineCommand[] = []

  for (const command of commands) {
    if (command.type === 'M' && current.length > 0) {
      contours.push(current)
      current = []
    }
    current.push(command)
    if (command.type === 'Z') {
      contours.push(current)
      current = []
    }
  }

  if (current.length > 0) contours.push(current)
  return contours
}

function commandsToSvg(commands: OutlineCommand[]): string {
  return commands.map(commandToSvg).join(' ')
}

function assertLine(
  command: OutlineCommand | undefined,
  description: string,
): asserts command is Required<Pick<OutlineCommand, 'x' | 'y'>> & OutlineCommand {
  if (command?.type !== 'L' || command.x === undefined || command.y === undefined) {
    throw new Error(`Unexpected Pretendard 값 contour structure at ${description}.`)
  }
}

function splitGapsieotContour(
  commands: OutlineCommand[],
): [GlyphPiece, GlyphPiece] {
  // This deliberately handles only the fixed Pretendard 600 값 outline. The
  // font stores ㅂ and ㅅ as one unioned contour, omitting their shared interior
  // edge. Every exterior command remains verbatim; only the two coincident
  // interior closing segments are added to make independent fillable pieces.
  const sharedTopEdge = commands[4]
  const siotStart = commands[5]
  assertLine(sharedTopEdge, 'ㅂ top-right edge')
  assertLine(siotStart, 'ㅅ start')

  if (sharedTopEdge.x !== siotStart.x) {
    throw new Error('Unexpected Pretendard 값 shared ㅂ/ㅅ edge.')
  }

  const baseReturnIndex = commands.findIndex(
    (command, index) =>
      index > 5 &&
      command.type === 'L' &&
      command.x === sharedTopEdge.x &&
      command.y !== undefined &&
      command.y > siotStart.y,
  )
  const baseReturn = commands[baseReturnIndex]
  assertLine(baseReturn, 'ㅂ return edge')

  const bieupOuter = [
    ...commands.slice(0, 5),
    { type: 'L', x: sharedTopEdge.x, y: baseReturn.y },
    ...commands.slice(baseReturnIndex + 1),
  ]
  const siot = [
    { type: 'M', x: siotStart.x, y: siotStart.y },
    ...commands.slice(6, baseReturnIndex + 1),
    { type: 'Z' },
  ]

  return [
    {
      id: 'contour-2-bieup',
      d: commandsToSvg(bieupOuter),
      sourceContourId: 2,
      wasSplitFromSourceContour: true,
    },
    {
      id: 'contour-2-siot',
      d: commandsToSvg(siot),
      sourceContourId: 2,
      wasSplitFromSourceContour: true,
    },
  ]
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
  const contourCommands = splitContours(path.commands)
  const contours = contourCommands.map(commandsToSvg)
  const conflicts = CONTOUR_CONFLICTS[syllable] ?? {}
  const splitPieces =
    syllable === '값' ? splitGapsieotContour(contourCommands[2]) : []
  const pieces = contourCommands.flatMap((commands, sourceContourId) => {
    if (syllable === '값' && sourceContourId === 2) return splitPieces
    return [
      {
        id: `contour-${sourceContourId}`,
        d: commandsToSvg(commands),
        sourceContourId,
      },
    ]
  })

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
      splitPieceIds:
        syllable === '값' && id === 2
          ? splitPieces.map((piece) => piece.id)
          : undefined,
    })),
    pieces,
  }
}
