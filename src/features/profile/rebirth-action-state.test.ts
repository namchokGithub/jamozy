import { describe, expect, it } from 'vitest'
import { closesRebirthModal } from './rebirth-action-state'

describe('closesRebirthModal', () => {
  it('closes only after a completed Rebirth action', () => {
    expect(closesRebirthModal({ status: 'rebirthed', record: {} })).toBe(true)
    expect(closesRebirthModal({ status: 'already-applied', record: {} })).toBe(true)
    expect(closesRebirthModal({ status: 'ineligible', level: 99 })).toBe(true)
    expect(closesRebirthModal({ error: 'offline' })).toBe(false)
    expect(closesRebirthModal(undefined)).toBe(false)
  })
})
