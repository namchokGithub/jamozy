import type { LessonExercise } from '../../domain/models/lesson'
import { findUntypeableCharacters } from '../../domain/korean/target-sequence'
import { normalizeHangulText } from '../../domain/korean/hangul'

const expectedHeader = [
  'no',
  'word',
  'meaning_th',
  'meaning_en',
  'romanization',
  'difficulty',
  'hint',
]

export type LessonCsvImportErrorReason =
  | 'invalidHeader'
  | 'invalidColumnCount'
  | 'wordRequired'
  | 'untypeableWord'
  | 'invalidDifficulty'
  | 'invalidCsv'

export interface LessonCsvImportError {
  row: number
  reason: LessonCsvImportErrorReason
}

export interface LessonCsvImportResult {
  exercises: LessonExercise[]
  errors: LessonCsvImportError[]
}

function parseCsvRows(source: string): string[][] | null {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (character === ',' && !quoted) {
      row.push(field)
      field = ''
      continue
    }
    if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      continue
    }
    field += character
  }

  if (quoted) return null
  if (field || row.length > 0) rows.push([...row, field])
  return rows.filter((values) => values.some((value) => value.trim()))
}

function isExpectedHeader(values: string[]): boolean {
  return (
    values.length === expectedHeader.length &&
    values.every(
      (value, index) =>
        value
          .replace(/^\uFEFF/, '')
          .trim()
          .toLowerCase() === expectedHeader[index],
    )
  )
}

export function parseLessonExerciseCsv(
  source: string,
  createId: () => string,
): LessonCsvImportResult {
  const rows = parseCsvRows(source)
  if (!rows)
    return { exercises: [], errors: [{ row: 1, reason: 'invalidCsv' }] }
  if (!isExpectedHeader(rows[0] ?? []))
    return { exercises: [], errors: [{ row: 1, reason: 'invalidHeader' }] }

  const exercises: LessonExercise[] = []
  const errors: LessonCsvImportError[] = []
  for (const [index, values] of rows.slice(1).entries()) {
    const row = index + 2
    if (values.length !== expectedHeader.length) {
      errors.push({ row, reason: 'invalidColumnCount' })
      continue
    }
    const [
      ,
      rawWord,
      meaningTh,
      meaningEn,
      rawRomanization,
      rawDifficulty,
      rawHint,
    ] = values
    const targetText = normalizeHangulText(rawWord).trim()
    if (!targetText) {
      errors.push({ row, reason: 'wordRequired' })
      continue
    }
    if (findUntypeableCharacters(targetText).length > 0) {
      errors.push({ row, reason: 'untypeableWord' })
      continue
    }
    const difficulty = rawDifficulty.trim().toLowerCase()
    if (
      difficulty !== 'easy' &&
      difficulty !== 'medium' &&
      difficulty !== 'hard'
    ) {
      errors.push({ row, reason: 'invalidDifficulty' })
      continue
    }
    exercises.push({
      id: createId(),
      targetText,
      meaningTh,
      meaningEn,
      romanization: rawRomanization || null,
      difficulty,
      hint: rawHint || null,
    })
  }
  return { exercises, errors }
}

export function lessonCsvTemplate(): string {
  return `\uFEFF${expectedHeader.join(',')}\n`
}
