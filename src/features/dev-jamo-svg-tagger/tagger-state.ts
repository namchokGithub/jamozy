/** Save responses intentionally omit immutable cache geometry. */
export function retainSourceAfterSave<T extends { source: unknown }, S>(
  current: T,
  saved: S,
): S & Pick<T, 'source'> {
  return { ...saved, source: current.source }
}
