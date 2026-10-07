/**
 * Orders `items` by a reorder submission while it is pending, so a drag shows
 * at once. Once the fetcher settles, the revalidated loader order is the
 * truth again, which also puts a rejected reorder back where it was.
 */
export function withPendingOrder<T extends { id: string }>(
  items: T[],
  formData: FormData | undefined,
  intent: string,
): T[] {
  if (formData?.get('intent') !== intent) return items
  let order: unknown
  try {
    order = JSON.parse(String(formData.get('order')))
  } catch {
    return items
  }
  if (!Array.isArray(order)) return items
  const byId = new Map(items.map((item) => [item.id, item]))
  const ordered = order.flatMap((id) => {
    const item = typeof id === 'string' ? byId.get(id) : undefined
    return item ? [item] : []
  })
  return [...ordered, ...items.filter((item) => !ordered.includes(item))]
}
