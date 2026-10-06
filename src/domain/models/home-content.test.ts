import { describe, expect, it } from 'vitest'
import { homeContentSchema, type HomeContent } from './home-content'

function validContent(): HomeContent {
  return {
    schemaVersion: 1,
    exportedAt: '2026-10-06T00:00:00.000Z',
    course: { id: 'home', title: 'Home', description: '' },
    units: [{
      id: 'unit-1', title: 'Greetings', description: '', order: 1,
      lessons: [{
        id: 'lesson-1', title: 'Hello', type: 'word', order: 1,
        exercises: [{
          id: 'exercise-1', targetText: '안녕', romanization: 'annyeong',
          meaningTh: 'สวัสดี', meaningEn: 'hello', difficulty: 'easy', hint: null,
        }],
      }],
    }],
  }
}

describe('homeContentSchema', () => {
  it('accepts a valid export', () => {
    expect(homeContentSchema.parse(validContent())).toEqual(validContent())
  })

  it('rejects an unknown schema version', () => {
    expect(homeContentSchema.safeParse({ ...validContent(), schemaVersion: 2 }).success).toBe(false)
  })

  it('rejects a missing exercise id', () => {
    const content = validContent()
    content.units[0].lessons[0].exercises[0].id = ''
    expect(homeContentSchema.safeParse(content).success).toBe(false)
  })

  it('rejects a lesson without exercises', () => {
    const content = validContent()
    content.units[0].lessons[0].exercises = []
    expect(homeContentSchema.safeParse(content).success).toBe(false)
  })

  it('rejects duplicate lesson ids across units', () => {
    const content = validContent()
    content.units.push({ ...content.units[0], id: 'unit-2', order: 2 })
    expect(homeContentSchema.safeParse(content).success).toBe(false)
  })

  it('rejects duplicate exercise ids within a lesson', () => {
    const content = validContent()
    const lesson = content.units[0].lessons[0]
    lesson.exercises.push({ ...lesson.exercises[0], targetText: '하세요' })
    expect(homeContentSchema.safeParse(content).success).toBe(false)
  })
})
