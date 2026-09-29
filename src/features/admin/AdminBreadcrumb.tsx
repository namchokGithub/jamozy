import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { useAdminTranslation } from './i18n/admin-i18n'

export interface AdminBreadcrumbItem {
  label: string
  to?: string
}

export function AdminBreadcrumb({ items }: { items: AdminBreadcrumbItem[] }) {
  const { t } = useAdminTranslation()
  return (
    <nav
      aria-label={t('breadcrumb.label')}
      className="flex flex-wrap items-center gap-1.5 text-sm"
    >
      {items.map((item, index) => (
        <span
          key={`${item.label}-${index}`}
          className="flex items-center gap-1.5"
        >
          {index > 0 && (
            <ChevronRight
              aria-hidden="true"
              size={14}
              className="text-[#b7aa9f]"
            />
          )}
          {item.to ? (
            <Link
              className="text-[#8b7d72] hover:text-[#8d4c43] hover:underline"
              to={item.to}
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-[#39465b]">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
