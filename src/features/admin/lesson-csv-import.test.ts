import { describe, expect, it } from 'vitest'
import { lessonCsvTemplate, parseLessonExerciseCsv } from './lesson-csv-import'

const header = 'no,word,meaning_th,meaning_en,romanization,difficulty,hint\n'

describe('parseLessonExerciseCsv', () => {
  it('provides a UTF-8-friendly template with the required header and an example', () => {
    expect(lessonCsvTemplate()).toBe(`\uFEFF${header}`)
  })

  it('maps a CSV row to an Exercise and normalizes difficulty casing', () => {
    const result = parseLessonExerciseCsv(
      `${header}1,안녕하세요,สวัสดี,Hello,annyeonghaseyo, Hard ,ทักทาย`,
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

  it('parses quoted commas and line breaks in optional fields', () => {
    const result = parseLessonExerciseCsv(
      `${header}1,안녕,"สวัสดี, เป็นกันเอง",Hello,annyeong,easy,"ใช้กับเพื่อน\nหรือคนสนิท"`,
      () => 'exercise-1',
    )

    expect(result.exercises[0]).toMatchObject({
      meaningTh: 'สวัสดี, เป็นกันเอง',
      hint: 'ใช้กับเพื่อน\nหรือคนสนิท',
    })
    expect(result.errors).toEqual([])
  })

  it('reports invalid rows while retaining valid rows', () => {
    const result = parseLessonExerciseCsv(
      `${header}1,안녕,สวัสดี,Hello,annyeong,easy,\n2,,ว่าง,Empty,empty,medium,\n3,감사,ขอบคุณ,Thanks,gamsa,expert,`,
      () => 'exercise-1',
    )

    expect(result.exercises).toHaveLength(1)
    expect(result.errors).toEqual([
      { row: 3, reason: 'wordRequired' },
      { row: 4, reason: 'invalidDifficulty' },
    ])
  })

  it('rejects a missing or misordered header', () => {
    const result = parseLessonExerciseCsv(
      'word,no,meaning_th,meaning_en,romanization,difficulty,hint\n안녕,1,สวัสดี,Hello,annyeong,easy,',
      () => 'exercise-1',
    )

    expect(result.exercises).toEqual([])
    expect(result.errors).toEqual([{ row: 1, reason: 'invalidHeader' }])
  })
})
