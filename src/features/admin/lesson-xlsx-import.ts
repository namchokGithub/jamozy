import * as XLSX from 'xlsx'
import { normalizeHangulText } from '../../domain/korean/hangul'
import { findUntypeableCharacters } from '../../domain/korean/target-sequence'
import type { LessonExercise } from '../../domain/models/lesson'

const expectedHeader = [
  'no',
  'word',
  'meaning_th',
  'meaning_en',
  'romanization',
  'difficulty',
  'hint',
]

export type LessonXlsxImportErrorReason =
  | 'invalidHeader'
  | 'invalidColumnCount'
  | 'wordRequired'
  | 'untypeableWord'
  | 'invalidDifficulty'
  | 'invalidWorkbook'

export interface LessonXlsxImportError {
  row: number
  reason: LessonXlsxImportErrorReason
}

export interface LessonXlsxImportResult {
  exercises: LessonExercise[]
  errors: LessonXlsxImportError[]
}

function isExpectedHeader(values: string[]): boolean {
  return (
    values.length === expectedHeader.length &&
    values.every(
      (value, index) => value.trim().toLowerCase() === expectedHeader[index],
    )
  )
}

export function parseLessonExerciseWorkbook(
  bytes: ArrayBuffer,
  createId: () => string,
): LessonXlsxImportResult {
  let rows: string[][]
  try {
    const workbook = XLSX.read(bytes, { type: 'array' })
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? '']
    if (!sheet)
      return {
        exercises: [],
        errors: [{ row: 1, reason: 'invalidWorkbook' }],
      }
    rows = XLSX.utils
      .sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
      .map((row) => row.map((value) => String(value ?? '')))
  } catch {
    return { exercises: [], errors: [{ row: 1, reason: 'invalidWorkbook' }] }
  }

  if (!isExpectedHeader(rows[0] ?? []))
    return { exercises: [], errors: [{ row: 1, reason: 'invalidHeader' }] }

  const exercises: LessonExercise[] = []
  const errors: LessonXlsxImportError[] = []
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

export function lessonXlsxTemplate(): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet([
    expectedHeader,
    [1, '안녕하세요', 'สวัสดี', 'Hello', 'annyeonghaseyo', 'easy', 'ใช้ทักทาย'],
  ])
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Exercises')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
}
