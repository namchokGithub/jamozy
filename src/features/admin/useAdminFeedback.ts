import { useEffect, useRef } from 'react'
import { useSnackbar } from '../../components/ui/SnackbarProvider'
import type { AdminActionData } from './admin-action'

export function useAdminFeedback(fetcher: {
  state: string
  data?: AdminActionData
}) {
  const { showError, showSuccess } = useSnackbar()
  const inFlight = useRef(false)
  useEffect(() => {
    if (fetcher.state !== 'idle') inFlight.current = true
    if (inFlight.current && fetcher.state === 'idle' && fetcher.data) {
      inFlight.current = false
      if (fetcher.data.error) showError(fetcher.data.error)
      else if (fetcher.data.message) showSuccess(fetcher.data.message)
    }
  }, [fetcher.data, fetcher.state, showError, showSuccess])
}
