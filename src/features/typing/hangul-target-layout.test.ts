import { describe, expect, it } from 'vitest'
import { homeTargetSize, segmentTargetWords } from './hangul-target-layout'

describe('segmentTargetWords', () => {
  it('groups syllables into words split by spaces', () => {
    const characters = Array.from('저는 학생입니다')
    expect(segmentTargetWords(characters, (c) => c === ' ')).toEqual([
      { kind: 'word', items: ['저', '는'] },
      { kind: 'space', item: ' ' },
      { kind: 'word', items: ['학', '생', '입', '니', '다'] },
    ])
  })

  it('keeps a target without spaces as one word', () => {
    expect(segmentTargetWords(['죄', '송'], () => false)).toEqual([
      { kind: 'word', items: ['죄', '송'] },
    ])
  })
})

describe('homeTargetSize', () => {
  it('steps tiles down as the target grows, counting spaces', () => {
    expect(homeTargetSize('죄송합니다')).toBe('homeLarge')
    expect(homeTargetSize('저는 학생')).toBe('homeLarge')
    expect(homeTargetSize('저는 학생이에')).toBe('homeMedium')
    expect(homeTargetSize('저는 학생입니다')).toBe('homeMedium')
    expect(homeTargetSize('만나서 반갑습니다')).toBe('compact')
  })
})
