export function closesRebirthModal(
  data:
    | { status: 'rebirthed' | 'already-applied'; record: unknown }
    | { status: 'ineligible'; level: number }
    | { error: string }
    | undefined,
): boolean {
  return Boolean(data && 'status' in data)
}
