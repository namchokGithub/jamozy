import { describe, expect, it } from 'vitest'
import type { JamoStats } from '../models/jamo-stat'
import {
  JAMO_GROUPS,
  jamoCell,
  jamoGrid,
  nearestToUnlock,
  practicableJamo,
} from './jamo-grid'

const at = new Date(0)
const stat = (accepted: number, rejected: number) => ({
  acceptedKeystrokes: accepted,
  rejectedKeystrokes: rejected,
  firstPracticedAt: at,
  lastPracticedAt: at,
})

describe('JAMO_GROUPS', () => {
  it('covers the 33 Hangul letter keys once each', () => {
    const all = JAMO_GROUPS.flatMap((group) => group.jamo)
    expect(all).toHaveLength(33)
    expect(new Set(all).size).toBe(33)
  })
})

describe('jamoCell', () => {
  it('has no accuracy before any attempt', () => {
    expect(jamoCell('ㄱ', undefined)).toEqual({
      jamo: 'ㄱ',
      attempts: 0,
      accuracy: null,
      tone: 'none',
    })
  })

  it('stays neutral below 20 attempts but still shows accuracy', () => {
    expect(jamoCell('ㄱ', stat(1, 1))).toMatchObject({
      attempts: 2,
      accuracy: 50,
      tone: 'pending',
    })
  })

  it('colors by accuracy from 20 attempts: <70 weak, 70–<90 fair, 90+ strong', () => {
    expect(jamoCell('ㄱ', stat(13, 7)).tone).toBe('weak') // 65%
    expect(jamoCell('ㄱ', stat(14, 6)).tone).toBe('fair') // 70%
    expect(jamoCell('ㄱ', stat(17, 3)).tone).toBe('fair') // 85%
    expect(jamoCell('ㄱ', stat(18, 2)).tone).toBe('strong') // 90%
  })
})

describe('jamoGrid', () => {
  it('returns every group with a cell per jamo', () => {
    const grid = jamoGrid({ ㄲ: stat(8, 12) })
    expect(grid.map((group) => group.label)).toEqual([
      'Plain consonants',
      'Tense (double)',
      'Cardinal vowels',
      'Compound / Y-vowels',
    ])
    expect(grid[1].cells[0]).toMatchObject({ jamo: 'ㄲ', accuracy: 40, tone: 'weak' })
  })
})

describe('nearestToUnlock', () => {
  it('returns the most practiced jamo still under 20 attempts', () => {
    const stats: JamoStats = { ㄱ: stat(10, 2), ㄴ: stat(3, 0), ㅏ: stat(30, 0) }
    expect(nearestToUnlock(stats)).toEqual({ jamo: 'ㄱ', attempts: 12 })
  })

  it('returns null without stats or when every practiced jamo is unlocked', () => {
    expect(nearestToUnlock({})).toBeNull()
    expect(nearestToUnlock({ ㅏ: stat(30, 0) })).toBeNull()
  })
})

describe('practicableJamo', () => {
  it('lists the jamo keys found in the exercises', () => {
    expect(
      [...practicableJamo([{ targetText: '과 나' }])].sort(),
    ).toEqual(['ㄱ', 'ㄴ', 'ㅏ', 'ㅗ'])
  })
})

describe('jamoCell with recent counts', () => {
  it('shows recent accuracy once ranked', () => {
    expect(
      jamoCell('ㄱ', { ...stat(60, 40), recentAccepted: 9.5, recentRejected: 0.5 }),
    ).toMatchObject({ attempts: 100, accuracy: 95, tone: 'strong' })
  })
})

