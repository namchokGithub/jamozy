import { Link, useRouteError } from 'react-router'
import { NotFoundError } from '../../domain/errors'
import { Card } from '../../components/ui/Card'
import { PageSurface } from '../../components/ui/PageSurface'
import { UnauthorizedError } from './AdminGuard.loader'
import { AdminTopBar } from './AdminTopBar'
import { AdminI18nProvider } from './i18n/AdminI18nProvider'
import { useAdminTranslation } from './i18n/admin-i18n'

function AdminRouteErrorContent() {
  const error = useRouteError()
  const { t } = useAdminTranslation()
  const unauthorized = error instanceof UnauthorizedError
  const notFound = error instanceof NotFoundError
  const message = unauthorized
    ? t('routeError.unauthorizedBody')
    : notFound
      ? t('routeError.notFound')
      : error instanceof Error
        ? error.message
        : t('routeError.unknown')
  return (
    <PageSurface contentClassName="max-w-lg">
      <AdminTopBar />
      <Card className="mt-12 text-center">
        <img
          src="/templates/jamozy-simplified.png"
          alt=""
          className="mx-auto h-20 w-20 object-contain"
        />
        <h1 className="mt-4 text-xl font-bold">
          {unauthorized
            ? t('routeError.unauthorizedTitle')
            : t('routeError.title')}
        </h1>
        <p className="mt-2 text-[#667085]">{message}</p>
        <Link
          to={notFound ? '/admin' : '/'}
          className="mt-5 inline-block rounded-full bg-[#a85d4e] px-4 py-2 text-sm font-semibold text-white"
        >
          {notFound
            ? t('routeError.backToDashboard')
            : t('routeError.backHome')}
        </Link>
      </Card>
    </PageSurface>
  )
}

export default function AdminRouteError() {
  return (
    <AdminI18nProvider>
      <AdminRouteErrorContent />
    </AdminI18nProvider>
  )
}
