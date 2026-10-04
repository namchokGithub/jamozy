import type { ContentStatus } from '../../domain/models/content-status'
import { Dropdown } from '../../components/ui/Dropdown'
import { useAdminTranslation } from './i18n/admin-i18n'

export function AdminContentListToolbar({
  totalLabel,
  total,
  counts,
  search,
  onSearch,
  status,
  onStatusChange,
}: {
  totalLabel: string
  total: number
  counts: Record<ContentStatus, number>
  search: string
  onSearch: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
}) {
  const { t } = useAdminTranslation()
  return (
    <section className="mt-4 rounded-2xl border border-[#eadfd4] bg-white/70 p-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: totalLabel, value: total },
          { label: t('status.draft'), value: counts.draft },
          { label: t('status.published'), value: counts.published },
          { label: t('status.archived'), value: counts.archived },
        ].map((metric) => (
          <div key={metric.label} className="rounded-xl bg-[#fffaf5] px-3 py-2">
            <p className="text-xs font-semibold uppercase text-[#8b7d72]">
              {metric.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-[#3f3029]">
              {metric.value}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="grid gap-2 text-sm font-semibold text-[#39465b]">
          {t('dashboard.search')}
          <input
            className="block h-10.75 w-full rounded-2xl border border-[#eadfd4] bg-white/90 px-3 py-2.5 text-sm font-medium text-[#253247] shadow-sm outline-none placeholder:text-[#a99a90] hover:border-[#d8b3a9] focus:border-[#d8b3a9] focus:ring-2 focus:ring-[#f2c5bb]"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={t('dashboard.searchPlaceholder')}
          />
        </label>
        <Dropdown
          label={t('dashboard.statusFilter')}
          value={status}
          onChange={onStatusChange}
          options={[
            { value: 'all', label: t('dashboard.allStatuses') },
            { value: 'draft', label: t('status.draft') },
            { value: 'published', label: t('status.published') },
            { value: 'archived', label: t('status.archived') },
          ]}
        />
      </div>
    </section>
  )
}
