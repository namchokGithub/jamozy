import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import {
  COMPOUND_JONGSEONG_PARTS,
  COMPOUND_JUNGSEONG_PARTS,
  decomposeSyllable,
} from '../../src/domain/korean/hangul'
import {
  EXTRACTION_SCHEMA_VERSION,
  PATH_NORMALIZATION_VERSION,
  PHYSICAL_STEP_ALGORITHM_VERSION,
  type Bounds,
  type CachedGlyph,
  type JamoSlot,
  type MedialLayoutClass,
  type OutlineCommand,
} from './types'

const require = createRequire(import.meta.url)
const opentype = require('opentype.js') as {
  parse(buffer: ArrayBuffer): import('opentype.js').Font
}
export const FONT_PATH = 'src/assets/fonts/pretendard-latin-600-normal.ttf'

function hash(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}
function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const result = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(result).set(buffer)
  return result
}
function number(value: number | undefined) {
  return value === undefined ? undefined : Number(value.toFixed(6))
}
function normalizeCommand(
  command: import('opentype.js').PathCommand,
): OutlineCommand {
  switch (command.type) {
    case 'Z':
      return { type: 'Z' }
    case 'M':
    case 'L':
      return { type: command.type, x: number(command.x), y: number(command.y) }
    case 'Q':
      return {
        type: 'Q',
        x: number(command.x),
        y: number(command.y),
        x1: number(command.x1),
        y1: number(command.y1),
      }
    case 'C':
      return {
        type: 'C',
        x: number(command.x),
        y: number(command.y),
        x1: number(command.x1),
        y1: number(command.y1),
        x2: number(command.x2),
        y2: number(command.y2),
      }
  }
}
export function commandToSvg(command: OutlineCommand): string {
  if (command.type === 'Z') return 'Z'
  if (command.type === 'M' || command.type === 'L')
    return `${command.type}${command.x} ${command.y}`
  if (command.type === 'Q')
    return `Q${command.x1} ${command.y1} ${command.x} ${command.y}`
  return `C${command.x1} ${command.y1} ${command.x2} ${command.y2} ${command.x} ${command.y}`
}
export function commandsToSvg(commands: OutlineCommand[]) {
  return commands.map(commandToSvg).join(' ')
}
export function splitContours(commands: OutlineCommand[]): OutlineCommand[][] {
  const result: OutlineCommand[][] = []
  let current: OutlineCommand[] = []
  for (const command of commands) {
    if (command.type === 'M' && current.length) {
      result.push(current)
      current = []
    }
    current.push(command)
    if (command.type === 'Z') {
      result.push(current)
      current = []
    }
  }
  if (current.length) result.push(current)
  return result
}
function bounds(commands: OutlineCommand[]): Bounds {
  const values = commands
    .flatMap(
      (command) =>
        [
          [command.x, command.y],
          [command.x1, command.y1],
          [command.x2, command.y2],
        ] as const,
    )
    .filter(([x, y]) => x !== undefined && y !== undefined) as Array<
    [number, number]
  >
  return {
    x1: Math.min(...values.map(([x]) => x)),
    y1: Math.min(...values.map(([, y]) => y)),
    x2: Math.max(...values.map(([x]) => x)),
    y2: Math.max(...values.map(([, y]) => y)),
  }
}
function medialLayout(jungseong: string): MedialLayoutClass {
  if (jungseong === 'ㅢ') return 'mixed-eui'
  if (
    ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅣ'].includes(jungseong)
  )
    return 'vertical'
  if (['ㅗ', 'ㅛ', 'ㅜ', 'ㅠ', 'ㅡ'].includes(jungseong)) return 'horizontal'
  return ['ㅘ', 'ㅙ', 'ㅚ'].includes(jungseong)
    ? 'compound-horizontal-leading'
    : 'compound-vertical-leading'
}
// Parsing the font dominates extraction cost, so each process loads it once.
const loadedFonts = new Map<
  string,
  Promise<{ font: import('opentype.js').Font; sha256: string }>
>()
function loadFont(fontPath: string) {
  let loaded = loadedFonts.get(fontPath)
  if (!loaded) {
    loaded = readFile(fontPath).then((buffer) => ({
      font: opentype.parse(toArrayBuffer(buffer)),
      sha256: hash(buffer),
    }))
    loadedFonts.set(fontPath, loaded)
  }
  return loaded
}
export async function fontFingerprint(fontPath = FONT_PATH) {
  return (await loadFont(fontPath)).sha256
}
export async function extractGlyph(
  syllable: string,
  fontPath = FONT_PATH,
): Promise<CachedGlyph> {
  const decomposed = decomposeSyllable(syllable)
  if (!decomposed)
    throw new Error(
      `Expected a modern precomposed Hangul syllable, received ${syllable}.`,
    )
  const { font, sha256: fontSha256 } = await loadFont(fontPath)
  const glyph = font.charToGlyph(syllable)
  if (glyph.advanceWidth === undefined)
    throw new Error(`Glyph ${syllable} does not have an advance width.`)
  const baselineY = (font.unitsPerEm + font.ascender + font.descender) / 2
  const contourCommands = splitContours(
    glyph.getPath(0, baselineY, font.unitsPerEm).commands.map(normalizeCommand),
  )
  const steps: Array<{ jamo: string; slot: JamoSlot }> = [
    { jamo: decomposed.choseong, slot: 'choseong' },
    // Algorithm v2: a compound medial is one visual step, although it is
    // typed with two keys. Compound finals remain one step per key.
    { jamo: decomposed.jungseong, slot: 'jungseong' },
    ...(decomposed.jongseong
      ? (
          COMPOUND_JONGSEONG_PARTS[decomposed.jongseong] ?? [
            decomposed.jongseong,
          ]
        ).map((jamo) => ({ jamo, slot: 'jongseong' as const }))
      : []),
  ]
  const layout = medialLayout(decomposed.jungseong)
  const sourcePath = contourCommands.map(commandsToSvg).join(' ')
  const relation =
    contourCommands.length === steps.length
      ? 'aligned'
      : contourCommands.length < steps.length
        ? 'deficit'
        : 'surplus'
  return {
    syllable,
    codePoint: `U+${syllable.codePointAt(0)!.toString(16).toUpperCase()}`,
    extraction: {
      fontSha256,
      extractionSchema: EXTRACTION_SCHEMA_VERSION,
      pathNormalization: PATH_NORMALIZATION_VERSION,
      physicalStepAlgorithm: PHYSICAL_STEP_ALGORITHM_VERSION,
    },
    sourceGlyphHash: hash(sourcePath),
    physicalSteps: steps.map((step, order) => ({ ...step, order })),
    hangul: {
      ...decomposed,
      medialLayout: layout,
      compoundMedial: COMPOUND_JUNGSEONG_PARTS[decomposed.jungseong]
        ? decomposed.jungseong
        : null,
      compoundFinal: COMPOUND_JONGSEONG_PARTS[decomposed.jongseong]
        ? decomposed.jongseong
        : null,
    },
    advanceWidth: glyph.advanceWidth,
    bounds: glyph.getBoundingBox(),
    sourcePath,
    contours: contourCommands.map((commands, id) => ({
      id,
      d: commandsToSvg(commands),
      commands,
      commandHash: hash(JSON.stringify(commands)),
      bounds: bounds(commands),
      commandTypes: commands.map(({ type }) => type).join(''),
    })),
    signals: {
      contourRelation: relation,
      commandCount: contourCommands.flat().length,
      oneContourMultiStep: contourCommands.length === 1 && steps.length > 1,
    },
    family: {
      queueKey: {
        medialLayout: layout,
        hasFinal: Boolean(decomposed.jongseong),
        compoundMedial: COMPOUND_JUNGSEONG_PARTS[decomposed.jungseong]
          ? decomposed.jungseong
          : null,
        compoundFinal: COMPOUND_JONGSEONG_PARTS[decomposed.jongseong]
          ? decomposed.jongseong
          : null,
        physicalStepCount: steps.length,
        contourRelation: relation,
      },
      semanticKey: { ...decomposed, medialLayout: layout },
    },
  }
}
