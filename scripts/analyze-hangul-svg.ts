import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import {
  CHOSEONG_LIST,
  COMPOUND_JONGSEONG_PARTS,
  COMPOUND_JUNGSEONG_PARTS,
  JONGSEONG_LIST,
  JUNGSEONG_LIST,
} from '../src/domain/korean/hangul'

type OutlineCommand = {
  type: string
  x?: number
  y?: number
  x1?: number
  y1?: number
  x2?: number
  y2?: number
}

type Glyph = {
  advanceWidth: number
  getBoundingBox(): { x1: number; y1: number; x2: number; y2: number }
  getPath(x: number, y: number, size: number): { commands: OutlineCommand[] }
}

type Font = {
  unitsPerEm: number
  ascender: number
  descender: number
  charToGlyph(character: string): Glyph
}

const require = createRequire(import.meta.url)
const opentype = require('opentype.js') as {
  parse(buffer: ArrayBuffer): Font
}

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3
const HANGUL_COUNT = HANGUL_END - HANGUL_START + 1

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

function decompose(codePoint: number) {
  const offset = codePoint - HANGUL_START
  const jongseongIndex = offset % JONGSEONG_LIST.length
  const jungseongIndex =
    Math.floor(offset / JONGSEONG_LIST.length) % JUNGSEONG_LIST.length
  const choseongIndex = Math.floor(
    offset / JONGSEONG_LIST.length / JUNGSEONG_LIST.length,
  )
  const choseong = CHOSEONG_LIST[choseongIndex]
  const jungseong = JUNGSEONG_LIST[jungseongIndex]
  const jongseong = JONGSEONG_LIST[jongseongIndex]

  return { choseong, jungseong, jongseong }
}

function physicalSteps(codePoint: number): string[] {
  const { choseong, jungseong, jongseong } = decompose(codePoint)
  return [
    choseong,
    ...(COMPOUND_JUNGSEONG_PARTS[jungseong] ?? [jungseong]),
    ...(jongseong
      ? (COMPOUND_JONGSEONG_PARTS[jongseong] ?? [jongseong])
      : []),
  ]
}

function increment(map: Map<number | string, number>, value: number | string) {
  map.set(value, (map.get(value) ?? 0) + 1)
}

function sortedDistribution(map: Map<number | string, number>) {
  return Object.fromEntries(
    [...map.entries()].sort(([left], [right]) =>
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right)),
    ),
  )
}

function contourSignature(contours: OutlineCommand[][]) {
  return contours.map((contour) => contour.map(({ type }) => type).join('')).join('|')
}

function describeGlyph(
  char: string,
  codePoint: number,
  glyph: Glyph,
  contours: OutlineCommand[][],
) {
  const steps = physicalSteps(codePoint)
  const contourCount = contours.length
  const commandCount = contours.reduce((total, contour) => total + contour.length, 0)

  return {
    syllable: char,
    codePoint: `U+${codePoint.toString(16).toUpperCase()}`,
    steps,
    stepCount: steps.length,
    contourCount,
    commandCount,
    advanceWidth: glyph.advanceWidth,
    bounds: glyph.getBoundingBox(),
    signature: contourSignature(contours),
  }
}

function main() {
  const fontBuffer = readFileSync(
    'src/assets/fonts/pretendard-latin-600-normal.ttf',
  )
  const font = opentype.parse(
    fontBuffer.buffer.slice(
      fontBuffer.byteOffset,
      fontBuffer.byteOffset + fontBuffer.byteLength,
    ),
  )
  const baselineY = (font.unitsPerEm + font.ascender + font.descender) / 2
  const stepCounts = new Map<number, number>()
  const contourCounts = new Map<number, number>()
  const advanceWidths = new Map<number, number>()
  const countRelationship = new Map<string, number>()
  const topologyCounts = new Map<string, number>()
  const records: ReturnType<typeof describeGlyph>[] = []

  for (let codePoint = HANGUL_START; codePoint <= HANGUL_END; codePoint += 1) {
    const syllable = String.fromCodePoint(codePoint)
    const glyph = font.charToGlyph(syllable)
    const contours = splitContours(
      glyph.getPath(0, baselineY, font.unitsPerEm).commands,
    )
    const record = describeGlyph(syllable, codePoint, glyph, contours)
    records.push(record)
    increment(stepCounts, record.stepCount)
    increment(contourCounts, record.contourCount)
    increment(advanceWidths, record.advanceWidth)
    increment(countRelationship, `${record.stepCount} steps / ${record.contourCount} contours`)
    increment(topologyCounts, record.signature)
  }

  const values = records.find(({ syllable }) => syllable === '값')
  const contourDeficit = records.filter(
    ({ contourCount, stepCount }) => contourCount < stepCount,
  )
  const contourSurplus = records.filter(
    ({ contourCount, stepCount }) => contourCount > stepCount,
  )
  const countAligned = records.filter(
    ({ contourCount, stepCount }) => contourCount === stepCount,
  )
  const valuesSignatureMatches = values
    ? records.filter(({ signature }) => signature === values.signature)
    : []
  const deficitByAmount = new Map<number, number>()
  const byStepCount = new Map<
    number,
    { aligned: number; deficit: number; surplus: number }
  >()
  const byJongseong = new Map<
    string,
    { total: number; aligned: number; deficit: number; surplus: number }
  >()

  for (const record of records) {
    const offset = Number.parseInt(record.codePoint.slice(2), 16)
    const { jongseong } = decompose(offset)
    const difference = record.contourCount - record.stepCount
    const stepBucket = byStepCount.get(record.stepCount) ?? {
      aligned: 0,
      deficit: 0,
      surplus: 0,
    }
    const jongseongBucket = byJongseong.get(jongseong || 'none') ?? {
      total: 0,
      aligned: 0,
      deficit: 0,
      surplus: 0,
    }
    jongseongBucket.total += 1
    if (difference === 0) {
      stepBucket.aligned += 1
      jongseongBucket.aligned += 1
    } else if (difference < 0) {
      stepBucket.deficit += 1
      jongseongBucket.deficit += 1
      increment(deficitByAmount, -difference)
    } else {
      stepBucket.surplus += 1
      jongseongBucket.surplus += 1
    }
    byStepCount.set(record.stepCount, stepBucket)
    byJongseong.set(jongseong || 'none', jongseongBucket)
  }

  const result = {
    source: {
      font: 'src/assets/fonts/pretendard-latin-600-normal.ttf',
      range: 'U+AC00–U+D7A3',
      expectedGlyphs: HANGUL_COUNT,
      scannedGlyphs: records.length,
      unitsPerEm: font.unitsPerEm,
      ascender: font.ascender,
      descender: font.descender,
      baselineY,
      advanceWidthDistribution: sortedDistribution(advanceWidths),
    },
    distributions: {
      physicalStepCounts: sortedDistribution(stepCounts),
      contourCounts: sortedDistribution(contourCounts),
      stepContourRelationship: sortedDistribution(countRelationship),
    },
    categories: {
      countAligned: countAligned.length,
      contourDeficitCandidates: contourDeficit.length,
      contourSurplusCandidates: contourSurplus.length,
      valuesTopologyMatches: valuesSignatureMatches.length,
      uniqueTopologySignatures: topologyCounts.size,
      oneContourWithThreeOrMoreSteps: records.filter(
        ({ contourCount, stepCount }) => contourCount === 1 && stepCount >= 3,
      ).length,
      compoundFinalSyllables: records.filter(({ codePoint }) => {
        const point = Number.parseInt(codePoint.slice(2), 16)
        return Boolean(COMPOUND_JONGSEONG_PARTS[decompose(point).jongseong])
      }).length,
    },
    candidateSignals: {
      contourDeficitByAmount: sortedDistribution(deficitByAmount),
      byStepCount: Object.fromEntries([...byStepCount.entries()].sort()),
      byJongseong: Object.fromEntries(
        [...byJongseong.entries()].sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      ),
    },
    examples: {
      contourDeficit: contourDeficit.slice(0, 30),
      largestDeficit: [...contourDeficit]
        .sort(
          (left, right) =>
            right.stepCount - right.contourCount -
            (left.stepCount - left.contourCount),
        )
        .slice(0, 30),
      contourSurplus: contourSurplus.slice(0, 30),
      values,
      valuesTopologyMatches: valuesSignatureMatches.slice(0, 50),
      mostComplex: [...records]
        .sort((left, right) => right.commandCount - left.commandCount)
        .slice(0, 30),
      commonTopologies: [...topologyCounts.entries()]
        .sort(([, left], [, right]) => right - left)
        .slice(0, 25)
        .map(([signature, count]) => ({
          count,
          signature,
          examples: records
            .filter((record) => record.signature === signature)
            .slice(0, 8)
            .map(({ syllable, steps, contourCount, commandCount }) => ({
              syllable,
              steps,
              contourCount,
              commandCount,
            })),
        })),
    },
  }

  if (process.argv.includes('--compact')) {
    console.log(
      JSON.stringify(
        {
          source: result.source,
          distributions: result.distributions,
          categories: result.categories,
          candidateSignals: result.candidateSignals,
          examples: {
            values: result.examples.values,
            largestDeficit: result.examples.largestDeficit.slice(0, 12),
            mostComplex: result.examples.mostComplex.slice(0, 12),
            commonTopologies: result.examples.commonTopologies.slice(0, 10),
          },
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(JSON.stringify(result, null, 2))
}

main()
