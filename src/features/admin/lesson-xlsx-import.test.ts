import * as XLSX from 'xlsx'
import {
  lessonXlsxTemplate,
  parseLessonExerciseWorkbook,
} from './lesson-xlsx-import'

const header = [
  'no',
  'word',
  'meaning_th',
  'meaning_en',
  'romanization',
  'difficulty',
  'hint',
]

function workbookBytes(rows: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Exercises')
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
}

describe('parseLessonExerciseWorkbook', () => {
  it('maps the first worksheet and normalizes difficulty casing', () => {
    const result = parseLessonExerciseWorkbook(
      workbookBytes([
        header,
        [
          1,
          '안녕하세요',
          'สวัสดี',
          'Hello',
          'annyeonghaseyo',
          ' Hard ',
          'ทักทาย',
        ],
      ]),
      () => 'exercise-1',
    )

    expect(result.exercises).toEqual([
      {
        id: 'exercise-1',
        targetText: '안녕하세요',
        meaningTh: 'สวัสดี',
        meaningEn: 'Hello',
        romanization: 'annyeonghaseyo',
        difficulty: 'hard',
        hint: 'ทักทาย',
      },
    ])
    expect(result.errors).toEqual([])
  })

  it('reports invalid rows while retaining valid rows', () => {
    const result = parseLessonExerciseWorkbook(
      workbookBytes([
        header,
        [1, '안녕', 'สวัสดี', 'Hello', 'annyeong', 'easy', ''],
        [2, '', 'ว่าง', 'Empty', 'empty', 'medium', ''],
        [3, '감사', 'ขอบคุณ', 'Thanks', 'gamsa', 'expert', ''],
      ]),
      () => 'exercise-1',
    )

    expect(result.exercises).toHaveLength(1)
    expect(result.errors).toEqual([
      { row: 3, reason: 'wordRequired' },
      { row: 4, reason: 'invalidDifficulty' },
    ])
  })

  it('rejects a missing or misordered header', () => {
    const result = parseLessonExerciseWorkbook(
      workbookBytes([
        ['word', 'no', ...header.slice(2)],
        ['안녕', 1, 'สวัสดี', 'Hello', 'annyeong', 'easy', ''],
      ]),
      () => 'exercise-1',
    )

    expect(result.exercises).toEqual([])
    expect(result.errors).toEqual([{ row: 1, reason: 'invalidHeader' }])
  })

  it('creates a workbook template with the required sheet and header', () => {
    const workbook = XLSX.read(lessonXlsxTemplate(), { type: 'array' })
    const sheet = workbook.Sheets.Exercises

    expect(workbook.SheetNames).toEqual(['Exercises'])
    expect(XLSX.utils.sheet_to_json(sheet, { header: 1 })[0]).toEqual(header)
  })
})
