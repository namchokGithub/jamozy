import { AdminBreadcrumb, type AdminBreadcrumbItem } from './AdminBreadcrumb'
import { AdminLanguageSwitcher } from './AdminLanguageSwitcher'

export function AdminTopBar({
  breadcrumb,
}: {
  breadcrumb?: AdminBreadcrumbItem[]
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {breadcrumb ? <AdminBreadcrumb items={breadcrumb} /> : <span />}
      <AdminLanguageSwitcher />
    </div>
  )
}
