import { useState } from 'react'
import { useFetcher } from 'react-router'

export function AuthModal({ onClose }: { onClose: () => void }) {
  const fetcher = useFetcher<{ error?: string }>()
  const [createAccount, setCreateAccount] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const submit = (intent: string) => fetcher.submit({ intent, email, password }, { method: 'post', encType: 'application/json' })
  return <div role="dialog" aria-modal="true" aria-label="Sign in" className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4"><div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"><button type="button" onClick={onClose} className="float-right">×</button><h2 className="text-xl font-bold">{createAccount ? 'Create account' : 'Sign in'}</h2><label className="mt-4 block text-sm">Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 w-full rounded border p-2" /></label><label className="mt-3 block text-sm">Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-1 w-full rounded border p-2" /></label>{fetcher.data?.error && <p role="alert" className="mt-2 text-sm text-red-600">{fetcher.data.error}</p>}<button type="button" onClick={() => submit(createAccount ? 'sign-up' : 'sign-in')} className="mt-4 w-full rounded bg-slate-900 p-2 text-white">{createAccount ? 'Create account' : 'Sign in'}</button><button type="button" onClick={() => submit('google')} className="mt-3 w-full rounded border p-2">Continue with Google</button><button type="button" onClick={() => setCreateAccount(!createAccount)} className="mt-3 text-sm underline">{createAccount ? 'Already have an account?' : 'Create account'}</button></div></div>
}
