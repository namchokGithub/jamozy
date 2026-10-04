import type { ContentStatus } from '../../domain/models/content-status'
import { statusKey, useAdminTranslation } from './i18n/admin-i18n'

export function AdminStatusBadge({
  status,
}: {
  status: ContentStatus | undefined
}) {
  const { t } = useAdminTranslation()
  const tone =
    status === 'published'
      ? 'bg-[#edf5df] text-[#58733d]'
      : status === 'archived'
        ? 'bg-[#f1eeeb] text-[#7b7169]'
        : 'bg-[#fff1d8] text-[#92703e]'

  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${tone}`}
    >
      {t(statusKey(status))}
    </span>
  )
}
