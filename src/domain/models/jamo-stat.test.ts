import { describe, expect, it } from 'vitest'
import {
  applyJamoCounts,
  recentJamoCounts,
  jamoCountsFrom,
  jamoCountsSchema,
  jamoRankings,
  mergeJamoCounts,
  type JamoStats,
} from './jamo-stat'

const mistake = (expectedJamo: string) => ({
  syllableIndex: 0,
  expectedCode: 'KeyH',
  expectedShift: false,
  expectedJamo,
  pressedCode: 'KeyJ',
  pressedShift: false,
})

describe('jamoCountsFrom', () => {
  it('counts key-level jamo: compound vowels split, doubles once', () => {
    expect(jamoCountsFrom([{ targetText: '과', mistakes: [] }])).toEqual({
      ㄱ: { accepted: 1, rejected: 0 },
      ㅗ: { accepted: 1, rejected: 0 },
      ㅏ: { accepted: 1, rejected: 0 },
    })
    expect(jamoCountsFrom([{ targetText: '까', mistakes: [] }])).toEqual({
      ㄲ: { accepted: 1, rejected: 0 },
      ㅏ: { accepted: 1, rejected: 0 },
    })
  })

  it('charges a mistake to the expected jamo', () => {
    expect(
      jamoCountsFrom([
        { targetText: '고', mistakes: [mistake('ㅗ'), mistake('ㅗ')] },
      ]).ㅗ,
    ).toEqual({ accepted: 1, rejected: 2 })
  })

  it('skips spaces and unknown expected jamo', () => {
    const counts = jamoCountsFrom([
      { targetText: '가 나', mistakes: [mistake(' '), mistake('?')] },
    ])
    expect(Object.keys(counts).sort()).toEqual(['ㄱ', 'ㄴ', 'ㅏ'])
  })

  it('skips the keys of a target the keymap cannot type, keeping its mistakes', () => {
    expect(
      jamoCountsFrom([
        { targetText: '가!', mistakes: [mistake('ㄱ')] },
        { targetText: '나', mistakes: [] },
      ]),
    ).toEqual({
      ㄱ: { accepted: 0, rejected: 1 },
      ㄴ: { accepted: 1, rejected: 0 },
      ㅏ: { accepted: 1, rejected: 0 },
    })
  })
})

describe('mergeJamoCounts', () => {
  it('adds counts per jamo', () => {
    expect(
      mergeJamoCounts(
        { ㄱ: { accepted: 1, rejected: 1 } },
        { ㄱ: { accepted: 2, rejected: 0 }, ㅏ: { accepted: 1, rejected: 0 } },
      ),
    ).toEqual({
      ㄱ: { accepted: 3, rejected: 1 },
      ㅏ: { accepted: 1, rejected: 0 },
    })
    expect(
      mergeJamoCounts(undefined, { ㄱ: { accepted: 1, rejected: 0 } }),
    ).toEqual({ ㄱ: { accepted: 1, rejected: 0 } })
  })
})

describe('applyJamoCounts', () => {
  const first = new Date('2026-10-01T00:00:00Z')
  const now = new Date('2026-10-09T00:00:00Z')

  it('adds counters, keeps firstPracticedAt, and adds new jamo', () => {
    const current: JamoStats = {
      ㄱ: {
        acceptedKeystrokes: 5,
        rejectedKeystrokes: 1,
        firstPracticedAt: first,
        lastPracticedAt: first,
      },
    }
    const next = applyJamoCounts(
      current,
      { ㄱ: { accepted: 2, rejected: 1 }, ㅏ: { accepted: 3, rejected: 0 } },
      now,
    )
    expect(next.ㄱ).toEqual({
      acceptedKeystrokes: 7,
      rejectedKeystrokes: 2,
      recentAccepted: 6.5,
      recentRejected: 1.9,
      firstPracticedAt: first,
      lastPracticedAt: now,
    })
    expect(next.ㅏ).toEqual({
      acceptedKeystrokes: 3,
      rejectedKeystrokes: 0,
      recentAccepted: 3,
      recentRejected: 0,
      firstPracticedAt: now,
      lastPracticedAt: now,
    })
  })

  it('keeps the earliest first and latest last practice for an older submit', () => {
    const current: JamoStats = {
      ㄱ: {
        acceptedKeystrokes: 1,
        rejectedKeystrokes: 0,
        firstPracticedAt: now,
        lastPracticedAt: now,
      },
    }
    // A Home job queued offline before `now` is flushed afterwards.
    const next = applyJamoCounts(
      current,
      { ㄱ: { accepted: 1, rejected: 0 } },
      first,
    )
    expect(next.ㄱ).toMatchObject({
      acceptedKeystrokes: 2,
      firstPracticedAt: first,
      lastPracticedAt: now,
    })
  })

  it('does not add a key for a zero count', () => {
    expect(
      applyJamoCounts({}, { ㄱ: { accepted: 0, rejected: 0 } }, now),
    ).toEqual({})
  })
})

describe('jamoRankings', () => {
  const at = new Date(0)
  const stat = (accepted: number, rejected: number) => ({
    acceptedKeystrokes: accepted,
    rejectedKeystrokes: rejected,
    firstPracticedAt: at,
    lastPracticedAt: at,
  })

  it('ranks only jamo with at least 20 attempts for weakest and strongest', () => {
    const rankings = jamoRankings({
      ㄱ: stat(1, 1), // 50% but only 2 attempts
      ㅓ: stat(82, 18), // 18%
      ㅗ: stat(88, 12), // 12%
      ㄹ: stat(30, 0), // 0%
    })
    expect(rankings.weakest?.jamo).toBe('ㅓ')
    expect(rankings.strongest?.jamo).toBe('ㄹ')
    expect(rankings.mostPracticed).toMatchObject({ jamo: 'ㅓ', attempts: 100 })
    expect(rankings.mostMistyped).toMatchObject({ jamo: 'ㅓ', rejected: 18 })
    expect(rankings.weakest?.mistakeRate).toBeCloseTo(0.18)
  })

  it('breaks a rate tie by more attempts', () => {
    expect(
      jamoRankings({ ㄱ: stat(20, 0), ㄴ: stat(40, 0) }).strongest?.jamo,
    ).toBe('ㄴ')
  })

  it('returns null when there is no data or nothing reaches the minimum', () => {
    expect(jamoRankings({})).toEqual({
      mostPracticed: null,
      mostMistyped: null,
      weakest: null,
      strongest: null,
    })
    expect(jamoRankings({ ㄱ: stat(3, 1) }).weakest).toBeNull()
  })
})

describe('jamoCountsSchema', () => {
  it('accepts known jamo with integer counts and rejects anything else', () => {
    const ok = (value: unknown) => jamoCountsSchema.safeParse(value).success
    expect(ok({ ㄱ: { accepted: 2, rejected: 0 } })).toBe(true)
    expect(ok({ x: { accepted: 2, rejected: 0 } })).toBe(false)
    expect(ok({ ㄱ: { accepted: -1, rejected: 0 } })).toBe(false)
    expect(ok({ ㄱ: { accepted: 10_001, rejected: 0 } })).toBe(false)
    expect(ok({ ㄱ: { accepted: 1.5, rejected: 0 } })).toBe(false)
  })
})

describe('recent accuracy', () => {
  const now = new Date('2026-10-09T00:00:00Z')

  it('starts recent counts from the session for a new jamo', () => {
    const next = applyJamoCounts({}, { ㄱ: { accepted: 3, rejected: 1 } }, now)
    expect(recentJamoCounts(next.ㄱ)).toEqual({ accepted: 3, rejected: 1 })
  })

  it('decays earlier recent counts by 0.9 before adding the session', () => {
    const current: JamoStats = {
      ㄱ: { acceptedKeystrokes: 50, rejectedKeystrokes: 50, recentAccepted: 10, recentRejected: 10, firstPracticedAt: now, lastPracticedAt: now },
    }
    const next = applyJamoCounts(current, { ㄱ: { accepted: 5, rejected: 0 } }, now)
    expect(next.ㄱ).toMatchObject({ acceptedKeystrokes: 55, rejectedKeystrokes: 50 })
    expect(recentJamoCounts(next.ㄱ)).toEqual({ accepted: 14, rejected: 9 })
  })

  it('reads lifetime counts as recent for a stat stored before recent counts', () => {
    const legacy = { acceptedKeystrokes: 8, rejectedKeystrokes: 2, firstPracticedAt: now, lastPracticedAt: now }
    expect(recentJamoCounts(legacy)).toEqual({ accepted: 8, rejected: 2 })
    const next = applyJamoCounts({ ㄱ: legacy }, { ㄱ: { accepted: 1, rejected: 0 } }, now)
    expect(recentJamoCounts(next.ㄱ)).toEqual({ accepted: 8.2, rejected: 1.8 })
  })

  it('ranks weakest by recent mistakes, so improvement shows', () => {
    const stat = (accepted: number, rejected: number, recentAccepted: number, recentRejected: number) => ({
      acceptedKeystrokes: accepted, rejectedKeystrokes: rejected, recentAccepted, recentRejected, firstPracticedAt: now, lastPracticedAt: now,
    })
    const rankings = jamoRankings({
      ㄱ: stat(60, 40, 9.5, 0.5), // was weak, now 5% recent mistakes
      ㄴ: stat(90, 10, 8, 2), // 20% recent mistakes
    })
    expect(rankings.weakest?.jamo).toBe('ㄴ')
    expect(rankings.weakest?.mistakeRate).toBeCloseTo(0.2)
  })
})

