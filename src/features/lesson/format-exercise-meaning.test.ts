import { describe, expect, it } from 'vitest'
import { formatExerciseMeaning } from './format-exercise-meaning'

describe('formatExerciseMeaning', () => {
  it('shows only the Thai meaning when meaningLanguage is th', () => {
    expect(formatExerciseMeaning({ meaningTh: 'สวัสดี', meaningEn: 'Hello' }, 'th')).toBe('สวัสดี')
  })

  it('shows only the English meaning when meaningLanguage is en', () => {
    expect(formatExerciseMeaning({ meaningTh: 'สวัสดี', meaningEn: 'Hello' }, 'en')).toBe('Hello')
  })

  it('shows both, joined, when meaningLanguage is both', () => {
    expect(formatExerciseMeaning({ meaningTh: 'สวัสดี', meaningEn: 'Hello' }, 'both')).toBe(
      'สวัสดี / Hello',
    )
  })

  it('omits an empty meaningTh rather than rendering a blank slot', () => {
    expect(formatExerciseMeaning({ meaningTh: '', meaningEn: 'Hello' }, 'both')).toBe('Hello')
  })

  it('omits an empty meaningEn rather than rendering a blank slot', () => {
    expect(formatExerciseMeaning({ meaningTh: 'สวัสดี', meaningEn: '' }, 'both')).toBe('สวัสดี')
  })

  it('returns null when both meanings are empty, so nothing renders', () => {
    expect(formatExerciseMeaning({ meaningTh: '', meaningEn: '' }, 'both')).toBeNull()
  })

  it("returns null for meaningLanguage 'th' when meaningTh itself is empty", () => {
    expect(formatExerciseMeaning({ meaningTh: '', meaningEn: 'Hello' }, 'th')).toBeNull()
  })
})
