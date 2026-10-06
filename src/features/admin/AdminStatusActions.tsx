import { useState } from 'react'
import { useFetcher } from 'react-router'
import type { ContentStatus } from '../../domain/models/content-status'
import { Button } from '../../components/ui/Button'
import { ConfirmationModal } from '../../components/ui/ConfirmationModal'
import type { AdminActionData } from './admin-action'
import { useAdminFeedback } from './useAdminFeedback'
import { useAdminMutationPending } from './useAdminMutationPending'
import { useAdminTranslation } from './i18n/admin-i18n'

type StatusIntent = 'publish' | 'archive' | 'restore'

function actionsForStatus(status: ContentStatus | undefined): StatusIntent[] {
  return status === 'archived'
    ? ['restore']
    : status === 'published'
      ? ['archive']
      : ['publish', 'archive']
}

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
  const { t } = useAdminTranslation()
  const [pendingIntent, setPendingIntent] = useState<StatusIntent | null>(null)
  const isPending = useAdminMutationPending()
  useAdminFeedback(fetcher, () => setPendingIntent(null))
  const submit = (intent: string) => {
    fetcher.submit({ intent, id, kind }, { method: 'post' })
  }
  const actions = actionsForStatus(status)
  return (
    <>
      {actions.map((action) => (
        <Button
          key={action}
          type="button"
          variant={action === 'archive' ? 'secondary' : 'primary'}
          className={action === 'archive' ? 'px-3 py-1.5 text-xs' : ''}
          disabled={isPending}
          onClick={() => setPendingIntent(action)}
        >
          {t(`action.${action}`)}
        </Button>
      ))}
      <ConfirmationModal
        open={pendingIntent !== null}
        title={
          pendingIntent
            ? t(`confirm.${pendingIntent}.title`, { kind: t(`kind.${kind}`) })
            : ''
        }
        body={
          pendingIntent === 'archive'
            ? t('confirm.archive.body')
            : t('confirm.visibility.body')
        }
        cancelLabel={t('action.cancel')}
        confirmLabel={
          isPending
            ? t('action.saving')
            : pendingIntent
              ? t(`action.${pendingIntent}`)
              : ''
        }
        closeLabel={t('action.close')}
        isConfirming={isPending}
        onClose={() => setPendingIntent(null)}
        onConfirm={() => pendingIntent && submit(pendingIntent)}
      />
    </>
  )
}

export function AdminStatusActionsPreview({
  status,
}: {
  status: ContentStatus | undefined
}) {
  const { t } = useAdminTranslation()
  return actionsForStatus(status).map((action) => (
    <span
      key={action}
      className={`inline-flex items-center justify-center rounded-full border text-sm font-semibold ${
        action === 'archive'
          ? 'border-[#eadfd4] bg-white/90 px-3 py-1.5 text-xs text-[#39465b]'
          : 'border-[#a85d4e] bg-[#a85d4e] px-4 py-2 text-white'
      }`}
    >
      {t(`action.${action}`)}
    </span>
  ))
}
