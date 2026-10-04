import { useCallback, useEffect } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router'

export function useAdminUnsavedChanges(isDirty: boolean, message: string) {
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
  const blocker = useBlocker(isDirty)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    if (window.confirm(message)) blocker.proceed()
    else blocker.reset()
  }, [blocker, message])
}
