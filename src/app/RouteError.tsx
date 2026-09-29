import { Link, useRouteError } from 'react-router'
import { NotFoundError } from '../domain/errors'
import { UnauthorizedError } from '../features/admin/AdminGuard.loader'
import { Card } from '../components/ui/Card'
import { PageSurface } from '../components/ui/PageSurface'

export default function RouteError() {
  const error = useRouteError()
  const unauthorized = error instanceof UnauthorizedError
  const message = unauthorized
    ? 'Sign in with the owner account to open content management.'
    : error instanceof NotFoundError
      ? 'Not found.'
      : error instanceof Error
        ? error.message
        : 'Something went wrong.'
  return (
    <PageSurface contentClassName="max-w-lg">
      <Card className="mt-16 text-center">
        <img
          src="/templates/jamozy-simplified.png"
          alt=""
          className="mx-auto h-20 w-20 object-contain"
        />
        <h1 className="mt-4 text-xl font-bold">
          {unauthorized ? 'Unauthorized' : 'Something went wrong'}
        </h1>
        <p className="mt-2 text-[#667085]">{message}</p>
        <Link
          to="/"
          className="mt-5 inline-block rounded-full bg-[#a85d4e] px-4 py-2 text-sm font-semibold text-white"
        >
          Back home
        </Link>
      </Card>
    </PageSurface>
  )
}
