import type { Blocker } from 'react-router'
import { ConfirmationModal } from '../../components/ui/ConfirmationModal'
import { useAdminTranslation } from './i18n/admin-i18n'

export function AdminUnsavedChangesDialog({ blocker }: { blocker: Blocker }) {
  const { t } = useAdminTranslation()
  return (
    <ConfirmationModal
      open={blocker.state === 'blocked'}
      title={t('feedback.unsavedChanges')}
      body={t('feedback.unsavedChangesWarning')}
      cancelLabel={t('action.stay')}
      confirmLabel={t('action.leave')}
      closeLabel={t('action.close')}
      onClose={() => blocker.reset?.()}
      onConfirm={() => blocker.proceed?.()}
    />
  )
}
