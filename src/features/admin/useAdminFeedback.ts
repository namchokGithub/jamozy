import { useEffect, useRef } from 'react'
import { useSnackbar } from '../../components/ui/SnackbarProvider'
import type { AdminActionData } from './admin-action'
import { formatAdminError, useAdminTranslation } from './i18n/admin-i18n'

export function useAdminFeedback(
  fetcher: {
    state: string
    data?: AdminActionData
  },
  onSuccess?: (data: AdminActionData) => void,
) {
  const { showError, showSuccess } = useSnackbar()
  const { t } = useAdminTranslation()
  const inFlight = useRef(false)
  useEffect(() => {
    if (fetcher.state !== 'idle') inFlight.current = true
    if (inFlight.current && fetcher.state === 'idle' && fetcher.data) {
      inFlight.current = false
      if (fetcher.data.error)
        showError(
          formatAdminError(t, fetcher.data.error, fetcher.data.errorDetail),
        )
      else if (fetcher.data.message) {
        showSuccess(t(fetcher.data.message))
        onSuccess?.(fetcher.data)
      }
    }
  }, [fetcher.data, fetcher.state, onSuccess, showError, showSuccess, t])
}
