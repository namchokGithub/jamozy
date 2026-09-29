import { Outlet } from 'react-router'
import { AdminI18nProvider } from './i18n/AdminI18nProvider'

export default function AdminLayout() {
  return (
    <AdminI18nProvider>
      <Outlet />
    </AdminI18nProvider>
  )
}
