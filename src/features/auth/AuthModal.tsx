import { useEffect, useRef, useState } from 'react'
import { useFetcher } from 'react-router'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useSnackbar } from '../../components/ui/SnackbarProvider'

interface AuthResult {
  authenticated?: boolean
  error?: string
}

export function AuthModal({ onClose }: { onClose: () => void }) {
  const fetcher = useFetcher<AuthResult>()
  const { showError, showSuccess } = useSnackbar()
  const [createAccount, setCreateAccount] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const pendingIntent = useRef<string | null>(null)
  const handledResult = useRef<AuthResult | null>(null)

  useEffect(() => {
    if (!fetcher.data || fetcher.data === handledResult.current) return
    handledResult.current = fetcher.data
    if (fetcher.data.error) showError(fetcher.data.error)
    if (fetcher.data.authenticated) {
      showSuccess(pendingIntent.current === 'sign-up' ? 'Account created successfully' : 'Signed in successfully')
      onClose()
    }
  }, [fetcher.data, onClose, showError, showSuccess])

  const submit = (intent: string) => {
    pendingIntent.current = intent
    handledResult.current = null
    fetcher.submit({ intent, email, password }, { method: 'post', encType: 'application/json' })
  }

  return <Modal open title={createAccount ? 'Create account' : 'Sign in'} onClose={onClose}>
    <div className="mt-5 space-y-3">
      <label className="grid gap-1.5 text-sm font-semibold text-[#39465b]">Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="rounded-2xl border border-[#eadfd4] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#d8b3a9] focus:ring-2 focus:ring-[#f2c5bb]" /></label>
      <label className="grid gap-1.5 text-sm font-semibold text-[#39465b]">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="rounded-2xl border border-[#eadfd4] bg-white px-3 py-2.5 font-normal outline-none focus:border-[#d8b3a9] focus:ring-2 focus:ring-[#f2c5bb]" /></label>
      {fetcher.data?.error && <p className="text-sm font-medium text-[#a85d4e]">{fetcher.data.error}</p>}
      <Button className="mt-2 w-full" onClick={() => submit(createAccount ? 'sign-up' : 'sign-in')} disabled={fetcher.state !== 'idle'}>{createAccount ? 'Create account' : 'Sign in'}</Button>
      <Button className="w-full" variant="secondary" onClick={() => submit('google')} disabled={fetcher.state !== 'idle'}>Continue with Google</Button>
      <Button className="w-full" variant="ghost" onClick={() => setCreateAccount((current) => !current)}>{createAccount ? 'Already have an account?' : 'Create account'}</Button>
    </div>
  </Modal>
}
