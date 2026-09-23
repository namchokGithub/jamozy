import { useRouteError } from 'react-router'

export default function RouteError() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : 'Something went wrong.'

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-xl font-medium text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-slate-600">{message}</p>
    </main>
  )
}
