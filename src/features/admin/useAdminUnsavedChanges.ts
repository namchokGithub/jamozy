import { useCallback } from 'react'
import { useBeforeUnload, useBlocker, type Blocker } from 'react-router'

/**
 * Guards unsaved edits. Tab close and reload keep the browser's native prompt
 * (browsers allow no custom dialog there); in-app navigation is blocked and
 * the returned blocker is confirmed through `AdminUnsavedChangesDialog`.
 */
export function useAdminUnsavedChanges(
  isDirty: boolean,
  message: string,
): Blocker {
  useBeforeUnload(
    useCallback(
      (event) => {
        if (!isDirty) return
        event.preventDefault()
        event.returnValue = message
      },
      [isDirty, message],
    ),
  )
  return useBlocker(isDirty)
}
