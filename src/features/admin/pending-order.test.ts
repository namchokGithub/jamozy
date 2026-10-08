import { describe, expect, it } from 'vitest'
import { withPendingOrder } from './pending-order'

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

function submission(intent: string, order: string): FormData {
  const form = new FormData()
  form.set('intent', intent)
  form.set('order', order)
  return form
}

describe('withPendingOrder', () => {
  it('keeps the loader order when no reorder is pending', () => {
    expect(withPendingOrder(items, undefined, 'save-unit-order')).toBe(items)
    expect(
      withPendingOrder(
        items,
        submission('save', '["c","b","a"]'),
        'save-unit-order',
      ),
    ).toBe(items)
  })

  it('shows the submitted order while it is pending', () => {
    expect(
      withPendingOrder(
        items,
        submission('save-unit-order', '["c","a","b"]'),
        'save-unit-order',
      ).map((item) => item.id),
    ).toEqual(['c', 'a', 'b'])
  })

  it('drops unknown IDs and keeps items the order omits', () => {
    expect(
      withPendingOrder(
        items,
        submission('save-unit-order', '["b","gone"]'),
        'save-unit-order',
      ).map((item) => item.id),
    ).toEqual(['b', 'a', 'c'])
  })

  it('ignores an unreadable order', () => {
    expect(
      withPendingOrder(
        items,
        submission('save-unit-order', '[oops'),
        'save-unit-order',
      ),
    ).toBe(items)
  })
})
