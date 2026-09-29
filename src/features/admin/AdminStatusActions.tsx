import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import type { ContentStatus } from '../../domain/models/content-status'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useSnackbar } from '../../components/ui/SnackbarProvider'
import type { AdminActionData } from './admin-action'
import { formatAdminError, useAdminTranslation } from './i18n/admin-i18n'

type StatusIntent = 'publish' | 'archive' | 'restore'

export function AdminStatusActions({
  id,
  kind,
  status,
}: {
  id: string
  kind: 'course' | 'unit' | 'lesson'
  status: ContentStatus | undefined
}) {
  const fetcher = useFetcher<AdminActionData>()
  const { showError, showSuccess } = useSnackbar()
  const { t } = useAdminTranslation()
  const [pendingIntent, setPendingIntent] = useState<StatusIntent | null>(null)
  const waiting = useRef(false)
  useEffect(() => {
    if (waiting.current && fetcher.state === 'idle' && fetcher.data) {
      waiting.current = false
      if (fetcher.data.error)
        showError(
          formatAdminError(t, fetcher.data.error, fetcher.data.errorDetail),
        )
      else showSuccess(t(fetcher.data.message ?? 'feedback.contentUpdated'))
    }
  }, [fetcher.data, fetcher.state, showError, showSuccess, t])
  const submit = (intent: string) => {
    waiting.current = true
    fetcher.submit({ intent, id, kind }, { method: 'post' })
  }
  const actions: StatusIntent[] =
    status === 'archived'
      ? ['restore']
      : status === 'published'
        ? ['archive']
        : ['publish', 'archive']
  return (
    <>
      {actions.map((action) => (
        <Button
          key={action}
          type="button"
          variant={action === 'archive' ? 'secondary' : 'primary'}
          onClick={() => setPendingIntent(action)}
        >
          {t(`action.${action}`)}
        </Button>
      ))}
      <Modal
        open={pendingIntent !== null}
        title={
          pendingIntent
            ? t(`confirm.${pendingIntent}.title`, { kind: t(`kind.${kind}`) })
            : ''
        }
        closeLabel={t('action.close')}
        onClose={() => setPendingIntent(null)}
      >
        <p className="mt-3 text-sm leading-6 text-[#667085]">
          {pendingIntent === 'archive'
            ? t('confirm.archive.body')
            : t('confirm.visibility.body')}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPendingIntent(null)}>
            {t('action.cancel')}
          </Button>
          <Button
            onClick={() => {
              if (pendingIntent) submit(pendingIntent)
              setPendingIntent(null)
            }}
          >
            {pendingIntent ? t(`action.${pendingIntent}`) : ''}
          </Button>
        </div>
      </Modal>
    </>
  )
}
