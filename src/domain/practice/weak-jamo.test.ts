import { describe, expect, it } from 'vitest'
import type { HomeContent } from '../models/home-content'
import type { JamoStats } from '../models/jamo-stat'
import {
  homePracticeExercises,
  selectWeakJamoExercises,
  weakJamoScore,
  weakJamoTargets,
  type PracticeExercise,
} from './weak-jamo'

const at = new Date(0)
const stat = (accepted: number, rejected: number) => ({
  acceptedKeystrokes: accepted,
  rejectedKeystrokes: rejected,
  firstPracticedAt: at,
  lastPracticedAt: at,
})

describe('weakJamoTargets', () => {
  it('keeps up to 3 practiced jamo with mistakes, highest rate first', () => {
    const stats: JamoStats = {
      ㅓ: stat(82, 18), // 18%
      ㅗ: stat(88, 12), // 12%
      ㄹ: stat(91, 9), // 9%
      ㅏ: stat(95, 5), // 5% — fourth
      ㄱ: stat(1, 1), // too few attempts
      ㄴ: stat(40, 0), // no mistakes
    }
    expect(weakJamoTargets(stats).map((target) => target.jamo)).toEqual([
      'ㅓ',
      'ㅗ',
      'ㄹ',
    ])
  })

  it('breaks a rate tie by more attempts and returns [] without data', () => {
    expect(weakJamoTargets({ ㄱ: stat(18, 2), ㄴ: stat(36, 4) })[0].jamo).toBe(
      'ㄴ',
    )
    expect(weakJamoTargets({})).toEqual([])
  })
})

describe('weakJamoScore', () => {
  const targets = [
    { jamo: 'ㅓ', mistakeRate: 0.2, attempts: 50 },
    { jamo: 'ㅗ', mistakeRate: 0.1, attempts: 50 },
  ]

  it('weights key-level target jamo by mistake rate, ignoring spaces', () => {
    expect(weakJamoScore('거', targets)).toBeCloseTo(0.2)
    expect(weakJamoScore('과', targets)).toBeCloseTo(0.1) // ㅘ = ㅗ + ㅏ
    expect(weakJamoScore('어 어', targets)).toBeCloseTo(0.4)
    expect(weakJamoScore('가', targets)).toBe(0)
  })
})

describe('selectWeakJamoExercises', () => {
  const targets = [{ jamo: 'ㅓ', mistakeRate: 0.2, attempts: 50 }]
  const exercise = (id: string, targetText: string): PracticeExercise => ({
    id,
    targetText,
    lessonType: 'word',
  })

  it('skips zero scores and duplicates and returns at most 10', () => {
    const pool = [
      exercise('zero', '가'),
      exercise('dup', '거'),
      exercise('dup', '거'),
      ...Array.from({ length: 12 }, (_, index) => exercise(`e${index}`, '어')),
    ]
    const picked = selectWeakJamoExercises(targets, pool, () => 0)
    expect(picked).toHaveLength(10)
    expect(picked.some((item) => item.id === 'zero')).toBe(false)
    expect(new Set(picked.map((item) => item.id)).size).toBe(10)
  })

  it('draws only from the 30 highest scores', () => {
    const strong = Array.from({ length: 30 }, (_, index) =>
      exercise(`strong${index}`, '어어'),
    )
    const weak = Array.from({ length: 30 }, (_, index) =>
      exercise(`weak${index}`, '어'),
    )
    const picked = selectWeakJamoExercises(
      targets,
      [...weak, ...strong],
      Math.random,
    )
    expect(picked.every((item) => item.id.startsWith('strong'))).toBe(true)
  })

  it('returns [] without targets', () => {
    expect(selectWeakJamoExercises([], [exercise('a', '어')])).toEqual([])
  })
})

describe('homePracticeExercises', () => {
  it('flattens Home lessons with lesson-scoped ids and lesson types', () => {
    const fields = {
      romanization: null,
      meaningTh: '',
      meaningEn: '',
      difficulty: 'easy' as const,
      hint: null,
    }
    const content: HomeContent = {
      schemaVersion: 1,
      exportedAt: '2026-10-09T00:00:00Z',
      course: { id: 'home', title: '', description: '' },
      units: [
        {
          id: 'u',
          title: '',
          description: '',
          order: 0,
          lessons: [
            {
              id: 'l1',
              title: '',
              type: 'word',
              order: 0,
              exercises: [{ id: 'e1', targetText: '어', ...fields }],
            },
            {
              id: 'l2',
              title: '',
              type: 'sentence',
              order: 1,
              exercises: [{ id: 'e1', targetText: '어 어', ...fields }],
            },
          ],
        },
      ],
    }
    expect(homePracticeExercises(content)).toEqual([
      { id: 'l1:e1', targetText: '어', lessonType: 'word' },
      { id: 'l2:e1', targetText: '어 어', lessonType: 'sentence' },
    ])
  })
})
